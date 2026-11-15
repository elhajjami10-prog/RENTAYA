import { prisma } from '../db.js';
import { getSettings } from '../lib/settings.js';
import { notify, systemMessage } from '../lib/notify.js';
import { refreshResponseStats } from '../lib/bookingService.js';

/** Expiration des demandes sans réponse et des réservations non payées. */
export async function expireBookings() {
  const now = new Date();
  const requests = await prisma.booking.findMany({ where: { status: 'REQUESTED', requestExpiresAt: { lt: now } } });
  for (const b of requests) {
    await prisma.booking.update({ where: { id: b.id }, data: { status: 'EXPIRED' } });
    await notify(b.driverId, 'BOOKING_EXPIRED', 'Demande expirée', 'Le propriétaire n\'a pas répondu à temps. Essayez une autre voiture.', { bookingId: b.id });
    await notify(b.ownerId, 'BOOKING_EXPIRED', 'Demande expirée', 'Vous n\'avez pas répondu à une demande. Cela affecte votre taux de réponse.', { bookingId: b.id });
    await refreshResponseStats(b.ownerId);
  }
  const unpaid = await prisma.booking.findMany({ where: { status: 'PENDING_PAYMENT', paymentDueAt: { lt: now } } });
  for (const b of unpaid) {
    // un paiement manuel en cours de validation suspend l'expiration
    const awaiting = await prisma.payment.count({ where: { bookingId: b.id, type: 'BOOKING', status: 'AWAITING_VALIDATION' } });
    if (awaiting) continue;
    await prisma.booking.update({ where: { id: b.id }, data: { status: 'EXPIRED' } });
    await prisma.payment.updateMany({ where: { bookingId: b.id, status: 'PENDING' }, data: { status: 'CANCELLED' } });
    await notify(b.driverId, 'BOOKING_EXPIRED', 'Réservation expirée', 'Le paiement n\'a pas été reçu dans les délais.', { bookingId: b.id });
    await notify(b.ownerId, 'BOOKING_EXPIRED', 'Réservation expirée', 'Le conducteur n\'a pas finalisé le paiement. Vos dates sont de nouveau disponibles.', { bookingId: b.id });
  }
}

/** Rappels avant le départ et le retour. */
export async function sendReminders() {
  const now = Date.now();
  const soon = await prisma.booking.findMany({
    where: { status: 'CONFIRMED', startAt: { gt: new Date(now + 23 * 3600_000), lt: new Date(now + 24 * 3600_000) } },
    include: { car: true },
  });
  for (const b of soon) {
    for (const uid of [b.driverId, b.ownerId]) await notify(uid, 'REMINDER_START', 'Départ demain', `${b.car.make} ${b.car.model} : n'oubliez pas l'état des lieux avec photos au départ.`, { bookingId: b.id });
  }
  const ending = await prisma.booking.findMany({
    where: { status: 'IN_PROGRESS', endAt: { gt: new Date(now + 2 * 3600_000), lt: new Date(now + 3 * 3600_000) } },
  });
  for (const b of ending) {
    await notify(b.driverId, 'REMINDER_END', 'Retour dans 3 heures', 'Pensez à refaire le niveau de carburant. Besoin de plus de temps ? Demandez une prolongation.', { bookingId: b.id });
    await systemMessage(b.id, 'Rappel : la location se termine dans environ 3 heures.');
  }
}

/** Regroupe les gains des locations terminées en versements à effectuer. */
export async function generatePayouts() {
  const s = await getSettings();
  const cutoff = new Date(Date.now() - s.payoutDelayDays * 86400000);
  const bookings = await prisma.booking.findMany({
    where: { payoutId: null, status: { in: ['COMPLETED', 'CANCELLED_BY_DRIVER', 'CANCELLED_BY_OWNER'] }, endAt: { lt: cutoff } },
    include: { charges: { where: { status: 'PAID', payoutId: null } } },
  });
  const byOwner = new Map<string, typeof bookings>();
  for (const b of bookings) byOwner.set(b.ownerId, [...(byOwner.get(b.ownerId) || []), b]);
  let created = 0;
  for (const [ownerId, list] of byOwner) {
    const amount = list.reduce((a, b) => a + b.ownerEarnings - b.ownerPenalty + b.charges.reduce((x, c) => x + c.amount, 0), 0);
    if (amount <= 0) continue;
    await prisma.$transaction(async (tx) => {
      const p = await tx.payout.create({ data: { ownerId, amount } });
      await tx.booking.updateMany({ where: { id: { in: list.map((b) => b.id) } }, data: { payoutId: p.id } });
      await tx.charge.updateMany({ where: { id: { in: list.flatMap((b) => b.charges.map((c) => c.id)) } }, data: { payoutId: p.id } });
    });
    created++;
  }
  return created;
}

export function startScheduler() {
  const run = async (name: string, fn: () => Promise<unknown>) => {
    try { await fn(); } catch (e) { console.error(`[job ${name}]`, e); }
  };
  setInterval(() => run('expire', expireBookings), 60_000);
  setInterval(() => run('reminders', sendReminders), 3600_000);
  setInterval(() => run('payouts', generatePayouts), 6 * 3600_000);
  run('expire', expireBookings);
}
