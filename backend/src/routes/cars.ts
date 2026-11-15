import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { ah, badRequest, forbidden, notFound } from '../middleware/error.js';
import { me, optionalAuth, requireAuth } from '../middleware/auth.js';
import { BLOCKING_STATUSES, distanceKm, parseDate, publicUser } from '../lib/util.js';
import { computeQuote, suggestPrice } from '../lib/pricing.js';
import { getSettings } from '../lib/settings.js';

const r = Router();

const CATEGORIES = ['CITADINE', 'COMPACTE', 'BERLINE', 'SUV', 'QUATRE_X_QUATRE', 'MONOSPACE', 'BREAK', 'CABRIOLET', 'LUXE', 'UTILITAIRE', 'MINIBUS'] as const;

export const carSchema = z.object({
  make: z.string().min(1).max(40),
  model: z.string().min(1).max(60),
  year: z.number().int().min(1990).max(new Date().getFullYear() + 1),
  plate: z.string().min(3).max(20),
  category: z.enum(CATEGORIES),
  transmission: z.enum(['MANUAL', 'AUTOMATIC']),
  fuel: z.enum(['ESSENCE', 'DIESEL', 'HYBRIDE', 'ELECTRIQUE', 'GPL']),
  seats: z.number().int().min(1).max(20),
  doors: z.number().int().min(2).max(6),
  odometerKm: z.number().int().min(0),
  color: z.string().max(30).nullish(),
  title: z.string().max(100).nullish(),
  description: z.string().max(3000).nullish(),
  features: z.array(z.string()).max(40).default([]),
  address: z.string().min(3).max(200),
  city: z.string().min(2).max(60),
  district: z.string().max(80).nullish(),
  latitude: z.number().min(20).max(37),
  longitude: z.number().min(-18).max(0),
  pricePerDay: z.number().int().min(50).max(50000),
  smartPricing: z.boolean().default(false),
  weeklyDiscount: z.number().int().min(0).max(70).default(0),
  monthlyDiscount: z.number().int().min(0).max(80).default(0),
  instantBooking: z.boolean().default(false),
  minDays: z.number().int().min(1).max(30).default(1),
  maxDays: z.number().int().min(1).max(90).default(30),
  advanceNoticeHours: z.number().int().min(0).max(168).default(4),
  kmPerDay: z.number().int().min(50).max(2000).default(200),
  unlimitedKm: z.boolean().default(false),
  extraKmPrice: z.number().min(0).max(20).default(1.5),
  depositAmount: z.number().int().min(0).max(100000).default(3000),
  minDriverAge: z.number().int().min(18).max(35).default(21),
  minLicenseYears: z.number().int().min(0).max(10).default(2),
  deliveryAvailable: z.boolean().default(false),
  deliveryPrice: z.number().int().min(0).max(5000).default(0),
  deliveryRadiusKm: z.number().int().min(1).max(200).default(10),
  airportDelivery: z.boolean().default(false),
  cancellationPolicy: z.enum(['FLEXIBLE', 'MODERATE', 'STRICT']).default('MODERATE'),
  fuelPolicy: z.enum(['SAME_LEVEL', 'FULL_TO_FULL']).default('SAME_LEVEL'),
  smokingAllowed: z.boolean().default(false),
  petsAllowed: z.boolean().default(false),
  crossBorderAllowed: z.boolean().default(false),
  pickupInstructions: z.string().max(1000).nullish(),
  inspectionExpiry: z.coerce.date().nullish(),
  insuranceExpiry: z.coerce.date().nullish(),
  photos: z.array(z.string().url()).max(30).optional(),
});

const publicCarInclude = {
  photos: { orderBy: { position: 'asc' as const } },
  owner: true,
} satisfies Prisma.CarInclude;

/** Masque la position exacte du véhicule avant réservation (≈ 300 m). */
const fuzz = (v: number, seed: string) => {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0;
  return v + ((h % 1000) / 1000 - 0.5) * 0.006;
};

type CarWithOwner = Prisma.CarGetPayload<{ include: typeof publicCarInclude }>;
const publicCar = (c: CarWithOwner, exact = false) => {
  const { owner, plate, latitude, longitude, address, pickupInstructions, ...rest } = c;
  void plate; void address; void pickupInstructions;
  return {
    ...rest,
    latitude: exact ? latitude : fuzz(latitude, c.id),
    longitude: exact ? longitude : fuzz(longitude, c.id + 'x'),
    owner: publicUser(owner),
  };
};

async function isAvailable(carId: string, start: Date, end: Date, excludeBookingId?: string) {
  const [b, u] = await Promise.all([
    prisma.booking.count({
      where: {
        carId,
        id: excludeBookingId ? { not: excludeBookingId } : undefined,
        status: { in: [...BLOCKING_STATUSES] },
        startAt: { lt: end },
        endAt: { gt: start },
      },
    }),
    prisma.unavailability.count({ where: { carId, startAt: { lt: end }, endAt: { gt: start } } }),
  ]);
  return b === 0 && u === 0;
}
export { isAvailable };

/**
 * Recherche : ville ou coordonnées + rayon, dates, filtres, tri.
 * GET /api/cars?lat&lng&radius&city&start&end&category&transmission&fuel&minSeats&maxPrice&minPrice
 *   &instant&delivery&features=a,b&sort=price_asc|price_desc|distance|rating|newest&page
 */
r.get('/', optionalAuth, ah(async (req, res) => {
  const q = req.query as Record<string, string | undefined>;
  const where: Prisma.CarWhereInput = { status: 'ACTIVE' };
  if (q.city) where.city = { equals: q.city, mode: 'insensitive' };
  if (q.category) where.category = { in: q.category.split(',') as never };
  if (q.transmission) where.transmission = q.transmission as never;
  if (q.fuel) where.fuel = { in: q.fuel.split(',') as never };
  if (q.minSeats) where.seats = { gte: Number(q.minSeats) };
  if (q.instant === 'true') where.instantBooking = true;
  if (q.delivery === 'true') where.deliveryAvailable = true;
  if (q.unlimitedKm === 'true') where.unlimitedKm = true;
  if (q.features) where.features = { hasEvery: q.features.split(',') };
  if (q.minYear) where.year = { gte: Number(q.minYear) };
  if (q.minPrice || q.maxPrice) where.pricePerDay = { gte: q.minPrice ? Number(q.minPrice) : undefined, lte: q.maxPrice ? Number(q.maxPrice) : undefined };
  if (q.ownerType === 'pro') where.owner = { isPro: true };
  if (q.ownerType === 'private') where.owner = { isPro: false };
  const lat = q.lat ? Number(q.lat) : null;
  const lng = q.lng ? Number(q.lng) : null;
  const radius = Number(q.radius || 30);
  if (lat != null && lng != null) {
    const dLat = radius / 111;
    const dLng = radius / (111 * Math.cos((lat * Math.PI) / 180));
    where.latitude = { gte: lat - dLat, lte: lat + dLat };
    where.longitude = { gte: lng - dLng, lte: lng + dLng };
    delete where.city;
  }
  const start = parseDate(q.start);
  const end = parseDate(q.end);
  if (start && end) {
    if (end <= start) throw badRequest('INVALID_DATES');
    where.bookings = { none: { status: { in: [...BLOCKING_STATUSES] }, startAt: { lt: end }, endAt: { gt: start } } };
    where.unavailabilities = { none: { startAt: { lt: end }, endAt: { gt: start } } };
    const days = Math.ceil((end.getTime() - start.getTime()) / 86400000);
    where.minDays = { lte: days };
    where.maxDays = { gte: days };
  }
  const cars = await prisma.car.findMany({ where, include: { ...publicCarInclude, priceOverrides: !!(start && end) }, take: 500 });
  const settings = await getSettings();
  let list = cars.map((c) => {
    const distance = lat != null && lng != null ? distanceKm(lat, lng, c.latitude, c.longitude) : null;
    const quote = start && end ? computeQuote({ car: c, start, end, settings }) : null;
    return { ...publicCar(c), distanceKm: distance, quote: quote && { days: quote.days, rentalPrice: quote.rentalPrice, totalPrice: quote.totalPrice } };
  });
  if (lat != null && lng != null) list = list.filter((c) => (c.distanceKm ?? 0) <= radius);
  const price = (c: (typeof list)[number]) => c.quote?.rentalPrice ?? c.pricePerDay;
  switch (q.sort) {
    case 'price_asc': list.sort((a, b) => price(a) - price(b)); break;
    case 'price_desc': list.sort((a, b) => price(b) - price(a)); break;
    case 'rating': list.sort((a, b) => b.ratingAvg - a.ratingAvg || b.ratingCount - a.ratingCount); break;
    case 'newest': list.sort((a, b) => +b.createdAt - +a.createdAt); break;
    default: if (lat != null) list.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
      else list.sort((a, b) => b.ratingCount - a.ratingCount);
  }
  const page = Math.max(1, Number(q.page || 1));
  const pageSize = Math.min(100, Number(q.pageSize || 30));
  let favorites = new Set<string>();
  if (req.user) {
    const favs = await prisma.favorite.findMany({ where: { userId: req.user.id }, select: { carId: true } });
    favorites = new Set(favs.map((f) => f.carId));
  }
  res.json({
    total: list.length,
    page,
    items: list.slice((page - 1) * pageSize, page * pageSize).map((c) => ({ ...c, isFavorite: favorites.has(c.id) })),
  });
}));

/** Villes disponibles (avec nombre de voitures). */
r.get('/meta/cities', ah(async (_req, res) => {
  const rows = await prisma.car.groupBy({ by: ['city'], where: { status: 'ACTIVE' }, _count: true, orderBy: { _count: { city: 'desc' } } });
  res.json(rows.map((x) => ({ city: x.city, count: x._count })));
}));

r.get('/meta/suggest-price', ah(async (req, res) => {
  const { category, year, city } = req.query as Record<string, string>;
  res.json(suggestPrice(category, Number(year) || new Date().getFullYear(), city || ''));
}));

/** Mes voitures (propriétaire). */
r.get('/mine/list', requireAuth, ah(async (req, res) => {
  const cars = await prisma.car.findMany({
    where: { ownerId: me(req).id, status: { not: 'ARCHIVED' } },
    include: { photos: { orderBy: { position: 'asc' } }, _count: { select: { bookings: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(cars);
}));

r.get('/:id', optionalAuth, ah(async (req, res) => {
  const car = await prisma.car.findUnique({ where: { id: req.params.id }, include: publicCarInclude });
  if (!car) throw notFound();
  const isOwner = req.user?.id === car.ownerId;
  if (car.status !== 'ACTIVE' && !isOwner && req.user?.role !== 'ADMIN') throw notFound();
  const [reviews, booked, unav, fav, hasBooking] = await Promise.all([
    prisma.review.findMany({
      where: { carId: car.id, role: 'DRIVER_TO_OWNER', hidden: false },
      include: { author: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.booking.findMany({
      where: { carId: car.id, status: { in: [...BLOCKING_STATUSES] }, endAt: { gt: new Date() } },
      select: { startAt: true, endAt: true },
    }),
    prisma.unavailability.findMany({ where: { carId: car.id, endAt: { gt: new Date() } }, select: { startAt: true, endAt: true } }),
    req.user ? prisma.favorite.findUnique({ where: { userId_carId: { userId: req.user.id, carId: car.id } } }) : null,
    req.user ? prisma.booking.count({ where: { carId: car.id, driverId: req.user.id, status: { in: ['CONFIRMED', 'IN_PROGRESS'] } } }) : 0,
  ]);
  const base = isOwner ? { ...car, owner: publicUser(car.owner) } : publicCar(car, hasBooking > 0);
  res.json({
    ...base,
    isOwner,
    isFavorite: !!fav,
    unavailable: [...booked, ...unav],
    reviews: reviews.map((rv) => ({ ...rv, author: publicUser(rv.author) })),
  });
}));

r.post('/', requireAuth, ah(async (req, res) => {
  const { photos, ...data } = carSchema.parse(req.body);
  const car = await prisma.car.create({
    data: {
      ...data,
      ownerId: me(req).id,
      status: 'PENDING_REVIEW',
      photos: photos ? { create: photos.map((url, position) => ({ url, position })) } : undefined,
    },
    include: { photos: true },
  });
  res.status(201).json(car);
}));

async function ownCar(carId: string, userId: string) {
  const car = await prisma.car.findUnique({ where: { id: carId } });
  if (!car) throw notFound();
  if (car.ownerId !== userId) throw forbidden();
  return car;
}

r.patch('/:id', requireAuth, ah(async (req, res) => {
  const car = await ownCar(req.params.id, me(req).id);
  const { photos, ...data } = carSchema.partial().parse(req.body);
  // Les modifications d'identité du véhicule repassent en modération
  const needsReview = ['make', 'model', 'year', 'plate'].some((k) => k in data) && car.status === 'ACTIVE';
  const updated = await prisma.$transaction(async (tx) => {
    if (photos) {
      await tx.carPhoto.deleteMany({ where: { carId: car.id } });
      await tx.carPhoto.createMany({ data: photos.map((url, position) => ({ carId: car.id, url, position })) });
    }
    return tx.car.update({
      where: { id: car.id },
      data: { ...data, ...(needsReview ? { status: 'PENDING_REVIEW' } : {}) },
      include: { photos: { orderBy: { position: 'asc' } } },
    });
  });
  res.json(updated);
}));

/** Mettre en pause / réactiver / archiver une annonce. */
r.post('/:id/status', requireAuth, ah(async (req, res) => {
  const car = await ownCar(req.params.id, me(req).id);
  const { status } = z.object({ status: z.enum(['ACTIVE', 'PAUSED', 'ARCHIVED']) }).parse(req.body);
  if (status === 'ACTIVE' && !['PAUSED'].includes(car.status)) throw badRequest('CANNOT_ACTIVATE');
  if (status === 'ARCHIVED') {
    const future = await prisma.booking.count({ where: { carId: car.id, status: { in: ['REQUESTED', ...BLOCKING_STATUSES] } } });
    if (future) throw badRequest('ACTIVE_BOOKINGS');
  }
  res.json(await prisma.car.update({ where: { id: car.id }, data: { status } }));
}));

/** Documents du véhicule (carte grise, assurance, visite technique). */
r.post('/:id/documents', requireAuth, ah(async (req, res) => {
  const car = await ownCar(req.params.id, me(req).id);
  const body = z.object({ type: z.enum(['CAR_REGISTRATION', 'CAR_INSURANCE', 'CAR_INSPECTION']), url: z.string().url(), expiresAt: z.coerce.date().optional() }).parse(req.body);
  await prisma.document.deleteMany({ where: { carId: car.id, type: body.type } });
  res.status(201).json(await prisma.document.create({ data: { carId: car.id, ...body } }));
}));

r.get('/:id/documents', requireAuth, ah(async (req, res) => {
  const car = await ownCar(req.params.id, me(req).id);
  res.json(await prisma.document.findMany({ where: { carId: car.id } }));
}));

/** Calendrier : indisponibilités + prix par jour. */
r.get('/:id/calendar', requireAuth, ah(async (req, res) => {
  const car = await ownCar(req.params.id, me(req).id);
  const [unavailabilities, overrides, bookings] = await Promise.all([
    prisma.unavailability.findMany({ where: { carId: car.id, endAt: { gt: new Date(Date.now() - 30 * 86400000) } }, orderBy: { startAt: 'asc' } }),
    prisma.priceOverride.findMany({ where: { carId: car.id, date: { gte: new Date(Date.now() - 86400000) } }, orderBy: { date: 'asc' } }),
    prisma.booking.findMany({
      where: { carId: car.id, status: { in: ['REQUESTED', ...BLOCKING_STATUSES] }, endAt: { gt: new Date(Date.now() - 30 * 86400000) } },
      include: { driver: true },
      orderBy: { startAt: 'asc' },
    }),
  ]);
  res.json({
    pricePerDay: car.pricePerDay,
    unavailabilities,
    overrides,
    bookings: bookings.map((b) => ({ id: b.id, reference: b.reference, startAt: b.startAt, endAt: b.endAt, status: b.status, driver: publicUser(b.driver) })),
  });
}));

r.post('/:id/unavailability', requireAuth, ah(async (req, res) => {
  const car = await ownCar(req.params.id, me(req).id);
  const body = z.object({ startAt: z.coerce.date(), endAt: z.coerce.date(), note: z.string().max(200).optional() }).parse(req.body);
  if (body.endAt <= body.startAt) throw badRequest('INVALID_DATES');
  if (!(await isAvailable(car.id, body.startAt, body.endAt))) throw badRequest('OVERLAPS_BOOKING');
  res.status(201).json(await prisma.unavailability.create({ data: { carId: car.id, ...body } }));
}));

r.delete('/:id/unavailability/:uid', requireAuth, ah(async (req, res) => {
  const car = await ownCar(req.params.id, me(req).id);
  await prisma.unavailability.deleteMany({ where: { id: req.params.uid, carId: car.id } });
  res.json({ ok: true });
}));

r.put('/:id/prices', requireAuth, ah(async (req, res) => {
  const car = await ownCar(req.params.id, me(req).id);
  const body = z.object({ dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(366), price: z.number().int().min(50).nullable() }).parse(req.body);
  for (const d of body.dates) {
    const date = new Date(d + 'T00:00:00Z');
    if (body.price == null) await prisma.priceOverride.deleteMany({ where: { carId: car.id, date } });
    else await prisma.priceOverride.upsert({ where: { carId_date: { carId: car.id, date } }, create: { carId: car.id, date, price: body.price }, update: { price: body.price } });
  }
  res.json({ ok: true });
}));

export default r;
