import { Router } from 'express';
import { prisma } from '../db.js';
import { ah, notFound } from '../middleware/error.js';
import { getSettings } from '../lib/settings.js';
import { cmiEnabled } from '../lib/cmi.js';

/** Données publiques : configuration de l'app, assurances, aide. */
const r = Router();

r.get('/config', ah(async (_req, res) => {
  const s = await getSettings();
  const insurancePlans = await prisma.insurancePlan.findMany({ where: { active: true }, orderBy: { position: 'asc' } });
  res.json({
    insurancePlans,
    serviceFeePercent: s.serviceFeePercent,
    supportPhone: s.supportPhone,
    supportEmail: s.supportEmail,
    referralBonusReferee: s.referralBonusReferee,
    referralBonusReferrer: s.referralBonusReferrer,
    paymentMethods: ['CMI', 'WAFACASH', 'CASHPLUS', 'BANK_TRANSFER'],
    cmiLive: cmiEnabled(),
    lateFeePerHour: s.lateFeePerHour,
    commissionPercent: s.commissionPercent,
  });
}));

r.get('/help', ah(async (req, res) => {
  const locale = ['fr', 'ar', 'en'].includes(String(req.query.locale)) ? String(req.query.locale) : 'fr';
  res.json(await prisma.helpArticle.findMany({
    where: { locale, published: true },
    select: { id: true, slug: true, category: true, title: true, position: true },
    orderBy: [{ category: 'asc' }, { position: 'asc' }],
  }));
}));

r.get('/help/:slug', ah(async (req, res) => {
  const locale = ['fr', 'ar', 'en'].includes(String(req.query.locale)) ? String(req.query.locale) : 'fr';
  const a = (await prisma.helpArticle.findUnique({ where: { slug_locale: { slug: req.params.slug, locale } } }))
    || (await prisma.helpArticle.findUnique({ where: { slug_locale: { slug: req.params.slug, locale: 'fr' } } }));
  if (!a) throw notFound();
  res.json(a);
}));

r.post('/promo/check', ah(async (req, res) => {
  const p = await prisma.promoCode.findUnique({ where: { code: String(req.body?.code || '').toUpperCase().trim() } });
  const now = new Date();
  const valid = !!p && p.active && (!p.validFrom || p.validFrom <= now) && (!p.validTo || p.validTo >= now) && (p.maxUses == null || p.usedCount < p.maxUses);
  res.json(valid ? { valid, type: p!.type, value: p!.value } : { valid: false });
}));

export default r;
