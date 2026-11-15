import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { ah, badRequest, forbidden, notFound } from '../middleware/error.js';
import { me, requireAuth } from '../middleware/auth.js';
import { notify } from '../lib/notify.js';
import { publicUser } from '../lib/util.js';

const r = Router();
r.use(requireAuth);

/** Masque les numéros de téléphone / emails tant que la location n'est pas confirmée (anti-contournement). */
function sanitize(body: string, confirmed: boolean) {
  if (confirmed) return body;
  return body
    .replace(/(\+?\d[\d .-]{7,}\d)/g, '•••')
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '•••');
}

r.get('/', ah(async (req, res) => {
  const uid = me(req).id;
  const convs = await prisma.conversation.findMany({
    where: { OR: [{ userAId: uid }, { userBId: uid }] },
    include: {
      userA: true, userB: true,
      car: { select: { id: true, make: true, model: true, photos: { take: 1, orderBy: { position: 'asc' } } } },
      booking: { select: { id: true, reference: true, status: true, startAt: true, endAt: true } },
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { lastMessageAt: 'desc' },
  });
  const unread = await prisma.message.groupBy({
    by: ['conversationId'],
    where: { conversation: { OR: [{ userAId: uid }, { userBId: uid }] }, readAt: null, NOT: { senderId: uid } },
    _count: true,
  });
  const u = new Map(unread.map((x) => [x.conversationId, x._count]));
  res.json(convs.map((c) => {
    const other = c.userAId === uid ? c.userB : c.userA;
    return {
      id: c.id, car: c.car, booking: c.booking, lastMessageAt: c.lastMessageAt,
      other: publicUser(other), lastMessage: c.messages[0] || null, unread: u.get(c.id) || 0,
    };
  }));
}));

r.get('/unread-count', ah(async (req, res) => {
  const uid = me(req).id;
  const count = await prisma.message.count({
    where: { conversation: { OR: [{ userAId: uid }, { userBId: uid }] }, readAt: null, NOT: { senderId: uid } },
  });
  res.json({ count });
}));

/** Démarrer une conversation avec un propriétaire au sujet d'une voiture (question avant réservation). */
r.post('/start', ah(async (req, res) => {
  const { carId } = z.object({ carId: z.string() }).parse(req.body);
  const car = await prisma.car.findUnique({ where: { id: carId } });
  if (!car) throw notFound();
  if (car.ownerId === me(req).id) throw badRequest('OWN_CAR');
  const existing = await prisma.conversation.findFirst({ where: { carId, userAId: me(req).id, userBId: car.ownerId, bookingId: null } });
  const conv = existing || (await prisma.conversation.create({ data: { carId, userAId: me(req).id, userBId: car.ownerId } }));
  res.json({ id: conv.id });
}));

async function loadConv(id: string, uid: string) {
  const c = await prisma.conversation.findUnique({ where: { id }, include: { booking: true, userA: true, userB: true, car: { include: { photos: { take: 1 } } } } });
  if (!c) throw notFound();
  if (c.userAId !== uid && c.userBId !== uid) throw forbidden();
  return c;
}

r.get('/:id', ah(async (req, res) => {
  const uid = me(req).id;
  const c = await loadConv(req.params.id, uid);
  const after = req.query.after ? new Date(String(req.query.after)) : undefined;
  const messages = await prisma.message.findMany({
    where: { conversationId: c.id, ...(after ? { createdAt: { gt: after } } : {}) },
    orderBy: { createdAt: 'asc' },
    take: 500,
  });
  await prisma.message.updateMany({ where: { conversationId: c.id, readAt: null, NOT: { senderId: uid } }, data: { readAt: new Date() } });
  const other = c.userAId === uid ? c.userB : c.userA;
  res.json({
    id: c.id,
    other: publicUser(other),
    car: c.car && { id: c.car.id, make: c.car.make, model: c.car.model, photo: c.car.photos[0]?.url },
    booking: c.booking && { id: c.booking.id, reference: c.booking.reference, status: c.booking.status, startAt: c.booking.startAt, endAt: c.booking.endAt },
    messages,
  });
}));

r.post('/:id', ah(async (req, res) => {
  const uid = me(req).id;
  const c = await loadConv(req.params.id, uid);
  const { body, imageUrl } = z.object({ body: z.string().max(4000).default(''), imageUrl: z.string().url().optional() }).parse(req.body);
  if (!body.trim() && !imageUrl) throw badRequest('EMPTY_MESSAGE');
  const confirmed = !!c.booking && ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].includes(c.booking.status);
  const msg = await prisma.message.create({ data: { conversationId: c.id, senderId: uid, body: sanitize(body.trim(), confirmed), imageUrl } });
  await prisma.conversation.update({ where: { id: c.id }, data: { lastMessageAt: new Date() } });
  const otherId = c.userAId === uid ? c.userBId : c.userAId;
  await notify(otherId, 'MESSAGE', `Message de ${me(req).firstName}`, body.slice(0, 120) || '📷 Photo', { conversationId: c.id });
  res.status(201).json(msg);
}));

export default r;
