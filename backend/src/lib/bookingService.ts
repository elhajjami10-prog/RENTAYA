import type { Booking, Payment, Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { getSettings } from './settings.js';
import { notify, systemMessage } from './notify.js';
import { genRef } from './util.js';

const fmtDate = (d: Date) =>
  d.toLocaleString('fr-MA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Casablanca' });

/** Appelé quand un paiement est confirmé (CMI, validation admin, portefeuille). */
export async function onPaymentPaid(payment: Payment) {
  if (payment.status === 'PAID') return;
  const p = await prisma.payment.update({ where: { id: payment.id }, data: { status: 'PAID' } });
  if (!p.bookingId) return;
  const booking = await prisma.booking.findUniqueOrThrow({ where: { id: p.bookingId }, include: { car: true } });

  if (p.type === 'BOOKING') {
    if (booking.status !== 'PENDING_PAYMENT') {
      // Paiement reçu sur une réservation expirée/annulée → à rembourser
      await createRefund(booking, p.amount, 'Paiement reçu après expiration de la réservation');
      return;
    }
    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: 'CONFIRMED', paidAt: new Date(), contractNumber: booking.contractNumber || genRef('CTR') },
    });
    await useWalletAndPromo(booking);
    // Les autres demandes sur le même créneau sont automatiquement refusées
    const overlapping = await prisma.booking.findMany({
      where: { carId: booking.carId, id: { not: booking.id }, status: 'REQUESTED', startAt: { lt: booking.endAt }, endAt: { gt: booking.startAt } },
    });
    for (const o of overlapping) {
      await prisma.booking.update({ where: { id: o.id }, data: { status: 'DECLINED', cancelReason: 'Véhicule réservé par un autre conducteur' } });
      await notify(o.driverId, 'BOOKING_DECLINED', 'Demande non acceptée', `Le véhicule n'est plus disponible pour vos dates.`, { bookingId: o.id });
    }
    const title = `${booking.car.make} ${booking.car.model}`;
    await notify(booking.driverId, 'BOOKING_CONFIRMED', 'Location confirmée 🎉', `${title} — du ${fmtDate(booking.startAt)} au ${fmtDate(booking.endAt)}`, { bookingId: booking.id });
    await notify(booking.ownerId, 'BOOKING_CONFIRMED', 'Nouvelle location confirmée', `${title} — du ${fmtDate(booking.startAt)} au ${fmtDate(booking.endAt)}`, { bookingId: booking.id });
    await systemMessage(booking.id, 'La location est confirmée. Convenez ensemble du lieu et de l\'heure exacte du rendez-vous pour l\'état des lieux.');
  }

  if (p.type === 'EXTENSION' && p.extensionId) {
    const ext = await prisma.extension.findUniqueOrThrow({ where: { id: p.extensionId } });
    const s = await getSettings();
    const ownerCommission = Math.round((ext.extraPrice * s.commissionPercent) / 100);
    await prisma.$transaction([
      prisma.extension.update({ where: { id: ext.id }, data: { status: 'PAID' } }),
      prisma.booking.update({
        where: { id: booking.id },
        data: {
          endAt: ext.newEndAt,
          days: booking.days + ext.extraDays,
          basePrice: booking.basePrice + ext.extraPrice,
          totalPrice: booking.totalPrice + ext.extraPrice,
          commission: booking.commission + ownerCommission,
          ownerEarnings: booking.ownerEarnings + ext.extraPrice - ownerCommission,
          kmIncluded: booking.unlimitedKm ? 0 : booking.kmIncluded + booking.car.kmPerDay * ext.extraDays,
        },
      }),
    ]);
    await notify(booking.ownerId, 'EXTENSION_PAID', 'Prolongation confirmée', `Nouvelle date de retour : ${fmtDate(ext.newEndAt)}`, { bookingId: booking.id });
    await notify(booking.driverId, 'EXTENSION_PAID', 'Prolongation confirmée', `Nouvelle date de retour : ${fmtDate(ext.newEndAt)}`, { bookingId: booking.id });
    await systemMessage(booking.id, `Location prolongée jusqu'au ${fmtDate(ext.newEndAt)}.`);
  }

  if (p.type === 'CHARGE' && p.chargeId) {
    await prisma.charge.update({ where: { id: p.chargeId }, data: { status: 'PAID' } });
    await notify(booking.ownerId, 'CHARGE_PAID', 'Frais réglés', 'Le conducteur a réglé des frais supplémentaires.', { bookingId: booking.id });
  }
}

async function useWalletAndPromo(b: Booking) {
  if (b.walletUsed > 0) {
    await prisma.$transaction([
      prisma.user.update({ where: { id: b.driverId }, data: { walletBalance: { decrement: b.walletUsed } } }),
      prisma.walletTransaction.create({ data: { userId: b.driverId, type: 'BOOKING_PAYMENT', amount: -b.walletUsed, note: `Réservation ${b.reference}` } }),
    ]);
  }
  if (b.promoCode) await prisma.promoCode.update({ where: { code: b.promoCode }, data: { usedCount: { increment: 1 } } });
}

/**
 * Crée un remboursement. La part payée avec le portefeuille est recréditée immédiatement,
 * le reste est à exécuter par l'admin (back-office CMI ou virement) puis marqué « REFUNDED ».
 */
export async function createRefund(b: Booking, amount: number, note: string) {
  if (amount <= 0) return;
  const toWallet = Math.min(amount, b.walletUsed);
  const toCard = amount - toWallet;
  if (toWallet > 0) {
    await prisma.$transaction([
      prisma.user.update({ where: { id: b.driverId }, data: { walletBalance: { increment: toWallet } } }),
      prisma.walletTransaction.create({ data: { userId: b.driverId, type: 'REFUND', amount: toWallet, note } }),
    ]);
  }
  if (toCard > 0) {
    const original = await prisma.payment.findFirst({ where: { bookingId: b.id, type: 'BOOKING', status: 'PAID' } });
    await prisma.payment.create({
      data: {
        bookingId: b.id,
        userId: b.driverId,
        type: 'REFUND',
        method: original?.method || 'BANK_TRANSFER',
        status: 'PENDING',
        amount: toCard,
        orderId: genRef('RFD'),
        raw: { note, originalOrderId: original?.orderId } as Prisma.InputJsonValue,
      },
    });
  }
}

/** Crédit de parrainage au parrain après la première location terminée du filleul. */
export async function rewardReferrer(driverId: string) {
  const driver = await prisma.user.findUnique({ where: { id: driverId } });
  if (!driver?.referredById) return;
  const completed = await prisma.booking.count({ where: { driverId, status: 'COMPLETED' } });
  if (completed !== 1) return;
  const s = await getSettings();
  await prisma.$transaction([
    prisma.user.update({ where: { id: driver.referredById }, data: { walletBalance: { increment: s.referralBonusReferrer } } }),
    prisma.walletTransaction.create({
      data: { userId: driver.referredById, type: 'REFERRAL_BONUS', amount: s.referralBonusReferrer, note: `Parrainage de ${driver.firstName}` },
    }),
  ]);
  await notify(driver.referredById, 'REFERRAL', 'Bonus de parrainage', `${driver.firstName} a terminé sa première location : ${s.referralBonusReferrer} MAD crédités !`);
}

/** Recalcule la note moyenne d'un utilisateur et d'une voiture. */
export async function refreshRatings(userId: string, carId?: string | null) {
  const u = await prisma.review.aggregate({ where: { targetUserId: userId, hidden: false }, _avg: { rating: true }, _count: true });
  await prisma.user.update({ where: { id: userId }, data: { ratingAvg: u._avg.rating || 0, ratingCount: u._count } });
  if (carId) {
    const c = await prisma.review.aggregate({ where: { carId, role: 'DRIVER_TO_OWNER', hidden: false }, _avg: { rating: true }, _count: true });
    await prisma.car.update({ where: { id: carId }, data: { ratingAvg: c._avg.rating || 0, ratingCount: c._count } });
  }
}

/** Met à jour le taux et le temps de réponse du propriétaire. */
export async function refreshResponseStats(ownerId: string) {
  const reqs = await prisma.booking.findMany({
    where: { ownerId, instant: false, createdAt: { gt: new Date(Date.now() - 180 * 86400000) } },
    select: { status: true, acceptedAt: true, createdAt: true, updatedAt: true, cancelReason: true },
  });
  if (!reqs.length) return;
  const answered = reqs.filter((r) => r.status !== 'EXPIRED' && r.status !== 'REQUESTED');
  const times = answered.map((r) => ((r.acceptedAt || r.updatedAt).getTime() - r.createdAt.getTime()) / 60000);
  await prisma.user.update({
    where: { id: ownerId },
    data: {
      responseRate: Math.round((answered.length / reqs.length) * 100),
      responseTimeMin: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 60,
    },
  });
}
