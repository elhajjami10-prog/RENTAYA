import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { ah, badRequest, notFound } from '../middleware/error.js';
import { me, requireAuth } from '../middleware/auth.js';
import { upload, fileUrl } from '../middleware/upload.js';
import { privateUser, publicUser } from '../lib/util.js';

const r = Router();

const profileSchema = z.object({
  firstName: z.string().min(1).max(60).optional(),
  lastName: z.string().min(1).max(60).optional(),
  birthDate: z.coerce.date().nullable().optional(),
  address: z.string().max(200).nullable().optional(),
  city: z.string().max(80).nullable().optional(),
  bio: z.string().max(1000).nullable().optional(),
  language: z.enum(['fr', 'ar', 'en']).optional(),
  avatarUrl: z.string().url().nullable().optional(),
  licenseNumber: z.string().max(40).nullable().optional(),
  licenseIssueDate: z.coerce.date().nullable().optional(),
  licenseCountry: z.string().max(60).nullable().optional(),
  cinNumber: z.string().max(20).nullable().optional(),
  isPro: z.boolean().optional(),
  companyName: z.string().max(120).nullable().optional(),
  companyIce: z.string().max(20).nullable().optional(),
  bankHolder: z.string().max(120).nullable().optional(),
  bankName: z.string().max(80).nullable().optional(),
  rib: z.string().regex(/^[0-9 ]{24,30}$/).nullable().optional(),
  notifyEmail: z.boolean().optional(),
  notifySms: z.boolean().optional(),
  notifyPush: z.boolean().optional(),
});

r.patch('/me', requireAuth, ah(async (req, res) => {
  const data = profileSchema.parse(req.body);
  const u = await prisma.user.update({ where: { id: me(req).id }, data });
  res.json(privateUser(u));
}));

/** Upload générique (photos de voiture, avatar, état des lieux, preuves…). */
r.post('/uploads', requireAuth, upload.array('files', 20), ah(async (req, res) => {
  const files = (req.files as Express.Multer.File[]) || [];
  if (!files.length) throw badRequest('NO_FILE');
  res.json({ urls: files.map((f) => fileUrl(f.filename)) });
}));

/** Documents de vérification d'identité / permis. */
r.post('/me/documents', requireAuth, ah(async (req, res) => {
  const body = z.object({
    type: z.enum(['ID_FRONT', 'ID_BACK', 'PASSPORT', 'LICENSE_FRONT', 'LICENSE_BACK', 'SELFIE']),
    url: z.string().url(),
  }).parse(req.body);
  await prisma.document.deleteMany({ where: { userId: me(req).id, type: body.type } });
  const doc = await prisma.document.create({ data: { userId: me(req).id, type: body.type, url: body.url } });
  res.status(201).json(doc);
}));

/** Soumet le profil pour vérification (pièce d'identité + permis + selfie). */
r.post('/me/verification', requireAuth, ah(async (req, res) => {
  const docs = await prisma.document.findMany({ where: { userId: me(req).id } });
  const has = (t: string) => docs.some((d) => d.type === t);
  const idOk = (has('ID_FRONT') && has('ID_BACK')) || has('PASSPORT');
  const licOk = has('LICENSE_FRONT') && has('LICENSE_BACK');
  if (!idOk || !licOk || !has('SELFIE')) throw badRequest('MISSING_DOCUMENTS');
  const u = me(req);
  if (!u.licenseNumber || !u.licenseIssueDate || !u.birthDate) throw badRequest('MISSING_LICENSE_INFO');
  const updated = await prisma.user.update({ where: { id: u.id }, data: { verificationStatus: 'PENDING', verificationNote: null } });
  res.json(privateUser(updated));
}));

r.get('/:id', ah(async (req, res) => {
  const u = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!u || u.suspended) throw notFound();
  const [cars, reviews] = await Promise.all([
    prisma.car.findMany({
      where: { ownerId: u.id, status: 'ACTIVE' },
      include: { photos: { orderBy: { position: 'asc' }, take: 1 } },
    }),
    prisma.review.findMany({
      where: { targetUserId: u.id, hidden: false },
      include: { author: true },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
  ]);
  res.json({
    ...publicUser(u),
    cars,
    reviews: reviews.map((rv) => ({ ...rv, author: publicUser(rv.author) })),
  });
}));

export default r;
