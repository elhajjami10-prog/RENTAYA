import { Router } from 'express';
import { z } from 'zod';
import type { Prisma, User } from '@prisma/client';
import { prisma } from '../db.js';
import { ah, badRequest, forbidden, notFound } from '../middleware/error.js';
import { me, requireAuth } from '../middleware/auth.js';
import { computeQuote, driverCancellationRefund, rentalDays } from '../lib/pricing.js';
import { getSettings } from '../lib/settings.js';
import { isAvailable } from './cars.js';
import { genRef, publicUser } from '../lib/util.js';
import { notify, systemMessage } from '../lib/notify.js';
import { createRefund, onPaymentPaid, refreshRatings, refreshResponseStats, rewardReferrer } from '../lib/bookingService.js';
import { startPayment } from './payments.js';

const r = Router();
r.use(requireAuth);

const fmt = (d: Date) =>
  d.toLocaleString('fr-MA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Casablanca' });

async function resolvePromo(code: string | undefined, user: User, amount: number) {
  if (!code) return null;
  const p = await prisma.promoCode.findUnique({ where: { code: code.toUpperCase().trim() } });
  const now = new Date();
  if (!p || !p.active || (p.validFrom && p.validFrom > now) || (p.validTo && p.validTo < now) || (p.maxUses != null && p.usedCount >= p.maxUses)) {
    throw badRequest('INVALID_PROMO');
  }
  if (amount < p.minAmount) throw badRequest('PROMO_MIN_AMOUNT');
  if (p.firstBookingOnly) {
    const n = await prisma.booking.count({ where: { driverId: user.id, status: { in: ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'] } } });
    if (n > 0) throw badRequest('PROMO_FIRST_BOOKING_ONLY');
  }
  let discount = p.type === 'PERCENT' ? Math.round((amount * p.value) / 100) : p.value;
  if (p.maxDiscount) discount = Math.min(discount, p.maxDiscount);
  return { code: p.code, discount };
}

const quoteSchema = z.object({
  carId: z.string(),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  insurancePlanId: z.string().nullish(),
  delivery: z.boolean().default(false),
  deliveryAddress: z.string().max(200).nullish(),
  promoCode: z.string().max(40).nullish(),
  useWallet: z.boolean().default(false),
});

/** Vérifie toutes les conditions de réservation et calcule le prix. */
async function buildQuote(user: User, input: z.infer<typeof quoteSchema>) {
  const car = await prisma.car.findUnique({ where: { id: input.carId }, include: { priceOverrides: true } });
  if (!car || car.status !== 'ACTIVE') throw notFound('CAR_NOT_FOUND');
  if (car.ownerId === user.id) throw badRequest('OWN_CAR');
  const { startAt, endAt } = input;
  if (endAt <= startAt) throw badRequest('INVALID_DATES');
  if (startAt.getTime() < Date.now() + car.advanceNoticeHours * 3600_000) throw badRequest('ADVANCE_NOTICE', `${car.advanceNoticeHours}`);
  const days = rentalDays(startAt, endAt);
  if (days < car.minDays) throw badRequest('MIN_DAYS', String(car.minDays));
  if (days > car.maxDays) throw badRequest('MAX_DAYS', String(car.maxDays));
  if (!(await isAvailable(car.id, startAt, endAt))) throw badRequest('NOT_AVAILABLE');
  const insurancePlan = input.insurancePlanId
    ? await prisma.insurancePlan.findFirst({ where: { id: input.insurancePlanId, active: true } })
    : await prisma.insurancePlan.findFirst({ where: { active: true }, orderBy: { position: 'asc' } });
  const settings = await getSettings();
  const pre = computeQuote({ car, start: startAt, end: endAt, insurancePlan, delivery: input.delivery, settings });
  const promo = await resolvePromo(input.promoCode || undefined, user, pre.rentalPrice);
  const quote = computeQuote({
    car, start: startAt, end: endAt, insurancePlan, delivery: input.delivery, promo,
    useWallet: input.useWallet, walletAvailable: user.walletBalance, settings,
  });
  return { car, insurancePlan, promo, quote };
}

/** Le conducteur remplit-il les conditions du propriétaire ? */
function checkDriverEligibility(user: User, car: { minDriverAge: number; minLicenseYears: number }) {
  const issues: string[] = [];
  if (user.verificationStatus !== 'VERIFIED') issues.push('PROFILE_NOT_VERIFIED');
  if (!user.phoneVerified) issues.push('PHONE_NOT_VERIFIED');
  const years = (d: Date) => (Date.now() - d.getTime()) / (365.25 * 86400000);
  if (user.birthDate && years(user.birthDate) < car.minDriverAge) issues.push('DRIVER_TOO_YOUNG');
  if (user.licenseIssueDate && years(user.licenseIssueDate) < car.minLicenseYears) issues.push('LICENSE_TOO_RECENT');
  return issues;
}

r.post('/quote', ah(async (req, res) => {
  const input = quoteSchema.parse(req.body);
  const { car, insurancePlan, promo, quote } = await buildQuote(me(req), input);
  res.json({ quote, insurancePlanId: insurancePlan?.id, promo, eligibility: checkDriverEligibility(me(req), car), instant: car.instantBooking, walletBalance: me(req).walletBalance });
}));

r.post('/', ah(async (req, res) => {
  const input = quoteSchema.extend({ message: z.string().max(2000).optional() }).parse(req.body);
  const user = me(req);
  const { car, insurancePlan, promo, quote } = await buildQuote(user, input);
  const issues = checkDriverEligibility(user, car);
  if (issues.length) throw badRequest(issues[0]);
  if (input.delivery && !input.deliveryAddress) throw badRequest('DELIVERY_ADDRESS_REQUIRED');
  const s = await getSettings();
  const now = Date.now();
  const status = car.instantBooking ? 'PENDING_PAYMENT' : 'REQUESTED';
  const booking = await prisma.booking.create({
    data: {
      reference: genRef('RTY'),
      carId: car.id,
      driverId: user.id,
      ownerId: car.ownerId,
      startAt: input.startAt,
      endAt: input.endAt,
      status,
      instant: car.instantBooking,
      message: input.message,
      days: quote.days,
      pricePerDay: quote.pricePerDay,
      basePrice: quote.basePrice,
      discountAmount: quote.discountAmount,
      deliveryFee: quote.deliveryFee,
      deliveryAddress: input.delivery ? input.deliveryAddress : null,
      insurancePlanId: insurancePlan?.id,
      insuranceFee: quote.insuranceFee,
      serviceFee: quote.serviceFee,
      promoCode: promo?.code,
      promoDiscount: quote.promoDiscount,
      walletUsed: quote.walletUsed,
      totalPrice: quote.totalPrice,
      commission: quote.commission,
      ownerEarnings: quote.ownerEarnings,
      depositAmount: quote.depositAmount,
      kmIncluded: quote.kmIncluded,
      unlimitedKm: quote.unlimitedKm,
      extraKmPrice: quote.extraKmPrice,
      acceptedAt: car.instantBooking ? new Date() : null,
      requestExpiresAt: car.instantBooking ? null : new Date(Math.min(now + s.requestExpiryHours * 3600_000, input.startAt.getTime())),
      paymentDueAt: car.instantBooking ? new Date(Math.min(now + s.cashPaymentWindowHours * 3600_000, input.startAt.getTime())) : null,
      conversation: {
        create: {
          userAId: user.id,
          userBId: car.ownerId,
          carId: car.id,
          messages: input.message ? { create: { senderId: user.id, body: input.message } } : undefined,
        },
      },
    },
  });
  await notify(
    car.ownerId,
    car.instantBooking ? 'BOOKING_INSTANT' : 'BOOKING_REQUEST',
    car.instantBooking ? 'Réservation instantanée' : 'Nouvelle demande de location',
    `${user.firstName} — ${car.make} ${car.model}, du ${fmt(input.startAt)} au ${fmt(input.endAt)}`,
    { bookingId: booking.id },
  );
  res.status(201).json(booking);
}));

/** Liste des réservations. role=driver|owner, scope=upcoming|current|past|requests|all */
r.get('/', ah(async (req, res) => {
  const role = req.query.role === 'owner' ? 'owner' : 'driver';
  const scope = String(req.query.scope || 'all');
  const where: Prisma.BookingWhereInput = role === 'owner' ? { ownerId: me(req).id } : { driverId: me(req).id };
  if (req.query.carId) where.carId = String(req.query.carId);
  if (scope === 'requests') where.status = { in: ['REQUESTED'] };
  if (scope === 'upcoming') Object.assign(where, { status: { in: ['REQUESTED', 'PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS'] } });
  if (scope === 'past') Object.assign(where, { OR: [{ status: { in: ['COMPLETED', 'DECLINED', 'EXPIRED', 'CANCELLED_BY_DRIVER', 'CANCELLED_BY_OWNER', 'CANCELLED_BY_ADMIN'] } }] });
  if (scope === 'current') Object.assign(where, { status: 'IN_PROGRESS' });
  const list = await prisma.booking.findMany({
    where,
    include: { car: { include: { photos: { orderBy: { position: 'asc' }, take: 1 } } }, driver: true, owner: true },
    orderBy: { startAt: scope === 'past' ? 'desc' : 'asc' },
    take: 200,
  });
  res.json(list.map((b) => ({ ...b, driver: publicUser(b.driver), owner: publicUser(b.owner) })));
}));

async function loadBooking(id: string, user: User) {
  const b = await prisma.booking.findUnique({ where: { id }, include: { car: true } });
  if (!b) throw notFound();
  const isDriver = b.driverId === user.id;
  const isOwner = b.ownerId === user.id;
  if (!isDriver && !isOwner && user.role !== 'ADMIN') throw forbidden();
  return { b, isDriver, isOwner };
}

r.get('/:id', ah(async (req, res) => {
  const { b, isOwner, isDriver } = await loadBooking(req.params.id, me(req));
  const full = await prisma.booking.findUniqueOrThrow({
    where: { id: b.id },
    include: {
      car: { include: { photos: { orderBy: { position: 'asc' } } } },
      driver: true,
      owner: true,
      insurancePlan: true,
      inspections: { orderBy: { createdAt: 'asc' } },
      payments: { orderBy: { createdAt: 'desc' } },
      extensions: { orderBy: { createdAt: 'desc' } },
      charges: { orderBy: { createdAt: 'desc' } },
      claims: { orderBy: { createdAt: 'desc' } },
      reviews: true,
      conversation: { select: { id: true } },
    },
  });
  const confirmed = ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].includes(full.status);
  // Les coordonnées et l'adresse exacte ne sont partagées qu'une fois la location confirmée
  const contact = (u: User) => ({ ...publicUser(u), lastName: u.lastName, phone: confirmed ? u.phone : null });
  const { plate, address, latitude, longitude, pickupInstructions, ...carRest } = full.car;
  const s = await getSettings();
  res.json({
    ...full,
    car: confirmed || isOwner ? full.car : { ...carRest, latitude: Number(latitude.toFixed(2)), longitude: Number(longitude.toFixed(2)) },
    driver: isOwner || me(req).role === 'ADMIN' ? { ...contact(full.driver), licenseIssueDate: confirmed ? full.driver.licenseIssueDate : null } : contact(full.driver),
    owner: contact(full.owner),
    viewerRole: isOwner ? 'owner' : isDriver ? 'driver' : 'admin',
    paymentInstructions: { rib: s.bankTransferRib, holder: s.bankTransferHolder },
    // le conducteur ne voit pas la commission propriétaire, le propriétaire ne voit pas les frais conducteur
    ...(isDriver ? { commission: undefined, ownerEarnings: undefined } : {}),
  });
}));

r.post('/:id/accept', ah(async (req, res) => {
  const { b, isOwner } = await loadBooking(req.params.id, me(req));
  if (!isOwner) throw forbidden();
  if (b.status !== 'REQUESTED') throw badRequest('INVALID_STATUS');
  if (!(await isAvailable(b.carId, b.startAt, b.endAt, b.id))) throw badRequest('NOT_AVAILABLE');
  const s = await getSettings();
  const updated = await prisma.booking.update({
    where: { id: b.id },
    data: {
      status: 'PENDING_PAYMENT',
      acceptedAt: new Date(),
      paymentDueAt: new Date(Math.min(Date.now() + s.cashPaymentWindowHours * 3600_000, b.startAt.getTime())),
    },
  });
  await notify(b.driverId, 'BOOKING_ACCEPTED', 'Demande acceptée ✅', `Finalisez le paiement pour confirmer votre location de la ${b.car.make} ${b.car.model}.`, { bookingId: b.id });
  await systemMessage(b.id, 'Le propriétaire a accepté la demande. En attente du paiement.');
  await refreshResponseStats(b.ownerId);
  res.json(updated);
}));

r.post('/:id/decline', ah(async (req, res) => {
  const { b, isOwner } = await loadBooking(req.params.id, me(req));
  if (!isOwner) throw forbidden();
  if (b.status !== 'REQUESTED') throw badRequest('INVALID_STATUS');
  const { reason } = z.object({ reason: z.string().max(500).optional() }).parse(req.body);
  const updated = await prisma.booking.update({ where: { id: b.id }, data: { status: 'DECLINED', cancelReason: reason } });
  await notify(b.driverId, 'BOOKING_DECLINED', 'Demande refusée', `Le propriétaire n'a pas pu accepter votre demande. Découvrez d'autres voitures disponibles.`, { bookingId: b.id });
  await systemMessage(b.id, 'Le propriétaire a refusé la demande.');
  await refreshResponseStats(b.ownerId);
  res.json(updated);
}));

/** Simulation de remboursement avant annulation. */
r.get('/:id/cancel-preview', ah(async (req, res) => {
  const { b, isDriver } = await loadBooking(req.params.id, me(req));
  const s = await getSettings();
  if (b.status !== 'CONFIRMED') return res.json({ refund: b.walletUsed, penalty: 0, ratio: 1 });
  if (isDriver) return res.json({ ...driverCancellationRefund(b.car.cancellationPolicy, b.startAt, new Date(), b), penalty: 0 });
  res.json({ refund: b.totalPrice + b.walletUsed, ratio: 1, penalty: s.ownerCancelPenalty });
}));

r.post('/:id/cancel', ah(async (req, res) => {
  const { b, isDriver, isOwner } = await loadBooking(req.params.id, me(req));
  const { reason } = z.object({ reason: z.string().max(500).optional() }).parse(req.body);
  if (!['REQUESTED', 'PENDING_PAYMENT', 'CONFIRMED'].includes(b.status)) throw badRequest('INVALID_STATUS');
  const s = await getSettings();
  let refund = 0;
  let penalty = 0;
  if (b.status === 'CONFIRMED') {
    if (isDriver) refund = driverCancellationRefund(b.car.cancellationPolicy, b.startAt, new Date(), b).refund;
    else { refund = b.totalPrice + b.walletUsed; penalty = isOwner ? s.ownerCancelPenalty : 0; }
  }
  const status = isDriver ? 'CANCELLED_BY_DRIVER' : isOwner ? 'CANCELLED_BY_OWNER' : 'CANCELLED_BY_ADMIN';
  // part non remboursée au conducteur : revient au propriétaire (hors frais de service)
  const kept = b.status === 'CONFIRMED' && isDriver ? b.totalPrice + b.walletUsed - refund : 0;
  const ownerShare = kept > 0 ? Math.max(0, Math.min(b.ownerEarnings, kept - b.serviceFee - b.insuranceFee)) : 0;
  const updated = await prisma.booking.update({
    where: { id: b.id },
    data: {
      status, cancelledAt: new Date(), cancelReason: reason, refundAmount: refund, ownerPenalty: penalty,
      ownerEarnings: b.status === 'CONFIRMED' ? ownerShare : 0,
    },
  });
  if (refund > 0) await createRefund(b, refund, `Annulation ${b.reference}`);
  if (b.status !== 'CONFIRMED') {
    // paiements en attente annulés
    await prisma.payment.updateMany({ where: { bookingId: b.id, status: { in: ['PENDING', 'AWAITING_VALIDATION'] } }, data: { status: 'CANCELLED' } });
  }
  const other = isDriver ? b.ownerId : b.driverId;
  await notify(other, 'BOOKING_CANCELLED', 'Location annulée', `La location ${b.reference} a été annulée.`, { bookingId: b.id });
  await systemMessage(b.id, `Location annulée par ${isDriver ? 'le conducteur' : isOwner ? 'le propriétaire' : 'Rentaya'}.`);
  res.json(updated);
}));

/** Paiement de la réservation : CMI (carte) ou Wafacash / CashPlus / virement. */
r.post('/:id/pay', ah(async (req, res) => {
  const { b, isDriver } = await loadBooking(req.params.id, me(req));
  if (!isDriver) throw forbidden();
  if (b.status !== 'PENDING_PAYMENT') throw badRequest('INVALID_STATUS');
  const { method, redirect } = z.object({
    method: z.enum(['CMI', 'WAFACASH', 'CASHPLUS', 'BANK_TRANSFER']),
    redirect: z.string().optional(),
  }).parse(req.body);
  if (b.walletUsed > me(req).walletBalance) throw badRequest('WALLET_INSUFFICIENT');
  await prisma.booking.update({ where: { id: b.id }, data: { paymentMethod: b.totalPrice === 0 ? 'WALLET' : method } });
  if (b.totalPrice === 0) {
    const p = await prisma.payment.create({ data: { bookingId: b.id, userId: b.driverId, type: 'BOOKING', method: 'WALLET', amount: 0, orderId: genRef('PAY') } });
    await onPaymentPaid(p);
    return res.json({ status: 'PAID' });
  }
  res.json(await startPayment({ user: me(req), bookingId: b.id, type: 'BOOKING', method, amount: b.totalPrice, redirect }));
}));

// ---------- État des lieux (check-in / check-out) ----------

const inspectionSchema = z.object({
  type: z.enum(['CHECK_IN', 'CHECK_OUT']),
  odometerKm: z.number().int().min(0),
  fuelLevel: z.number().int().min(0).max(8),
  cleanliness: z.number().int().min(1).max(5).default(4),
  photos: z.array(z.string().url()).min(4).max(40),
  damages: z.array(z.object({ zone: z.string(), description: z.string(), photoUrl: z.string().url().optional() })).default([]),
  notes: z.string().max(2000).optional(),
  driverSignature: z.string().min(20),
  ownerSignature: z.string().min(20),
});

r.post('/:id/inspections', ah(async (req, res) => {
  const { b, isDriver, isOwner } = await loadBooking(req.params.id, me(req));
  if (!isDriver && !isOwner) throw forbidden();
  const input = inspectionSchema.parse(req.body);
  const now = new Date();
  if (input.type === 'CHECK_IN') {
    if (b.status !== 'CONFIRMED') throw badRequest('INVALID_STATUS');
    if (now.getTime() < b.startAt.getTime() - 2 * 3600_000) throw badRequest('TOO_EARLY');
  } else {
    if (b.status !== 'IN_PROGRESS') throw badRequest('INVALID_STATUS');
  }
  const inspection = await prisma.inspection.create({
    data: { ...input, bookingId: b.id, createdById: me(req).id, driverSignedAt: now, ownerSignedAt: now },
  });

  if (input.type === 'CHECK_IN') {
    await prisma.booking.update({ where: { id: b.id }, data: { status: 'IN_PROGRESS' } });
    await prisma.car.update({ where: { id: b.carId }, data: { odometerKm: input.odometerKm } });
    await systemMessage(b.id, `État des lieux de départ effectué — ${input.odometerKm} km, carburant ${input.fuelLevel}/8. Bonne route !`);
  } else {
    const checkIn = await prisma.inspection.findUnique({ where: { bookingId_type: { bookingId: b.id, type: 'CHECK_IN' } } });
    const s = await getSettings();
    const charges: Prisma.ChargeCreateManyInput[] = [];
    if (checkIn) {
      const driven = input.odometerKm - checkIn.odometerKm;
      if (!b.unlimitedKm && driven > b.kmIncluded) {
        const extra = driven - b.kmIncluded;
        charges.push({ bookingId: b.id, type: 'EXTRA_KM', amount: Math.round(extra * b.extraKmPrice), description: `${extra} km supplémentaires × ${b.extraKmPrice} MAD`, createdById: me(req).id });
      }
      const missing = checkIn.fuelLevel - input.fuelLevel;
      if (missing > 0) {
        const liters = Math.round((missing / 8) * 50); // réservoir moyen de 50 L
        charges.push({ bookingId: b.id, type: 'FUEL', amount: liters * s.fuelPricePerLiter, description: `Carburant manquant : ${missing}/8 (≈ ${liters} L)`, createdById: me(req).id });
      }
      if (input.cleanliness <= 2 && checkIn.cleanliness >= 3) {
        charges.push({ bookingId: b.id, type: 'CLEANING', amount: s.cleaningFee, description: 'Véhicule rendu sale', createdById: me(req).id });
      }
    }
    const lateHours = Math.floor((now.getTime() - b.endAt.getTime()) / 3600_000);
    if (lateHours >= 1) {
      charges.push({ bookingId: b.id, type: 'LATE_RETURN', amount: lateHours * s.lateFeePerHour, description: `Retour avec ${lateHours} h de retard`, createdById: me(req).id });
    }
    if (charges.length) await prisma.charge.createMany({ data: charges });
    await prisma.booking.update({ where: { id: b.id }, data: { status: 'COMPLETED' } });
    await prisma.car.update({ where: { id: b.carId }, data: { odometerKm: input.odometerKm, tripsCount: { increment: 1 } } });
    await systemMessage(b.id, `État des lieux de retour effectué — ${input.odometerKm} km, carburant ${input.fuelLevel}/8. Merci ! Pensez à laisser un avis.`);
    for (const uid of [b.driverId, b.ownerId]) {
      await notify(uid, 'BOOKING_COMPLETED', 'Location terminée', 'Laissez un avis pour aider la communauté Rentaya.', { bookingId: b.id });
    }
    if (charges.length) {
      await notify(b.driverId, 'CHARGE_NEW', 'Frais supplémentaires', `${charges.length} frais ont été calculés à la restitution. Consultez le détail.`, { bookingId: b.id });
    }
    await rewardReferrer(b.driverId);
  }
  res.status(201).json(inspection);
}));

// ---------- Prolongation ----------

r.post('/:id/extensions', ah(async (req, res) => {
  const { b, isDriver } = await loadBooking(req.params.id, me(req));
  if (!isDriver) throw forbidden();
  if (!['CONFIRMED', 'IN_PROGRESS'].includes(b.status)) throw badRequest('INVALID_STATUS');
  const { newEndAt } = z.object({ newEndAt: z.coerce.date() }).parse(req.body);
  if (newEndAt <= b.endAt) throw badRequest('INVALID_DATES');
  if (!(await isAvailable(b.carId, b.endAt, newEndAt, b.id))) throw badRequest('NOT_AVAILABLE');
  const totalDays = rentalDays(b.startAt, newEndAt);
  if (totalDays > b.car.maxDays) throw badRequest('MAX_DAYS', String(b.car.maxDays));
  const extraDays = totalDays - b.days;
  const extraPrice = Math.max(0, extraDays) * b.pricePerDay;
  await prisma.extension.updateMany({ where: { bookingId: b.id, status: 'PENDING' }, data: { status: 'CANCELLED' } });
  const ext = await prisma.extension.create({ data: { bookingId: b.id, newEndAt, extraDays: Math.max(0, extraDays), extraPrice } });
  await notify(b.ownerId, 'EXTENSION_REQUEST', 'Demande de prolongation', `Le conducteur souhaite prolonger jusqu'au ${fmt(newEndAt)} (+${extraPrice} MAD).`, { bookingId: b.id });
  await systemMessage(b.id, `Demande de prolongation jusqu'au ${fmt(newEndAt)}.`);
  res.status(201).json(ext);
}));

r.post('/:id/extensions/:eid/:action(accept|decline)', ah(async (req, res) => {
  const { b, isOwner } = await loadBooking(req.params.id, me(req));
  if (!isOwner) throw forbidden();
  const ext = await prisma.extension.findFirst({ where: { id: req.params.eid, bookingId: b.id, status: 'PENDING' } });
  if (!ext) throw notFound();
  const accept = req.params.action === 'accept';
  if (accept && !(await isAvailable(b.carId, b.endAt, ext.newEndAt, b.id))) throw badRequest('NOT_AVAILABLE');
  let updated = await prisma.extension.update({ where: { id: ext.id }, data: { status: accept ? 'ACCEPTED' : 'DECLINED' } });
  if (accept && ext.extraPrice === 0) {
    const p = await prisma.payment.create({ data: { bookingId: b.id, userId: b.driverId, type: 'EXTENSION', method: 'WALLET', amount: 0, orderId: genRef('PAY'), extensionId: ext.id } });
    await onPaymentPaid(p);
    updated = await prisma.extension.findUniqueOrThrow({ where: { id: ext.id } });
  }
  await notify(b.driverId, 'EXTENSION_' + (accept ? 'ACCEPTED' : 'DECLINED'), accept ? 'Prolongation acceptée' : 'Prolongation refusée',
    accept ? 'Réglez la prolongation pour la confirmer.' : 'Le propriétaire ne peut pas prolonger la location.', { bookingId: b.id });
  res.json(updated);
}));

r.post('/:id/extensions/:eid/pay', ah(async (req, res) => {
  const { b, isDriver } = await loadBooking(req.params.id, me(req));
  if (!isDriver) throw forbidden();
  const ext = await prisma.extension.findFirst({ where: { id: req.params.eid, bookingId: b.id, status: 'ACCEPTED' } });
  if (!ext) throw notFound();
  const { method, redirect } = z.object({ method: z.enum(['CMI', 'WAFACASH', 'CASHPLUS', 'BANK_TRANSFER']), redirect: z.string().optional() }).parse(req.body);
  res.json(await startPayment({ user: me(req), bookingId: b.id, type: 'EXTENSION', method, amount: ext.extraPrice, extensionId: ext.id, redirect }));
}));

// ---------- Frais supplémentaires (km, carburant, amendes, péages…) ----------

r.post('/:id/charges', ah(async (req, res) => {
  const { b, isOwner } = await loadBooking(req.params.id, me(req));
  if (!isOwner) throw forbidden();
  if (!['IN_PROGRESS', 'COMPLETED'].includes(b.status)) throw badRequest('INVALID_STATUS');
  // Les amendes peuvent être déclarées jusqu'à 1 an après, les autres frais sous 7 jours
  const body = z.object({
    type: z.enum(['FUEL', 'EXTRA_KM', 'LATE_RETURN', 'CLEANING', 'FINE', 'TOLL', 'DAMAGE', 'OTHER']),
    amount: z.number().int().min(1).max(100000),
    description: z.string().min(3).max(1000),
    proofUrls: z.array(z.string().url()).max(10).default([]),
  }).parse(req.body);
  const limitDays = body.type === 'FINE' ? 365 : 7;
  if (Date.now() - b.endAt.getTime() > limitDays * 86400000) throw badRequest('CHARGE_TOO_LATE');
  const c = await prisma.charge.create({ data: { ...body, bookingId: b.id, createdById: me(req).id } });
  await notify(b.driverId, 'CHARGE_NEW', 'Nouveaux frais', `${body.description} — ${body.amount} MAD`, { bookingId: b.id });
  res.status(201).json(c);
}));

r.post('/:id/charges/:cid/respond', ah(async (req, res) => {
  const { b, isDriver } = await loadBooking(req.params.id, me(req));
  if (!isDriver) throw forbidden();
  const { accept, response } = z.object({ accept: z.boolean(), response: z.string().max(1000).optional() }).parse(req.body);
  const c = await prisma.charge.findFirst({ where: { id: req.params.cid, bookingId: b.id, status: 'PENDING' } });
  if (!c) throw notFound();
  const updated = await prisma.charge.update({ where: { id: c.id }, data: { status: accept ? 'ACCEPTED' : 'CONTESTED', response } });
  await notify(b.ownerId, 'CHARGE_' + (accept ? 'ACCEPTED' : 'CONTESTED'), accept ? 'Frais acceptés' : 'Frais contestés',
    accept ? 'Le conducteur a accepté les frais.' : 'Le conducteur conteste les frais. Notre équipe va examiner le dossier.', { bookingId: b.id });
  res.json(updated);
}));

r.post('/:id/charges/:cid/pay', ah(async (req, res) => {
  const { b, isDriver } = await loadBooking(req.params.id, me(req));
  if (!isDriver) throw forbidden();
  const c = await prisma.charge.findFirst({ where: { id: req.params.cid, bookingId: b.id, status: 'ACCEPTED' } });
  if (!c) throw notFound();
  const { method, redirect } = z.object({ method: z.enum(['CMI', 'WAFACASH', 'CASHPLUS', 'BANK_TRANSFER']), redirect: z.string().optional() }).parse(req.body);
  res.json(await startPayment({ user: me(req), bookingId: b.id, type: 'CHARGE', method, amount: c.amount, chargeId: c.id, redirect }));
}));

// ---------- Sinistres ----------

r.post('/:id/claims', ah(async (req, res) => {
  const { b, isDriver, isOwner } = await loadBooking(req.params.id, me(req));
  if (!isDriver && !isOwner) throw forbidden();
  if (!['IN_PROGRESS', 'COMPLETED'].includes(b.status)) throw badRequest('INVALID_STATUS');
  const body = z.object({ description: z.string().min(10).max(3000), photos: z.array(z.string().url()).max(20).default([]), estimate: z.number().int().min(0).optional() }).parse(req.body);
  const claim = await prisma.claim.create({ data: { ...body, bookingId: b.id, reporterId: me(req).id } });
  await notify(isDriver ? b.ownerId : b.driverId, 'CLAIM_NEW', 'Déclaration de sinistre', `Un sinistre a été déclaré sur la location ${b.reference}.`, { bookingId: b.id });
  res.status(201).json(claim);
}));

// ---------- Avis ----------

r.post('/:id/review', ah(async (req, res) => {
  const { b, isDriver, isOwner } = await loadBooking(req.params.id, me(req));
  if (!isDriver && !isOwner) throw forbidden();
  if (b.status !== 'COMPLETED') throw badRequest('INVALID_STATUS');
  if (Date.now() - b.endAt.getTime() > 30 * 86400000) throw badRequest('REVIEW_TOO_LATE');
  const body = z.object({
    rating: z.number().int().min(1).max(5),
    cleanliness: z.number().int().min(1).max(5).optional(),
    communication: z.number().int().min(1).max(5).optional(),
    accuracy: z.number().int().min(1).max(5).optional(),
    punctuality: z.number().int().min(1).max(5).optional(),
    comment: z.string().max(2000).optional(),
  }).parse(req.body);
  if ((isDriver && b.driverReviewed) || (isOwner && b.ownerReviewed)) throw badRequest('ALREADY_REVIEWED');
  const review = await prisma.review.create({
    data: {
      ...body,
      bookingId: b.id,
      authorId: me(req).id,
      targetUserId: isDriver ? b.ownerId : b.driverId,
      carId: isDriver ? b.carId : null,
      role: isDriver ? 'DRIVER_TO_OWNER' : 'OWNER_TO_DRIVER',
    },
  });
  await prisma.booking.update({ where: { id: b.id }, data: isDriver ? { driverReviewed: true } : { ownerReviewed: true } });
  await refreshRatings(review.targetUserId, review.carId);
  await notify(review.targetUserId, 'REVIEW_NEW', 'Nouvel avis', `Vous avez reçu un avis ${body.rating}★.`, { bookingId: b.id });
  res.status(201).json(review);
}));

r.post('/reviews/:rid/reply', ah(async (req, res) => {
  const rv = await prisma.review.findUnique({ where: { id: req.params.rid } });
  if (!rv || rv.targetUserId !== me(req).id) throw notFound();
  const { reply } = z.object({ reply: z.string().min(1).max(1000) }).parse(req.body);
  res.json(await prisma.review.update({ where: { id: rv.id }, data: { reply } }));
}));

// ---------- Contrat de location & facture (HTML imprimable / PDF via le navigateur) ----------

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function docShell(title: string, body: string) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>body{font-family:Helvetica,Arial,sans-serif;color:#2A0B4D;max-width:820px;margin:24px auto;padding:0 16px;line-height:1.45}
h1{color:#6A1BD0;margin:0}h2{border-bottom:2px solid #EBDDFB;padding-bottom:4px;margin-top:28px;font-size:16px}
table{width:100%;border-collapse:collapse}td{padding:6px 4px;border-bottom:1px solid #F0E6FC;vertical-align:top}td:last-child{text-align:right}
.head{display:flex;justify-content:space-between;align-items:center}.muted{color:#7A6A94;font-size:13px}.tot td{font-weight:bold;font-size:17px}
.sig{display:flex;gap:24px}.sig div{flex:1;border:1px solid #EBDDFB;border-radius:8px;padding:8px;min-height:90px}.sig img{max-width:100%;max-height:80px}
@media print{button{display:none}}</style></head><body>${body}<p><button onclick="print()">Imprimer / PDF</button></p></body></html>`;
}

r.get('/:id/contract', ah(async (req, res) => {
  const { b } = await loadBooking(req.params.id, me(req));
  if (!['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].includes(b.status)) throw badRequest('INVALID_STATUS');
  const full = await prisma.booking.findUniqueOrThrow({ where: { id: b.id }, include: { car: true, driver: true, owner: true, inspections: true, insurancePlan: true } });
  const ci = full.inspections.find((i) => i.type === 'CHECK_IN');
  const co = full.inspections.find((i) => i.type === 'CHECK_OUT');
  const insp = (i: typeof ci, label: string) => i ? `<h2>${label}</h2><table>
<tr><td>Date</td><td>${esc(i.createdAt.toLocaleString('fr-MA', { timeZone: 'Africa/Casablanca' }))}</td></tr>
<tr><td>Kilométrage</td><td>${i.odometerKm} km</td></tr><tr><td>Carburant</td><td>${i.fuelLevel}/8</td></tr>
<tr><td>Propreté</td><td>${i.cleanliness}/5</td></tr><tr><td>Dommages constatés</td><td>${(i.damages as { zone: string; description: string }[]).map((d) => esc(d.zone + ' : ' + d.description)).join('<br>') || 'Aucun'}</td></tr>
<tr><td>Remarques</td><td>${esc(i.notes || '—')}</td></tr></table>
<div class="sig"><div>Signature conducteur<br><img src="${esc(i.driverSignature)}"></div><div>Signature propriétaire<br><img src="${esc(i.ownerSignature)}"></div></div>` : '';
  const d = (x: Date) => x.toLocaleString('fr-MA', { timeZone: 'Africa/Casablanca' });
  res.type('html').send(docShell(`Contrat ${full.contractNumber}`, `
<div class="head"><h1>Rentaya</h1><div class="muted">Contrat de location n° ${esc(full.contractNumber)}<br>Réservation ${esc(full.reference)}</div></div>
<h2>Parties</h2><table>
<tr><td>Propriétaire (loueur)</td><td>${esc(full.owner.firstName + ' ' + full.owner.lastName)}${full.owner.isPro ? ' — ' + esc(full.owner.companyName) + ' (ICE ' + esc(full.owner.companyIce) + ')' : ''}<br>${esc(full.owner.phone)}</td></tr>
<tr><td>Conducteur (locataire)</td><td>${esc(full.driver.firstName + ' ' + full.driver.lastName)}<br>CIN ${esc(full.driver.cinNumber || '—')} — Permis ${esc(full.driver.licenseNumber || '—')}<br>${esc(full.driver.phone)}</td></tr></table>
<h2>Véhicule</h2><table>
<tr><td>Modèle</td><td>${esc(full.car.make + ' ' + full.car.model + ' (' + full.car.year + ')')}</td></tr>
<tr><td>Immatriculation</td><td>${esc(full.car.plate)}</td></tr><tr><td>Carburant / Boîte</td><td>${full.car.fuel} / ${full.car.transmission === 'AUTOMATIC' ? 'Automatique' : 'Manuelle'}</td></tr></table>
<h2>Location</h2><table>
<tr><td>Départ</td><td>${esc(d(full.startAt))}</td></tr><tr><td>Retour</td><td>${esc(d(full.endAt))}</td></tr>
<tr><td>Kilométrage inclus</td><td>${full.unlimitedKm ? 'Illimité' : full.kmIncluded + ' km (puis ' + full.extraKmPrice + ' MAD/km)'}</td></tr>
<tr><td>Assurance</td><td>${esc(full.insurancePlan?.nameFr || '—')} — franchise ${full.insurancePlan?.franchise ?? '—'} MAD</td></tr>
<tr><td>Dépôt de garantie</td><td>${full.depositAmount} MAD</td></tr>
<tr><td>Politique carburant</td><td>${full.car.fuelPolicy === 'FULL_TO_FULL' ? 'Plein / plein' : 'Même niveau au retour'}</td></tr></table>
${insp(ci, 'État des lieux de départ')}${insp(co, 'État des lieux de retour')}
<h2>Conditions</h2><p class="muted">Le conducteur s'engage à utiliser le véhicule en bon père de famille, à respecter le code de la route marocain, à ne pas sous-louer le véhicule,
à ne pas quitter le territoire marocain sans accord écrit du propriétaire, et à restituer le véhicule à la date, à l'heure et au lieu convenus.
Les amendes, péages et frais de stationnement pendant la location sont à la charge du conducteur. En cas de sinistre, le conducteur doit le déclarer
dans l'application Rentaya sous 48 heures. Les conditions générales de Rentaya s'appliquent.</p>`));
}));

r.get('/:id/invoice', ah(async (req, res) => {
  const { b, isOwner } = await loadBooking(req.params.id, me(req));
  if (!['CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED_BY_DRIVER', 'CANCELLED_BY_OWNER'].includes(b.status)) throw badRequest('INVALID_STATUS');
  const full = await prisma.booking.findUniqueOrThrow({ where: { id: b.id }, include: { car: true, driver: true, owner: true, charges: { where: { status: 'PAID' } } } });
  const row = (l: string, v: number) => `<tr><td>${esc(l)}</td><td>${v.toLocaleString('fr-MA')} MAD</td></tr>`;
  const lines = isOwner
    ? row('Revenus de location', full.basePrice - full.discountAmount) + (full.deliveryFee ? row('Livraison', full.deliveryFee) : '') +
      row('Commission Rentaya', -(full.basePrice - full.discountAmount + full.deliveryFee - full.ownerEarnings)) +
      full.charges.map((c) => row(c.description, c.amount)).join('') +
      `<tr class="tot"><td>Net propriétaire</td><td>${(full.ownerEarnings + full.charges.reduce((a, c) => a + c.amount, 0)).toLocaleString('fr-MA')} MAD</td></tr>`
    : row(`Location ${full.days} jour(s)`, full.basePrice) + (full.discountAmount ? row('Réduction longue durée', -full.discountAmount) : '') +
      (full.deliveryFee ? row('Livraison', full.deliveryFee) : '') + row('Assurance', full.insuranceFee) + row('Frais de service', full.serviceFee) +
      (full.promoDiscount ? row(`Code promo ${full.promoCode}`, -full.promoDiscount) : '') + (full.walletUsed ? row('Crédit Rentaya', -full.walletUsed) : '') +
      full.charges.map((c) => row(c.description, c.amount)).join('') + (full.refundAmount ? row('Remboursement', -full.refundAmount) : '') +
      `<tr class="tot"><td>Total TTC</td><td>${(full.totalPrice + full.charges.reduce((a, c) => a + c.amount, 0) - full.refundAmount).toLocaleString('fr-MA')} MAD</td></tr>`;
  const who = isOwner ? full.owner : full.driver;
  res.type('html').send(docShell(`Facture ${full.reference}`, `
<div class="head"><h1>Rentaya</h1><div class="muted">${isOwner ? 'Relevé propriétaire' : 'Facture'} n° F-${esc(full.reference)}<br>${new Date().toLocaleDateString('fr-MA')}</div></div>
<p><b>${esc(who.firstName + ' ' + who.lastName)}</b><br>${esc(who.email)}</p>
<p>${esc(full.car.make + ' ' + full.car.model)} — du ${full.startAt.toLocaleDateString('fr-MA')} au ${full.endAt.toLocaleDateString('fr-MA')}</p>
<table>${lines}</table>`));
}));

export default r;
