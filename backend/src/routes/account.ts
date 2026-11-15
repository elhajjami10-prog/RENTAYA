import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { ah, notFound } from '../middleware/error.js';
import { me, requireAuth } from '../middleware/auth.js';
import { getSettings } from '../lib/settings.js';
import { publicUser } from '../lib/util.js';

/** Notifications, favoris, portefeuille / parrainage, revenus propriétaire, support. */
const r = Router();
r.use(requireAuth);

// --- Notifications ---
r.get('/notifications', ah(async (req, res) => {
  const items = await prisma.notification.findMany({ where: { userId: me(req).id }, orderBy: { createdAt: 'desc' }, take: 100 });
  const unread = await prisma.notification.count({ where: { userId: me(req).id, read: false } });
  res.json({ items, unread });
}));
r.post('/notifications/read', ah(async (req, res) => {
  const { ids } = z.object({ ids: z.array(z.string()).optional() }).parse(req.body);
  await prisma.notification.updateMany({ where: { userId: me(req).id, ...(ids ? { id: { in: ids } } : {}) }, data: { read: true } });
  res.json({ ok: true });
}));

// --- Favoris ---
r.get('/favorites', ah(async (req, res) => {
  const favs = await prisma.favorite.findMany({
    where: { userId: me(req).id, car: { status: 'ACTIVE' } },
    include: { car: { include: { photos: { orderBy: { position: 'asc' }, take: 3 }, owner: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(favs.map((f) => {
    const { plate, address, owner, ...car } = f.car;
    void plate; void address;
    return { ...car, owner: publicUser(owner), isFavorite: true };
  }));
}));
r.put('/favorites/:carId', ah(async (req, res) => {
  const car = await prisma.car.findUnique({ where: { id: req.params.carId } });
  if (!car) throw notFound();
  await prisma.favorite.upsert({ where: { userId_carId: { userId: me(req).id, carId: car.id } }, create: { userId: me(req).id, carId: car.id }, update: {} });
  res.json({ ok: true });
}));
r.delete('/favorites/:carId', ah(async (req, res) => {
  await prisma.favorite.deleteMany({ where: { userId: me(req).id, carId: req.params.carId } });
  res.json({ ok: true });
}));

// --- Portefeuille & parrainage ---
r.get('/wallet', ah(async (req, res) => {
  const s = await getSettings();
  const [txs, referrals] = await Promise.all([
    prisma.walletTransaction.findMany({ where: { userId: me(req).id }, orderBy: { createdAt: 'desc' }, take: 100 }),
    prisma.user.count({ where: { referredById: me(req).id } }),
  ]);
  res.json({
    balance: me(req).walletBalance,
    referralCode: me(req).referralCode,
    referrals,
    referralBonusReferee: s.referralBonusReferee,
    referralBonusReferrer: s.referralBonusReferrer,
    transactions: txs,
  });
}));

// --- Revenus du propriétaire ---
r.get('/earnings', ah(async (req, res) => {
  const uid = me(req).id;
  const year = Number(req.query.year || new Date().getFullYear());
  const from = new Date(Date.UTC(year, 0, 1));
  const to = new Date(Date.UTC(year + 1, 0, 1));
  const bookings = await prisma.booking.findMany({
    where: { ownerId: uid, startAt: { gte: from, lt: to }, status: { in: ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED_BY_DRIVER'] } },
    include: { car: { select: { id: true, make: true, model: true } }, charges: { where: { status: 'PAID' } } },
    orderBy: { startAt: 'desc' },
  });
  const months = Array.from({ length: 12 }, (_, m) => ({ month: m + 1, earnings: 0, bookings: 0, days: 0 }));
  const byCar = new Map<string, { carId: string; name: string; earnings: number; bookings: number }>();
  let total = 0;
  for (const b of bookings) {
    const e = b.ownerEarnings + b.charges.reduce((a, c) => a + c.amount, 0);
    const m = months[b.startAt.getUTCMonth()];
    m.earnings += e; m.bookings += 1; m.days += b.status === 'CANCELLED_BY_DRIVER' ? 0 : b.days;
    total += e;
    const k = byCar.get(b.carId) || { carId: b.carId, name: `${b.car.make} ${b.car.model}`, earnings: 0, bookings: 0 };
    k.earnings += e; k.bookings += 1; byCar.set(b.carId, k);
  }
  const [payouts, pendingAgg, upcomingAgg, penalties] = await Promise.all([
    prisma.payout.findMany({ where: { ownerId: uid }, orderBy: { createdAt: 'desc' }, take: 50 }),
    prisma.booking.aggregate({ where: { ownerId: uid, payoutId: null, status: { in: ['COMPLETED', 'CANCELLED_BY_DRIVER'] } }, _sum: { ownerEarnings: true } }),
    prisma.booking.aggregate({ where: { ownerId: uid, status: { in: ['CONFIRMED', 'IN_PROGRESS'] } }, _sum: { ownerEarnings: true } }),
    prisma.booking.aggregate({ where: { ownerId: uid, payoutId: null, status: 'CANCELLED_BY_OWNER', ownerPenalty: { gt: 0 } }, _sum: { ownerPenalty: true } }),
  ]);
  res.json({
    year, total, months, byCar: [...byCar.values()],
    pendingPayout: (pendingAgg._sum.ownerEarnings || 0) - (penalties._sum.ownerPenalty || 0),
    upcoming: upcomingAgg._sum.ownerEarnings || 0,
    payouts,
    bankConfigured: !!me(req).rib,
  });
}));

// --- Recherches sauvegardées ---
r.get('/saved-searches', ah(async (req, res) => {
  res.json(await prisma.savedSearch.findMany({ where: { userId: me(req).id }, orderBy: { createdAt: 'desc' } }));
}));
r.post('/saved-searches', ah(async (req, res) => {
  const body = z.object({ city: z.string().optional(), params: z.record(z.any()) }).parse(req.body);
  res.status(201).json(await prisma.savedSearch.create({ data: { userId: me(req).id, city: body.city, params: body.params } }));
}));
r.delete('/saved-searches/:id', ah(async (req, res) => {
  await prisma.savedSearch.deleteMany({ where: { id: req.params.id, userId: me(req).id } });
  res.json({ ok: true });
}));

// --- Support ---
r.get('/tickets', ah(async (req, res) => {
  res.json(await prisma.supportTicket.findMany({ where: { userId: me(req).id }, orderBy: { createdAt: 'desc' } }));
}));
r.post('/tickets', ah(async (req, res) => {
  const body = z.object({ subject: z.string().min(3).max(200), body: z.string().min(10).max(5000), bookingId: z.string().optional() }).parse(req.body);
  res.status(201).json(await prisma.supportTicket.create({ data: { ...body, userId: me(req).id } }));
}));

export default r;
