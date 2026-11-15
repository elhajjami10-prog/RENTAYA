import { Router, urlencoded } from 'express';
import { z } from 'zod';
import type { PaymentMethod, PaymentType, Prisma, User } from '@prisma/client';
import { prisma } from '../db.js';
import { ah, badRequest, forbidden, notFound } from '../middleware/error.js';
import { me, requireAuth } from '../middleware/auth.js';
import { buildCmiForm, cmiEnabled, verifyCmiCallback } from '../lib/cmi.js';
import { onPaymentPaid } from '../lib/bookingService.js';
import { genRef } from '../lib/util.js';
import { config } from '../config.js';
import { getSettings } from '../lib/settings.js';

const r = Router();

/** Seules ces URLs de retour sont autorisées après paiement (anti open-redirect). */
const safeRedirect = (url?: string | null) =>
  url && (url.startsWith('rentaya://') || url.startsWith('exp://') || url.startsWith(config.publicAppUrl)) ? url : null;

export async function startPayment(o: {
  user: User;
  bookingId: string;
  type: PaymentType;
  method: Exclude<PaymentMethod, 'WALLET' | 'CASH'>;
  amount: number;
  extensionId?: string;
  chargeId?: string;
  redirect?: string;
}) {
  if (o.amount <= 0) throw badRequest('INVALID_AMOUNT');
  // Un seul paiement en cours par objet
  await prisma.payment.updateMany({
    where: { bookingId: o.bookingId, type: o.type, extensionId: o.extensionId ?? null, chargeId: o.chargeId ?? null, status: 'PENDING' },
    data: { status: 'CANCELLED' },
  });
  const payment = await prisma.payment.create({
    data: {
      bookingId: o.bookingId,
      userId: o.user.id,
      type: o.type,
      method: o.method,
      amount: o.amount,
      orderId: genRef('PAY'),
      extensionId: o.extensionId,
      chargeId: o.chargeId,
      raw: { redirect: safeRedirect(o.redirect) } as Prisma.InputJsonValue,
    },
  });
  if (o.method === 'CMI') {
    return {
      paymentId: payment.id,
      method: 'CMI',
      amount: o.amount,
      // URL à ouvrir dans le navigateur (formulaire auto-soumis vers la page sécurisée CMI)
      redirectUrl: `${config.publicApiUrl}/api/payments/cmi/${payment.orderId}/form`,
    };
  }
  const s = await getSettings();
  return {
    paymentId: payment.id,
    method: o.method,
    amount: o.amount,
    reference: payment.orderId,
    instructions: {
      WAFACASH: `Effectuez un transfert Wafacash de ${o.amount} MAD au bénéficiaire « ${s.bankTransferHolder} » en indiquant la référence ${payment.orderId}, puis envoyez la photo du reçu.`,
      CASHPLUS: `Effectuez un paiement Cash Plus de ${o.amount} MAD au bénéficiaire « ${s.bankTransferHolder} » avec la référence ${payment.orderId}, puis envoyez la photo du reçu.`,
      BANK_TRANSFER: `Effectuez un virement de ${o.amount} MAD sur le RIB ${s.bankTransferRib} (${s.bankTransferHolder}) avec la référence ${payment.orderId}, puis envoyez la preuve de virement.`,
    }[o.method],
  };
}

/** Page de paiement : redirige vers le CMI (ou simulateur en développement). */
r.get('/cmi/:orderId/form', ah(async (req, res) => {
  const p = await prisma.payment.findUnique({ where: { orderId: req.params.orderId }, include: { user: true } });
  if (!p || p.method !== 'CMI') throw notFound();
  if (p.status !== 'PENDING') return res.redirect(returnUrl(p, p.status === 'PAID' ? 'ok' : 'fail'));
  if (cmiEnabled()) {
    return res.type('html').send(buildCmiForm({
      orderId: p.orderId, amount: p.amount, email: p.user.email,
      name: `${p.user.firstName} ${p.user.lastName}`, phone: p.user.phone, lang: p.user.language,
    }));
  }
  if (config.isProd) throw badRequest('CMI_NOT_CONFIGURED');
  // Simulateur (développement uniquement — aucune donnée bancaire n'est saisie)
  res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Paiement test</title></head>
<body style="font-family:sans-serif;max-width:420px;margin:40px auto;padding:16px;color:#2A0B4D;text-align:center">
<h2 style="color:#6A1BD0">Rentaya — simulateur CMI</h2><p>Mode développement : renseignez CMI_CLIENT_ID et CMI_STORE_KEY pour activer le vrai paiement.</p>
<p style="font-size:28px;font-weight:bold">${p.amount} MAD</p>
<form method="post" action="/api/payments/dev/${p.orderId}/ok"><button style="background:#6A1BD0;color:#fff;border:0;padding:14px 28px;border-radius:12px;font-size:16px">Simuler un paiement accepté</button></form>
<form method="post" action="/api/payments/dev/${p.orderId}/fail" style="margin-top:12px"><button style="background:none;border:1px solid #ccc;padding:10px 20px;border-radius:12px">Simuler un refus</button></form></body></html>`);
}));

function returnUrl(p: { orderId: string; bookingId: string | null; raw: unknown }, status: 'ok' | 'fail') {
  const redirect = safeRedirect((p.raw as { redirect?: string } | null)?.redirect);
  const base = redirect || `${config.publicAppUrl}/payment-result`;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}status=${status}&bookingId=${p.bookingId ?? ''}&oid=${p.orderId}`;
}

if (!config.isProd) {
  r.post('/dev/:orderId/:result(ok|fail)', ah(async (req, res) => {
    if (cmiEnabled()) throw forbidden();
    const p = await prisma.payment.findUnique({ where: { orderId: req.params.orderId } });
    if (!p) throw notFound();
    if (req.params.result === 'ok') await onPaymentPaid(p);
    else await prisma.payment.update({ where: { id: p.id }, data: { status: 'FAILED' } });
    res.redirect(returnUrl(p, req.params.result as 'ok' | 'fail'));
  }));
}

/** Callback serveur à serveur du CMI. */
r.post('/cmi/callback', urlencoded({ extended: false }), ah(async (req, res) => {
  const body = req.body as Record<string, string>;
  if (!verifyCmiCallback(body)) return res.send('FAILURE');
  const p = await prisma.payment.findUnique({ where: { orderId: body.oid } });
  if (!p) return res.send('FAILURE');
  const approved = body.ProcReturnCode === '00' && body.Response === 'Approved';
  const amountOk = Math.abs(Number(body.amount) - p.amount) < 0.01;
  await prisma.payment.update({ where: { id: p.id }, data: { raw: { ...(p.raw as object), callback: body }, providerRef: body.TransId } });
  if (approved && amountOk) {
    await onPaymentPaid(p);
    return res.send('ACTION=POSTAUTH');
  }
  await prisma.payment.update({ where: { id: p.id }, data: { status: 'FAILED' } });
  res.send('APPROVED');
}));

/** Retour navigateur après la page CMI. */
r.all('/cmi/return', urlencoded({ extended: false }), ah(async (req, res) => {
  const oid = String(req.query.oid || (req.body as Record<string, string>)?.oid || '');
  const p = await prisma.payment.findUnique({ where: { orderId: oid } });
  if (!p) return res.redirect(`${config.publicAppUrl}/payment-result?status=fail`);
  const fresh = await prisma.payment.findUniqueOrThrow({ where: { id: p.id } });
  res.redirect(returnUrl(fresh, fresh.status === 'PAID' ? 'ok' : 'fail'));
}));

r.use(requireAuth);

/** Envoi de la preuve de paiement (Wafacash, Cash Plus, virement). */
r.post('/:id/proof', ah(async (req, res) => {
  const { proofUrl } = z.object({ proofUrl: z.string().url() }).parse(req.body);
  const p = await prisma.payment.findUnique({ where: { id: req.params.id } });
  if (!p || p.userId !== me(req).id) throw notFound();
  if (!['PENDING', 'AWAITING_VALIDATION'].includes(p.status) || p.method === 'CMI') throw badRequest('INVALID_STATUS');
  res.json(await prisma.payment.update({ where: { id: p.id }, data: { proofUrl, status: 'AWAITING_VALIDATION' } }));
}));

r.get('/:id', ah(async (req, res) => {
  const p = await prisma.payment.findUnique({ where: { id: req.params.id } });
  if (!p || p.userId !== me(req).id) throw notFound();
  res.json(p);
}));

/** Historique des paiements de l'utilisateur. */
r.get('/', ah(async (req, res) => {
  res.json(await prisma.payment.findMany({
    where: { userId: me(req).id, status: { not: 'CANCELLED' } },
    include: { booking: { select: { reference: true, car: { select: { make: true, model: true } } } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  }));
}));

export default r;
