import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { ah, badRequest, notFound } from '../middleware/error.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { getSettings, updateSettings, DEFAULT_SETTINGS } from '../lib/settings.js';
import { notify } from '../lib/notify.js';
import { onPaymentPaid, refreshRatings } from '../lib/bookingService.js';
import { privateUser } from '../lib/util.js';
import { generatePayouts } from '../jobs/scheduler.js';

const r = Router();
r.use(requireAuth, requireAdmin);

const page = (q: Record<string, unknown>) => {
  const p = Math.max(1, Number(q.page || 1));
  const take = Math.min(200, Number(q.pageSize || 50));
  return { skip: (p - 1) * take, take };
};

// ---------- Tableau de bord ----------
r.get('/stats', ah(async (_req, res) => {
  const since30 = new Date(Date.now() - 30 * 86400000);
  const [users, cars, pendingCars, pendingUsers, bookings30, gmv, revenue, awaitingPayments, openClaims, contested, pendingRefunds, pendingPayouts, openTickets, byStatus, byCity] =
    await Promise.all([
      prisma.user.count(),
      prisma.car.count({ where: { status: 'ACTIVE' } }),
      prisma.car.count({ where: { status: 'PENDING_REVIEW' } }),
      prisma.user.count({ where: { verificationStatus: 'PENDING' } }),
      prisma.booking.count({ where: { createdAt: { gte: since30 } } }),
      prisma.booking.aggregate({ where: { status: { in: ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'] }, paidAt: { gte: since30 } }, _sum: { totalPrice: true } }),
      prisma.booking.aggregate({ where: { status: { in: ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'] }, paidAt: { gte: since30 } }, _sum: { commission: true } }),
      prisma.payment.count({ where: { status: 'AWAITING_VALIDATION' } }),
      prisma.claim.count({ where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } } }),
      prisma.charge.count({ where: { status: 'CONTESTED' } }),
      prisma.payment.count({ where: { type: 'REFUND', status: 'PENDING' } }),
      prisma.payout.count({ where: { status: { in: ['PENDING', 'PROCESSING'] } } }),
      prisma.supportTicket.count({ where: { status: 'OPEN' } }),
      prisma.booking.groupBy({ by: ['status'], _count: true }),
      prisma.car.groupBy({ by: ['city'], where: { status: 'ACTIVE' }, _count: true }),
    ]);
  const daily = await prisma.$queryRaw<{ day: Date; count: bigint; gmv: bigint }[]>`
    SELECT date_trunc('day', "createdAt") AS day, count(*) AS count, coalesce(sum("totalPrice"),0) AS gmv
    FROM "Booking" WHERE "createdAt" >= ${since30} GROUP BY 1 ORDER BY 1`;
  res.json({
    users, cars, pendingCars, pendingUsers, bookings30,
    gmv30: gmv._sum.totalPrice || 0, revenue30: revenue._sum.commission || 0,
    awaitingPayments, openClaims, contested, pendingRefunds, pendingPayouts, openTickets,
    byStatus: byStatus.map((x) => ({ status: x.status, count: x._count })),
    byCity: byCity.map((x) => ({ city: x.city, count: x._count })),
    daily: daily.map((d) => ({ day: d.day, count: Number(d.count), gmv: Number(d.gmv) })),
  });
}));

// ---------- Utilisateurs ----------
r.get('/users', ah(async (req, res) => {
  const q = req.query as Record<string, string>;
  const where: Prisma.UserWhereInput = {};
  if (q.search) where.OR = ['email', 'firstName', 'lastName', 'phone'].map((f) => ({ [f]: { contains: q.search, mode: 'insensitive' } }));
  if (q.verification) where.verificationStatus = q.verification as never;
  if (q.pro) where.isPro = q.pro === 'true';
  const [items, total] = await Promise.all([
    prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, ...page(q), include: { _count: { select: { cars: true, bookingsAsDriver: true } } } }),
    prisma.user.count({ where }),
  ]);
  res.json({ total, items: items.map((u) => ({ ...privateUser(u), _count: u._count })) });
}));

r.get('/users/:id', ah(async (req, res) => {
  const u = await prisma.user.findUnique({
    where: { id: req.params.id },
    include: {
      documents: true, cars: true,
      bookingsAsDriver: { take: 20, orderBy: { createdAt: 'desc' } },
      bookingsAsOwner: { take: 20, orderBy: { createdAt: 'desc' } },
      walletTxs: { take: 20, orderBy: { createdAt: 'desc' } },
    },
  });
  if (!u) throw notFound();
  res.json({ ...privateUser(u), documents: u.documents, cars: u.cars, bookingsAsDriver: u.bookingsAsDriver, bookingsAsOwner: u.bookingsAsOwner, walletTxs: u.walletTxs });
}));

r.post('/users/:id/verification', ah(async (req, res) => {
  const { status, note } = z.object({ status: z.enum(['VERIFIED', 'REJECTED']), note: z.string().max(500).optional() }).parse(req.body);
  const u = await prisma.user.update({ where: { id: req.params.id }, data: { verificationStatus: status, verificationNote: note } });
  await prisma.document.updateMany({ where: { userId: u.id, status: 'PENDING' }, data: { status } });
  await notify(u.id, 'VERIFICATION_' + status, status === 'VERIFIED' ? 'Profil vérifié ✅' : 'Vérification refusée',
    status === 'VERIFIED' ? 'Vous pouvez maintenant louer des voitures sur Rentaya.' : note || 'Merci de renvoyer des documents lisibles.');
  res.json(privateUser(u));
}));

r.patch('/users/:id', ah(async (req, res) => {
  const data = z.object({ suspended: z.boolean().optional(), role: z.enum(['USER', 'ADMIN']).optional(), isPro: z.boolean().optional() }).parse(req.body);
  res.json(privateUser(await prisma.user.update({ where: { id: req.params.id }, data })));
}));

r.post('/users/:id/wallet', ah(async (req, res) => {
  const { amount, note } = z.object({ amount: z.number().int(), note: z.string().max(200) }).parse(req.body);
  const [u] = await prisma.$transaction([
    prisma.user.update({ where: { id: req.params.id }, data: { walletBalance: { increment: amount } } }),
    prisma.walletTransaction.create({ data: { userId: req.params.id, type: 'ADJUSTMENT', amount, note } }),
  ]);
  if (u.walletBalance < 0) throw badRequest('NEGATIVE_BALANCE');
  res.json({ balance: u.walletBalance });
}));

// ---------- Véhicules ----------
r.get('/cars', ah(async (req, res) => {
  const q = req.query as Record<string, string>;
  const where: Prisma.CarWhereInput = {};
  if (q.status) where.status = q.status as never;
  if (q.city) where.city = q.city;
  if (q.search) where.OR = ['make', 'model', 'plate'].map((f) => ({ [f]: { contains: q.search, mode: 'insensitive' } }));
  const [items, total] = await Promise.all([
    prisma.car.findMany({ where, include: { owner: true, photos: { orderBy: { position: 'asc' } }, documents: true }, orderBy: { createdAt: 'desc' }, ...page(q) }),
    prisma.car.count({ where }),
  ]);
  res.json({ total, items: items.map((c) => ({ ...c, owner: privateUser(c.owner) })) });
}));

r.post('/cars/:id/review', ah(async (req, res) => {
  const { status, reason } = z.object({ status: z.enum(['ACTIVE', 'REJECTED', 'PAUSED']), reason: z.string().max(500).optional() }).parse(req.body);
  const car = await prisma.car.update({ where: { id: req.params.id }, data: { status, rejectionReason: status === 'REJECTED' ? reason : null } });
  await notify(car.ownerId, 'CAR_' + status, status === 'ACTIVE' ? 'Annonce publiée 🚗' : 'Annonce non validée',
    status === 'ACTIVE' ? `Votre ${car.make} ${car.model} est maintenant visible par les conducteurs.` : reason || 'Votre annonce nécessite des modifications.', { carId: car.id });
  res.json(car);
}));

// ---------- Réservations ----------
r.get('/bookings', ah(async (req, res) => {
  const q = req.query as Record<string, string>;
  const where: Prisma.BookingWhereInput = {};
  if (q.status) where.status = q.status as never;
  if (q.search) where.reference = { contains: q.search, mode: 'insensitive' };
  const [items, total] = await Promise.all([
    prisma.booking.findMany({ where, include: { car: true, driver: true, owner: true }, orderBy: { createdAt: 'desc' }, ...page(q) }),
    prisma.booking.count({ where }),
  ]);
  res.json({ total, items: items.map((b) => ({ ...b, driver: privateUser(b.driver), owner: privateUser(b.owner) })) });
}));

r.get('/bookings/:id', ah(async (req, res) => {
  const b = await prisma.booking.findUnique({
    where: { id: req.params.id },
    include: {
      car: true, driver: true, owner: true, insurancePlan: true, inspections: true, payments: true, extensions: true, charges: true, claims: true, reviews: true,
      conversation: { include: { messages: { orderBy: { createdAt: 'asc' } } } },
    },
  });
  if (!b) throw notFound();
  res.json({ ...b, driver: privateUser(b.driver), owner: privateUser(b.owner) });
}));

// ---------- Paiements ----------
r.get('/payments', ah(async (req, res) => {
  const q = req.query as Record<string, string>;
  const where: Prisma.PaymentWhereInput = {};
  if (q.status) where.status = q.status as never;
  if (q.type) where.type = q.type as never;
  if (q.method) where.method = q.method as never;
  const [items, total] = await Promise.all([
    prisma.payment.findMany({ where, include: { user: true, booking: { select: { reference: true, status: true } } }, orderBy: { createdAt: 'desc' }, ...page(q) }),
    prisma.payment.count({ where }),
  ]);
  res.json({ total, items: items.map((p) => ({ ...p, user: privateUser(p.user) })) });
}));

/** Valider / refuser un paiement manuel (Wafacash, Cash Plus, virement) ou marquer un remboursement effectué. */
r.post('/payments/:id/:action(validate|reject|refunded)', ah(async (req, res) => {
  const p = await prisma.payment.findUnique({ where: { id: req.params.id } });
  if (!p) throw notFound();
  const action = req.params.action;
  if (action === 'validate') {
    if (!['AWAITING_VALIDATION', 'PENDING'].includes(p.status) || p.type === 'REFUND') throw badRequest('INVALID_STATUS');
    await onPaymentPaid(p);
  } else if (action === 'reject') {
    await prisma.payment.update({ where: { id: p.id }, data: { status: 'FAILED' } });
    await notify(p.userId, 'PAYMENT_REJECTED', 'Paiement non validé', 'Votre preuve de paiement n\'a pas pu être validée. Contactez le support.', { bookingId: p.bookingId });
  } else {
    if (p.type !== 'REFUND') throw badRequest('NOT_A_REFUND');
    const { providerRef } = z.object({ providerRef: z.string().optional() }).parse(req.body);
    await prisma.payment.update({ where: { id: p.id }, data: { status: 'REFUNDED', providerRef } });
    await notify(p.userId, 'REFUND_DONE', 'Remboursement effectué', `${p.amount} MAD vous ont été remboursés.`, { bookingId: p.bookingId });
  }
  res.json(await prisma.payment.findUnique({ where: { id: p.id } }));
}));

// ---------- Versements propriétaires ----------
r.get('/payouts', ah(async (req, res) => {
  const q = req.query as Record<string, string>;
  const where: Prisma.PayoutWhereInput = q.status ? { status: q.status as never } : {};
  const items = await prisma.payout.findMany({ where, include: { owner: true, bookings: { select: { reference: true, ownerEarnings: true } } }, orderBy: { createdAt: 'desc' }, ...page(q) });
  res.json({ items: items.map((p) => ({ ...p, owner: privateUser(p.owner) })) });
}));
r.post('/payouts/generate', ah(async (_req, res) => res.json({ created: await generatePayouts() })));
r.post('/payouts/:id', ah(async (req, res) => {
  const { status, reference } = z.object({ status: z.enum(['PROCESSING', 'PAID', 'FAILED']), reference: z.string().optional() }).parse(req.body);
  const p = await prisma.payout.update({ where: { id: req.params.id }, data: { status, reference, paidAt: status === 'PAID' ? new Date() : null } });
  if (status === 'PAID') await notify(p.ownerId, 'PAYOUT_PAID', 'Versement effectué 💸', `${p.amount} MAD ont été virés sur votre compte.`);
  res.json(p);
}));

// ---------- Sinistres, frais contestés ----------
r.get('/claims', ah(async (req, res) => {
  const q = req.query as Record<string, string>;
  res.json(await prisma.claim.findMany({
    where: q.status ? { status: q.status as never } : {},
    include: { booking: { include: { car: true } }, reporter: { select: { id: true, firstName: true, lastName: true, email: true } } },
    orderBy: { createdAt: 'desc' }, ...page(q),
  }));
}));
r.patch('/claims/:id', ah(async (req, res) => {
  const data = z.object({ status: z.enum(['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED']), resolution: z.string().max(2000).optional() }).parse(req.body);
  const c = await prisma.claim.update({ where: { id: req.params.id }, data, include: { booking: true } });
  for (const uid of [c.booking.driverId, c.booking.ownerId]) await notify(uid, 'CLAIM_UPDATE', 'Mise à jour du sinistre', data.resolution || `Statut : ${data.status}`, { bookingId: c.bookingId });
  res.json(c);
}));
r.get('/charges', ah(async (req, res) => {
  const q = req.query as Record<string, string>;
  res.json(await prisma.charge.findMany({ where: q.status ? { status: q.status as never } : {}, include: { booking: { include: { car: true } } }, orderBy: { createdAt: 'desc' }, ...page(q) }));
}));
r.post('/charges/:id', ah(async (req, res) => {
  const { status, amount } = z.object({ status: z.enum(['ACCEPTED', 'REJECTED']), amount: z.number().int().min(0).optional() }).parse(req.body);
  const c = await prisma.charge.update({ where: { id: req.params.id }, data: { status, ...(amount != null ? { amount } : {}) }, include: { booking: true } });
  for (const uid of [c.booking.driverId, c.booking.ownerId]) await notify(uid, 'CHARGE_DECISION', 'Décision sur les frais', status === 'ACCEPTED' ? `Frais maintenus : ${c.amount} MAD` : 'Frais annulés', { bookingId: c.bookingId });
  res.json(c);
}));

// ---------- Avis ----------
r.get('/reviews', ah(async (req, res) => {
  res.json(await prisma.review.findMany({ include: { author: { select: { firstName: true, lastName: true } }, targetUser: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: 'desc' }, ...page(req.query) }));
}));
r.post('/reviews/:id', ah(async (req, res) => {
  const { hidden } = z.object({ hidden: z.boolean() }).parse(req.body);
  const rv = await prisma.review.update({ where: { id: req.params.id }, data: { hidden } });
  await refreshRatings(rv.targetUserId, rv.carId);
  res.json(rv);
}));

// ---------- Codes promo ----------
const promoSchema = z.object({
  code: z.string().min(3).max(40).transform((s) => s.toUpperCase()),
  type: z.enum(['PERCENT', 'FIXED']),
  value: z.number().int().min(1),
  maxDiscount: z.number().int().nullish(),
  minAmount: z.number().int().min(0).default(0),
  maxUses: z.number().int().nullish(),
  firstBookingOnly: z.boolean().default(false),
  validFrom: z.coerce.date().nullish(),
  validTo: z.coerce.date().nullish(),
  active: z.boolean().default(true),
});
r.get('/promos', ah(async (_req, res) => res.json(await prisma.promoCode.findMany({ orderBy: { createdAt: 'desc' } }))));
r.post('/promos', ah(async (req, res) => res.status(201).json(await prisma.promoCode.create({ data: promoSchema.parse(req.body) }))));
r.patch('/promos/:id', ah(async (req, res) => res.json(await prisma.promoCode.update({ where: { id: req.params.id }, data: promoSchema.partial().parse(req.body) }))));
r.delete('/promos/:id', ah(async (req, res) => { await prisma.promoCode.delete({ where: { id: req.params.id } }); res.json({ ok: true }); }));

// ---------- Formules d'assurance ----------
const planSchema = z.object({
  code: z.string().min(2).max(30), nameFr: z.string(), nameAr: z.string(), nameEn: z.string(),
  descriptionFr: z.string(), descriptionAr: z.string(), descriptionEn: z.string(),
  pricePerDay: z.number().int().min(0), franchise: z.number().int().min(0), roadside: z.boolean().default(true),
  position: z.number().int().default(0), active: z.boolean().default(true),
});
r.get('/insurance', ah(async (_req, res) => res.json(await prisma.insurancePlan.findMany({ orderBy: { position: 'asc' } }))));
r.post('/insurance', ah(async (req, res) => res.status(201).json(await prisma.insurancePlan.create({ data: planSchema.parse(req.body) }))));
r.patch('/insurance/:id', ah(async (req, res) => res.json(await prisma.insurancePlan.update({ where: { id: req.params.id }, data: planSchema.partial().parse(req.body) }))));

// ---------- Paramètres ----------
r.get('/settings', ah(async (_req, res) => res.json(await getSettings())));
r.put('/settings', ah(async (req, res) => {
  const shape = Object.fromEntries(Object.entries(DEFAULT_SETTINGS).map(([k, v]) => [k, (typeof v === 'number' ? z.number() : z.string()).optional()]));
  res.json(await updateSettings(z.object(shape).parse(req.body)));
}));

// ---------- Centre d'aide ----------
const articleSchema = z.object({ slug: z.string().regex(/^[a-z0-9-]+$/), locale: z.enum(['fr', 'ar', 'en']), category: z.string(), title: z.string(), body: z.string(), position: z.number().int().default(0), published: z.boolean().default(true) });
r.get('/help', ah(async (_req, res) => res.json(await prisma.helpArticle.findMany({ orderBy: [{ locale: 'asc' }, { category: 'asc' }, { position: 'asc' }] }))));
r.post('/help', ah(async (req, res) => res.status(201).json(await prisma.helpArticle.create({ data: articleSchema.parse(req.body) }))));
r.patch('/help/:id', ah(async (req, res) => res.json(await prisma.helpArticle.update({ where: { id: req.params.id }, data: articleSchema.partial().parse(req.body) }))));
r.delete('/help/:id', ah(async (req, res) => { await prisma.helpArticle.delete({ where: { id: req.params.id } }); res.json({ ok: true }); }));

// ---------- Support ----------
r.get('/tickets', ah(async (req, res) => {
  const q = req.query as Record<string, string>;
  res.json(await prisma.supportTicket.findMany({ where: q.status ? { status: q.status as never } : {}, include: { user: { select: { firstName: true, lastName: true, email: true, phone: true } } }, orderBy: { createdAt: 'desc' }, ...page(q) }));
}));
r.post('/tickets/:id', ah(async (req, res) => {
  const { reply, status } = z.object({ reply: z.string().max(5000).optional(), status: z.enum(['OPEN', 'PENDING', 'CLOSED']) }).parse(req.body);
  const t = await prisma.supportTicket.update({ where: { id: req.params.id }, data: { reply, status } });
  if (reply) await notify(t.userId, 'TICKET_REPLY', 'Réponse du support Rentaya', reply.slice(0, 140));
  res.json(t);
}));

export default r;
