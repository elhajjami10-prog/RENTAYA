import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../db.js';
import { ah, badRequest, HttpError } from '../middleware/error.js';
import { me, requireAuth, signToken } from '../middleware/auth.js';
import { genCode, privateUser } from '../lib/util.js';
import { getSettings } from '../lib/settings.js';
import { notify, sendEmail, sendSms } from '../lib/notify.js';
import { config } from '../config.js';

const r = Router();

const phoneRe = /^\+?[0-9 ]{9,15}$/;

const registerSchema = z.object({
  email: z.string().email().transform((s) => s.toLowerCase().trim()),
  password: z.string().min(8),
  firstName: z.string().min(1).max(60),
  lastName: z.string().min(1).max(60),
  phone: z.string().regex(phoneRe).optional(),
  language: z.enum(['fr', 'ar', 'en']).default('fr'),
  referralCode: z.string().optional(),
});

const normPhone = (p?: string) => {
  if (!p) return undefined;
  let s = p.replace(/\s/g, '');
  if (s.startsWith('0')) s = '+212' + s.slice(1);
  if (!s.startsWith('+')) s = '+' + s;
  return s;
};

r.post('/register', ah(async (req, res) => {
  const body = registerSchema.parse(req.body);
  const phone = normPhone(body.phone);
  if (await prisma.user.findUnique({ where: { email: body.email } })) throw badRequest('EMAIL_TAKEN');
  if (phone && (await prisma.user.findUnique({ where: { phone } }))) throw badRequest('PHONE_TAKEN');
  let referredById: string | undefined;
  if (body.referralCode) {
    const ref = await prisma.user.findUnique({ where: { referralCode: body.referralCode.toUpperCase() } });
    if (!ref) throw badRequest('INVALID_REFERRAL');
    referredById = ref.id;
  }
  const s = await getSettings();
  const user = await prisma.user.create({
    data: {
      email: body.email,
      phone,
      passwordHash: await bcrypt.hash(body.password, 10),
      firstName: body.firstName,
      lastName: body.lastName,
      language: body.language,
      referralCode: genCode(7),
      referredById,
      walletBalance: referredById ? s.referralBonusReferee : 0,
    },
  });
  if (referredById) {
    await prisma.walletTransaction.create({
      data: { userId: user.id, type: 'REFERRAL_BONUS', amount: s.referralBonusReferee, note: 'Bonus de parrainage' },
    });
  }
  await notify(user.id, 'WELCOME', 'Bienvenue sur Rentaya !', 'Complétez votre profil pour louer ou proposer une voiture.');
  res.status(201).json({ token: signToken(user.id), user: privateUser(user) });
}));

r.post('/login', ah(async (req, res) => {
  const { email, password } = z.object({ email: z.string(), password: z.string() }).parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) throw new HttpError(401, 'INVALID_CREDENTIALS');
  if (user.suspended) throw new HttpError(403, 'ACCOUNT_SUSPENDED');
  res.json({ token: signToken(user.id), user: privateUser(user) });
}));

r.get('/me', requireAuth, ah(async (req, res) => {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: me(req).id }, include: { documents: true } });
  const { documents, ...rest } = u;
  res.json({ ...privateUser(rest), documents });
}));

r.post('/forgot-password', ah(async (req, res) => {
  const { email } = z.object({ email: z.string().email() }).parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (user) {
    const token = String(crypto.randomInt(100000, 999999));
    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: token, resetTokenExpires: new Date(Date.now() + 30 * 60_000) },
    });
    await sendEmail(user.email, 'Réinitialisation du mot de passe', `Votre code Rentaya : ${token} (valable 30 minutes)`);
  }
  res.json({ ok: true, ...(config.isProd ? {} : { devHint: 'Code affiché dans la console du serveur' }) });
}));

r.post('/reset-password', ah(async (req, res) => {
  const { email, code, password } = z.object({ email: z.string().email(), code: z.string(), password: z.string().min(8) }).parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || user.resetToken !== code || !user.resetTokenExpires || user.resetTokenExpires < new Date()) throw badRequest('INVALID_CODE');
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(password, 10), resetToken: null, resetTokenExpires: null },
  });
  res.json({ token: signToken(user.id) });
}));

r.post('/change-password', requireAuth, ah(async (req, res) => {
  const { current, password } = z.object({ current: z.string(), password: z.string().min(8) }).parse(req.body);
  if (!(await bcrypt.compare(current, me(req).passwordHash))) throw badRequest('WRONG_PASSWORD');
  await prisma.user.update({ where: { id: me(req).id }, data: { passwordHash: await bcrypt.hash(password, 10) } });
  res.json({ ok: true });
}));

r.post('/phone/send-otp', requireAuth, ah(async (req, res) => {
  const { phone } = z.object({ phone: z.string().regex(phoneRe) }).parse(req.body);
  const p = normPhone(phone)!;
  const other = await prisma.user.findUnique({ where: { phone: p } });
  if (other && other.id !== me(req).id) throw badRequest('PHONE_TAKEN');
  const otp = String(crypto.randomInt(100000, 999999));
  await prisma.user.update({
    where: { id: me(req).id },
    data: { phone: p, phoneVerified: false, phoneOtp: otp, phoneOtpExpires: new Date(Date.now() + 10 * 60_000) },
  });
  await sendSms(p, `Rentaya : votre code de vérification est ${otp}`);
  res.json({ ok: true });
}));

r.post('/phone/verify', requireAuth, ah(async (req, res) => {
  const { code } = z.object({ code: z.string() }).parse(req.body);
  const u = me(req);
  if (!u.phoneOtp || u.phoneOtp !== code || !u.phoneOtpExpires || u.phoneOtpExpires < new Date()) throw badRequest('INVALID_CODE');
  const user = await prisma.user.update({ where: { id: u.id }, data: { phoneVerified: true, phoneOtp: null, phoneOtpExpires: null } });
  res.json(privateUser(user));
}));

r.post('/push-token', requireAuth, ah(async (req, res) => {
  const { token } = z.object({ token: z.string().nullable() }).parse(req.body);
  await prisma.user.update({ where: { id: me(req).id }, data: { pushToken: token } });
  res.json({ ok: true });
}));

r.delete('/me', requireAuth, ah(async (req, res) => {
  const active = await prisma.booking.count({
    where: {
      OR: [{ driverId: me(req).id }, { ownerId: me(req).id }],
      status: { in: ['REQUESTED', 'PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS'] },
    },
  });
  if (active) throw badRequest('ACTIVE_BOOKINGS');
  // Anonymisation (les réservations passées sont conservées pour la comptabilité)
  await prisma.car.updateMany({ where: { ownerId: me(req).id }, data: { status: 'ARCHIVED' } });
  await prisma.user.update({
    where: { id: me(req).id },
    data: {
      email: `deleted-${me(req).id}@rentaya.ma`, phone: null, firstName: 'Utilisateur', lastName: 'supprimé',
      avatarUrl: null, suspended: true, pushToken: null, rib: null, bankHolder: null, cinNumber: null, licenseNumber: null,
    },
  });
  res.json({ ok: true });
}));

export default r;
