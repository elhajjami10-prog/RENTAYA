import crypto from 'node:crypto';
import { config } from '../config.js';

/**
 * Intégration CMI (Centre Monétique Interbancaire) — mode 3D_PAY_HOSTING, hash ver3.
 * Le client est redirigé vers la page de paiement CMI via un formulaire auto-soumis.
 * Le CMI appelle ensuite `callbackUrl` (serveur à serveur) puis redirige vers okUrl / failUrl.
 */

const escapeVal = (v: string) => v.replace(/\\/g, '\\\\').replace(/\|/g, '\\|');

export function cmiHash(params: Record<string, string>, storeKey: string) {
  const keys = Object.keys(params)
    .filter((k) => !['hash', 'encoding'].includes(k.toLowerCase()))
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  const plain = keys.map((k) => escapeVal(String(params[k] ?? '').trim())).join('|') + '|' + escapeVal(storeKey);
  return crypto.createHash('sha512').update(plain, 'utf8').digest('base64');
}

export const cmiEnabled = () => Boolean(config.cmi.clientId && config.cmi.storeKey);

export function buildCmiForm(o: {
  orderId: string;
  amount: number; // MAD
  email: string;
  name: string;
  phone?: string | null;
  lang: string;
}) {
  const params: Record<string, string> = {
    clientid: config.cmi.clientId,
    amount: o.amount.toFixed(2),
    okUrl: `${config.publicApiUrl}/api/payments/cmi/return?status=ok&oid=${o.orderId}`,
    failUrl: `${config.publicApiUrl}/api/payments/cmi/return?status=fail&oid=${o.orderId}`,
    callbackUrl: `${config.publicApiUrl}/api/payments/cmi/callback`,
    shopurl: config.publicAppUrl,
    TranType: 'PreAuth',
    currency: '504', // MAD
    rnd: Date.now().toString(),
    storetype: '3D_PAY_HOSTING',
    hashAlgorithm: 'ver3',
    lang: ['fr', 'ar', 'en'].includes(o.lang) ? o.lang : 'fr',
    refreshtime: '5',
    oid: o.orderId,
    BillToName: o.name,
    email: o.email,
    tel: o.phone || '',
    encoding: 'UTF-8',
    AutoRedirect: 'true',
  };
  params.hash = cmiHash(params, config.cmi.storeKey);
  const inputs = Object.entries(params)
    .map(([k, v]) => `<input type="hidden" name="${k}" value="${v.replace(/"/g, '&quot;')}"/>`)
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Rentaya — Paiement</title></head>
<body style="font-family:sans-serif;text-align:center;padding:40px;color:#2A0B4D">
<p>Redirection vers la page de paiement sécurisée CMI…</p>
<form id="f" method="post" action="${config.cmi.gatewayUrl}">${inputs}<noscript><button>Continuer</button></noscript></form>
<script>document.getElementById('f').submit()</script></body></html>`;
}

export function verifyCmiCallback(body: Record<string, string>) {
  if (!body.HASH && !body.hash) return false;
  const received = body.HASH || body.hash;
  const computed = cmiHash(body, config.cmi.storeKey);
  return received === computed;
}
