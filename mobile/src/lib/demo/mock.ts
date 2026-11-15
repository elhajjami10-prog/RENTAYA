/**
 * Mode démo : un faux serveur Rentaya qui tourne entièrement dans l'application
 * (données fictives en mémoire, réinitialisées au redémarrage). Activé par EXPO_PUBLIC_DEMO=1.
 * Il reproduit les réponses de l'API réelle pour pouvoir tester l'app sans serveur.
 */
import raw from './data.json';
import images from './images.json';

type Any = Record<string, any>;
class DemoError extends Error {
  constructor(public status: number, public code: string, public details?: unknown) { super(code); }
}
const err = (code: string, status = 400, details?: unknown) => new DemoError(status, code, details);

const DAY = 86400000;
const now = () => new Date();
const iso = (d: Date) => d.toISOString();
let seq = 1;
const id = (p: string) => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`;
const ref = (p: string) => `${p}-DEMO-${String(seq++).padStart(4, '0')}`;

const S = {
  serviceFeePercent: 10, minServiceFee: 20, commissionPercent: 20, ownerCancelPenalty: 200, lateFeePerHour: 50, cleaningFee: 150,
  fuelPricePerLiter: 14, referralBonusReferee: 100, referralBonusReferrer: 100, supportPhone: '+212 5 22 00 00 00', supportEmail: 'support@rentaya.ma',
  bankTransferRib: '000 000 0000000000000000 00', bankTransferHolder: 'RENTAYA SARL',
};

// ---------------- état ----------------
const img = images as Record<string, string>;
const db = {
  users: (raw as Any).users as Any[],
  cars: ((raw as Any).cars as Any[]).map((c): Any => ({ ...c, photos: c.photos.map((p: Any) => ({ ...p, url: img[p.url.slice(4)] || p.url })) })),
  reviews: (raw as Any).reviews as Any[],
  plans: (raw as Any).insurancePlans as Any[],
  help: (raw as Any).help as Any[],
  bookings: [] as Any[], payments: [] as Any[], inspections: [] as Any[], extensions: [] as Any[], charges: [] as Any[], claims: [] as Any[],
  conversations: [] as Any[], messages: [] as Any[], notifications: [] as Any[], favorites: [] as Any[], unav: [] as Any[], overrides: [] as Any[],
  walletTxs: [] as Any[], tickets: [] as Any[], documents: [] as Any[], promos: <Any[]>[
    { code: 'BIENVENUE', type: 'PERCENT', value: 10, maxDiscount: 200, minAmount: 0, firstBookingOnly: true },
    { code: 'RENTAYA50', type: 'FIXED', value: 50, minAmount: 300, firstBookingOnly: false },
  ],
};
const user = (uid: string) => db.users.find((u) => u.id === uid)!;
const byEmail = (e: string) => db.users.find((u) => u.email === e.toLowerCase().trim());
const car = (cid: string) => db.cars.find((c) => c.id === cid);

const publicUser = (u: Any) => ({
  id: u.id, firstName: u.firstName, lastName: u.lastName ? u.lastName[0] + '.' : '', avatarUrl: u.avatarUrl, bio: u.bio, city: u.city,
  isPro: u.isPro, companyName: u.companyName, verified: u.verificationStatus === 'VERIFIED', phoneVerified: u.phoneVerified,
  ratingAvg: u.ratingAvg, ratingCount: u.ratingCount, responseRate: u.responseRate, responseTimeMin: u.responseTimeMin, language: u.language, createdAt: u.createdAt,
});
const privateUser = (u: Any) => ({ ...u, documents: db.documents.filter((d) => d.userId === u.id) });

function notify(userId: string, type: string, title: string, body: string, data?: Any) {
  db.notifications.unshift({ id: id('n'), userId, type, title, body, data, read: false, createdAt: iso(now()) });
}
function sysMsg(bookingId: string, body: string) {
  const c = db.conversations.find((x) => x.bookingId === bookingId);
  if (!c) return;
  db.messages.push({ id: id('m'), conversationId: c.id, senderId: null, body, system: true, readAt: null, createdAt: iso(now()) });
  c.lastMessageAt = iso(now());
}

// ---------------- prix ----------------
const rentalDays = (s: Date, e: Date) => Math.max(1, Math.ceil((e.getTime() - s.getTime()) / DAY));
function dayPrice(c: Any, d: Date) {
  const o = db.overrides.find((x) => x.carId === c.id && x.date === d.toISOString().slice(0, 10));
  if (o) return o.price;
  let p = c.pricePerDay;
  if (c.smartPricing) {
    if ([5, 6].includes(d.getUTCDay())) p *= 1.1;
    if ([6, 7].includes(d.getUTCMonth())) p *= 1.2;
  }
  return Math.round(p);
}
function quote(c: Any, start: Date, end: Date, o: { plan?: Any; delivery?: boolean; promo?: number; wallet?: number } = {}) {
  const days = rentalDays(start, end);
  let basePrice = 0;
  for (let i = 0; i < days; i++) basePrice += dayPrice(c, new Date(start.getTime() + i * DAY));
  const discountPercent = days >= 28 ? c.monthlyDiscount : days >= 7 ? c.weeklyDiscount : 0;
  const discountAmount = Math.round((basePrice * discountPercent) / 100);
  const rentalPrice = basePrice - discountAmount;
  const deliveryFee = o.delivery && c.deliveryAvailable ? c.deliveryPrice : 0;
  const insuranceFee = (o.plan?.pricePerDay || 0) * days;
  const serviceFee = Math.max(S.minServiceFee, Math.round((rentalPrice * S.serviceFeePercent) / 100));
  const gross = rentalPrice + deliveryFee + insuranceFee + serviceFee;
  const promoDiscount = Math.min(o.promo || 0, gross);
  const walletUsed = Math.min(o.wallet || 0, gross - promoDiscount);
  const ownerCommission = Math.round((rentalPrice * S.commissionPercent) / 100);
  const ownerEarnings = rentalPrice - ownerCommission + deliveryFee;
  const totalPrice = gross - promoDiscount - walletUsed;
  return {
    days, pricePerDay: Math.round(basePrice / days), basePrice, discountAmount, discountPercent, rentalPrice, deliveryFee, insuranceFee, serviceFee,
    promoDiscount, walletUsed, totalPrice, commission: totalPrice - ownerEarnings, ownerEarnings, depositAmount: c.depositAmount,
    kmIncluded: c.unlimitedKm ? 0 : c.kmPerDay * days, unlimitedKm: c.unlimitedKm, extraKmPrice: c.extraKmPrice,
  };
}
const BLOCKING = ['PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS'];
const overlaps = (a1: string | Date, a2: string | Date, b1: Date, b2: Date) => new Date(a1) < b2 && new Date(a2) > b1;
const available = (cid: string, s: Date, e: Date, except?: string) =>
  !db.bookings.some((b) => b.carId === cid && b.id !== except && BLOCKING.includes(b.status) && overlaps(b.startAt, b.endAt, s, e)) &&
  !db.unav.some((u) => u.carId === cid && overlaps(u.startAt, u.endAt, s, e));
const dist = (la1: number, lo1: number, la2: number, lo2: number) => {
  const r = (x: number) => (x * Math.PI) / 180;
  const a = Math.sin(r(la2 - la1) / 2) ** 2 + Math.cos(r(la1)) * Math.cos(r(la2)) * Math.sin(r(lo2 - lo1) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(a));
};

// ---------------- données de départ ----------------
function makeBooking(driverId: string, c: Any, start: Date, days: number, status: string, extra: Any = {}) {
  const plan = db.plans[1];
  const q = quote(c, start, new Date(start.getTime() + days * DAY), { plan });
  const b = {
    id: id('b'), reference: ref('RTY'), carId: c.id, driverId, ownerId: c.ownerId, startAt: iso(start), endAt: iso(new Date(start.getTime() + days * DAY)),
    status, instant: c.instantBooking, message: null, ...q, insurancePlanId: plan.id, deliveryAddress: null, promoCode: null,
    paymentMethod: ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].includes(status) ? 'CMI' : null, paidAt: null, acceptedAt: null, cancelledAt: null,
    requestExpiresAt: status === 'REQUESTED' ? iso(new Date(Date.now() + 20 * 3600000)) : null, paymentDueAt: null, refundAmount: 0, ownerPenalty: 0,
    driverReviewed: false, ownerReviewed: false, contractNumber: ref('CTR'), createdAt: iso(now()), ...extra,
  };
  db.bookings.push(b);
  const conv = { id: id('c'), userAId: driverId, userBId: c.ownerId, carId: c.id, bookingId: b.id, lastMessageAt: iso(now()) };
  db.conversations.push(conv);
  db.messages.push(
    { id: id('m'), conversationId: conv.id, senderId: driverId, body: 'Bonjour, la voiture est-elle disponible à ces dates ?', system: false, readAt: iso(now()), createdAt: iso(new Date(Date.now() - 3600000)) },
    { id: id('m'), conversationId: conv.id, senderId: c.ownerId, body: `Bonjour ${user(driverId).firstName}, oui elle est disponible. Au plaisir !`, system: false, readAt: null, createdAt: iso(new Date(Date.now() - 1800000)) },
  );
  if (b.paymentMethod) db.payments.push({ id: id('p'), bookingId: b.id, userId: driverId, type: 'BOOKING', method: 'CMI', status: 'PAID', amount: b.totalPrice, orderId: ref('PAY'), createdAt: iso(now()) });
  return b;
}
(function init() {
  const salma = byEmail('salma@rentaya.ma')!;
  const youssef = byEmail('youssef@rentaya.ma')!;
  const ycars = db.cars.filter((c) => c.ownerId === youssef.id);
  const other = db.cars.filter((c) => c.ownerId !== youssef.id);
  const past = makeBooking(salma.id, ycars[0], new Date(Date.now() - 20 * DAY), 3, 'COMPLETED', { driverReviewed: true, ownerReviewed: true });
  void past;
  makeBooking(salma.id, other[3], new Date(Date.now() + 3 * DAY), 4, 'CONFIRMED');
  const amine = db.users.find((u) => u.email === 'amine@rentaya.ma');
  if (amine) { amine.verificationStatus = 'VERIFIED'; makeBooking(amine.id, ycars[1], new Date(Date.now() + 6 * DAY), 2, 'REQUESTED', { message: 'Bonjour, je souhaite louer votre voiture pour un week-end à Essaouira. Merci !' }); }
  makeBooking(salma.id, ycars[2] || ycars[0], new Date(Date.now() + 12 * DAY), 2, 'REQUESTED');
  for (const c of [db.cars[5], db.cars[12], db.cars[20]]) if (c) db.favorites.push({ userId: salma.id, carId: c.id });
  salma.walletBalance = 100;
  db.users.unshift({ ...youssef, id: 'admin', email: 'admin@rentaya.ma', role: 'ADMIN', firstName: 'Admin', lastName: 'Rentaya', phone: '+212600000001', isPro: false, companyName: null, rib: null, referralCode: 'ADMIN01', ratingAvg: 0, ratingCount: 0 });
  const pics = db.cars.map((x) => x.photos[0].url);
  const nadia = { ...salma, id: 'nadia', email: 'nadia@rentaya.ma', firstName: 'Nadia', lastName: 'Bennani', phone: '+212667000007', city: 'Tanger', verificationStatus: 'PENDING', walletBalance: 0, referralCode: 'NADIA01', ratingAvg: 0, ratingCount: 0, cinNumber: 'K123456', licenseNumber: 'TG998877' };
  db.users.push(nadia);
  for (const [i, t] of ['ID_FRONT', 'ID_BACK', 'LICENSE_FRONT', 'LICENSE_BACK', 'SELFIE'].entries()) db.documents.push({ id: id('d'), userId: nadia.id, type: t, url: pics[i], status: 'PENDING' });
  const pend = { ...ycars[0], id: 'car-pending', make: 'Hyundai', model: 'i10', year: 2020, plate: '55555-ب-40', city: 'Tanger', status: 'PENDING_REVIEW', ownerId: byEmail('mehdi@rentaya.ma')?.id || youssef.id, ratingAvg: 0, ratingCount: 0, tripsCount: 0 };
  db.cars.push(pend);
  db.documents.push({ id: id('d'), carId: pend.id, type: 'CAR_REGISTRATION', url: pics[3], status: 'PENDING' });
  const wb = makeBooking(nadia.id, other[8], new Date(Date.now() + 9 * DAY), 3, 'PENDING_PAYMENT', { paymentMethod: 'WAFACASH' });
  db.payments.push({ id: id('p'), bookingId: wb.id, userId: nadia.id, type: 'BOOKING', method: 'WAFACASH', status: 'AWAITING_VALIDATION', amount: wb.totalPrice, orderId: ref('PAY'), proofUrl: pics[10], createdAt: iso(now()) });
  const done = makeBooking(salma.id, other[10], new Date(Date.now() - 10 * DAY), 2, 'COMPLETED');
  db.charges.push({ id: id('ch'), bookingId: done.id, type: 'FUEL', amount: 280, description: 'Carburant manquant : 2/8', proofUrls: [], status: 'CONTESTED', response: 'J\'ai fait le plein avant de rendre la voiture.', createdAt: iso(now()) });
  db.claims.push({ id: id('cl'), bookingId: done.id, reporterId: done.ownerId, description: 'Rayure sur la portière arrière droite constatée au retour.', photos: [pics[12]], estimate: 1500, status: 'OPEN', createdAt: iso(now()) });
  db.tickets.push({ id: id('t'), userId: salma.id, subject: 'Question sur la caution', body: 'Bonjour, la caution est-elle prélevée sur ma carte ?', status: 'OPEN', createdAt: iso(now()) });
  db.walletTxs.push({ id: id('w'), userId: salma.id, type: 'REFERRAL_BONUS', amount: 100, note: 'Bonus de parrainage', createdAt: iso(new Date(Date.now() - 30 * DAY)) });
  for (const u of db.users) notify(u.id, 'WELCOME', 'Bienvenue sur Rentaya (démo) !', 'Version de démonstration : les données sont fictives et réinitialisées au redémarrage.');
})();

// ---------------- vues ----------------
const carView = (c: Any, viewer?: Any): Any => {
  const isOwner = viewer?.id === c.ownerId;
  const { plate, address, pickupInstructions, ...rest } = c;
  void plate; void address; void pickupInstructions;
  return { ...(isOwner ? c : rest), owner: publicUser(user(c.ownerId)), isFavorite: !!viewer && db.favorites.some((f) => f.userId === viewer.id && f.carId === c.id) };
};
function bookingView(b: Any, viewer: Any) {
  const c = car(b.carId)!;
  const isOwner = b.ownerId === viewer.id;
  const confirmed = ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].includes(b.status);
  const contact = (u: Any) => ({ ...publicUser(u), lastName: u.lastName, phone: confirmed ? u.phone : null });
  return {
    ...b,
    car: confirmed || isOwner ? c : carView(c),
    driver: contact(user(b.driverId)), owner: contact(user(b.ownerId)),
    insurancePlan: db.plans.find((p) => p.id === b.insurancePlanId) || null,
    inspections: db.inspections.filter((x) => x.bookingId === b.id),
    payments: db.payments.filter((x) => x.bookingId === b.id).reverse(),
    extensions: db.extensions.filter((x) => x.bookingId === b.id).reverse(),
    charges: db.charges.filter((x) => x.bookingId === b.id).reverse(),
    claims: db.claims.filter((x) => x.bookingId === b.id),
    reviews: db.reviews.filter((x) => x.bookingId === b.id),
    conversation: { id: db.conversations.find((x) => x.bookingId === b.id)?.id },
    viewerRole: isOwner ? 'owner' : 'driver',
    paymentInstructions: { rib: S.bankTransferRib, holder: S.bankTransferHolder },
  };
}
const bookingRow = (b: Any) => ({ ...b, car: car(b.carId), driver: publicUser(user(b.driverId)), owner: publicUser(user(b.ownerId)) });

function eligibility(u: Any, c: Any) {
  const out: string[] = [];
  if (u.verificationStatus !== 'VERIFIED') out.push('PROFILE_NOT_VERIFIED');
  if (!u.phoneVerified) out.push('PHONE_NOT_VERIFIED');
  const years = (d: string) => (Date.now() - new Date(d).getTime()) / (365.25 * DAY);
  if (u.birthDate && years(u.birthDate) < c.minDriverAge) out.push('DRIVER_TOO_YOUNG');
  if (u.licenseIssueDate && years(u.licenseIssueDate) < c.minLicenseYears) out.push('LICENSE_TOO_RECENT');
  return out;
}
function buildQuote(u: Any, body: Any) {
  const c = car(body.carId);
  if (!c || c.status !== 'ACTIVE') throw err('CAR_NOT_FOUND', 404);
  if (c.ownerId === u.id) throw err('OWN_CAR');
  const s = new Date(body.startAt); const e = new Date(body.endAt);
  if (!(e > s)) throw err('INVALID_DATES');
  if (s.getTime() < Date.now() + c.advanceNoticeHours * 3600000) throw err('ADVANCE_NOTICE', 400, String(c.advanceNoticeHours));
  const days = rentalDays(s, e);
  if (days < c.minDays) throw err('MIN_DAYS', 400, String(c.minDays));
  if (days > c.maxDays) throw err('MAX_DAYS', 400, String(c.maxDays));
  if (!available(c.id, s, e)) throw err('NOT_AVAILABLE');
  const plan = db.plans.find((p) => p.id === body.insurancePlanId) || db.plans[0];
  let promo: Any | null = null;
  if (body.promoCode) {
    const p = db.promos.find((x) => x.code === String(body.promoCode).toUpperCase().trim());
    if (!p) throw err('INVALID_PROMO');
    const pre = quote(c, s, e, { plan, delivery: body.delivery });
    if (pre.rentalPrice < p.minAmount) throw err('PROMO_MIN_AMOUNT');
    if (p.firstBookingOnly && db.bookings.some((b) => b.driverId === u.id && ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].includes(b.status))) throw err('PROMO_FIRST_BOOKING_ONLY');
    let discount = p.type === 'PERCENT' ? Math.round((pre.rentalPrice * p.value) / 100) : p.value;
    if (p.maxDiscount) discount = Math.min(discount, p.maxDiscount);
    promo = { code: p.code, discount };
  }
  const q = quote(c, s, e, { plan, delivery: body.delivery, promo: promo?.discount, wallet: body.useWallet ? u.walletBalance : 0 });
  return { c, plan, promo, q, s, e };
}

function markPaid(p: Any) {
  p.status = 'PAID';
  const b = db.bookings.find((x) => x.id === p.bookingId)!;
  const c = car(b.carId)!;
  if (p.type === 'BOOKING') {
    b.status = 'CONFIRMED'; b.paidAt = iso(now());
    if (b.walletUsed) { const u = user(b.driverId); u.walletBalance -= b.walletUsed; db.walletTxs.unshift({ id: id('w'), userId: u.id, type: 'BOOKING_PAYMENT', amount: -b.walletUsed, note: `Réservation ${b.reference}`, createdAt: iso(now()) }); }
    for (const o of db.bookings) if (o.id !== b.id && o.carId === b.carId && o.status === 'REQUESTED' && overlaps(o.startAt, o.endAt, new Date(b.startAt), new Date(b.endAt))) o.status = 'DECLINED';
    notify(b.driverId, 'BOOKING_CONFIRMED', 'Location confirmée 🎉', `${c.make} ${c.model}`, { bookingId: b.id });
    notify(b.ownerId, 'BOOKING_CONFIRMED', 'Nouvelle location confirmée', `${c.make} ${c.model}`, { bookingId: b.id });
    sysMsg(b.id, 'La location est confirmée. Convenez ensemble du lieu et de l\'heure exacte du rendez-vous pour l\'état des lieux.');
  }
  if (p.type === 'EXTENSION') {
    const x = db.extensions.find((e) => e.id === p.extensionId)!;
    x.status = 'PAID';
    const com = Math.round((x.extraPrice * S.commissionPercent) / 100);
    Object.assign(b, { endAt: x.newEndAt, days: b.days + x.extraDays, basePrice: b.basePrice + x.extraPrice, totalPrice: b.totalPrice + x.extraPrice, commission: b.commission + com, ownerEarnings: b.ownerEarnings + x.extraPrice - com });
    sysMsg(b.id, 'Location prolongée.');
  }
  if (p.type === 'CHARGE') db.charges.find((x) => x.id === p.chargeId)!.status = 'PAID';
}
function startPayment(u: Any, b: Any, type: string, method: string, amount: number, extra: Any = {}) {
  const p = { id: id('p'), bookingId: b.id, userId: u.id, type, method, status: 'PENDING', amount, orderId: ref('PAY'), createdAt: iso(now()), booking: { reference: b.reference, car: { make: car(b.carId)!.make, model: car(b.carId)!.model } }, ...extra };
  db.payments.push(p);
  if (method === 'CMI') { markPaid(p); return { status: 'PAID', paymentId: p.id }; }
  const label = { WAFACASH: 'un transfert Wafacash', CASHPLUS: 'un paiement Cash Plus', BANK_TRANSFER: 'un virement' }[method];
  return { paymentId: p.id, method, amount, reference: p.orderId, instructions: `(Démo) Effectuez ${label} de ${amount} MAD au bénéficiaire « ${S.bankTransferHolder} » avec la référence ${p.orderId}, puis envoyez la photo du reçu. En démo, le paiement est validé automatiquement.` };
}

// ---------------- routeur ----------------
type Ctx = { method: string; path: string; q: Any; body: Any; me: Any };
type H = (c: Ctx, m: RegExpMatchArray) => unknown;
const routes: [string, RegExp, H, boolean?][] = [];
const on = (method: string, pattern: string, h: H, auth = true) =>
  routes.push([method, new RegExp('^' + pattern.replace(/:(\w+)/g, '([^/]+)') + '$'), h, auth]);
const own = (c: Ctx, b: Any) => { if (b.driverId !== c.me.id && b.ownerId !== c.me.id && c.me.role !== 'ADMIN') throw err('FORBIDDEN', 403); return b; };
const getB = (c: Ctx, bid: string) => own(c, db.bookings.find((b) => b.id === bid) || (() => { throw err('NOT_FOUND', 404); })());
const ownCar = (c: Ctx, cid: string) => { const x = car(cid); if (!x) throw err('NOT_FOUND', 404); if (x.ownerId !== c.me.id) throw err('FORBIDDEN', 403); return x; };

// auth
on('POST', '/auth/login', (c) => {
  const u = byEmail(c.body.email || '');
  if (!u) throw err('INVALID_CREDENTIALS', 401);
  return { token: `demo:${u.id}`, user: privateUser(u) };
}, false);
on('POST', '/auth/register', (c) => {
  if (byEmail(c.body.email)) throw err('EMAIL_TAKEN');
  const u = { id: id('u'), email: c.body.email.toLowerCase(), phone: c.body.phone || null, role: 'USER', firstName: c.body.firstName, lastName: c.body.lastName, avatarUrl: null,
    language: c.body.language || 'fr', emailVerified: true, phoneVerified: false, verificationStatus: 'NONE', isPro: false, walletBalance: c.body.referralCode ? 100 : 0,
    referralCode: id('').slice(-7).toUpperCase(), ratingAvg: 0, ratingCount: 0, responseRate: 100, responseTimeMin: 60, notifyEmail: true, notifySms: true, notifyPush: true, createdAt: iso(now()) };
  db.users.push(u);
  notify(u.id, 'WELCOME', 'Bienvenue sur Rentaya !', 'Démo : vérifiez votre téléphone (n\'importe quel code à 6 chiffres) et votre profil pour réserver.');
  return { token: `demo:${u.id}`, user: u };
}, false);
on('GET', '/auth/me', (c) => privateUser(c.me));
on('POST', '/auth/push-token', () => ({ ok: true }));
on('POST', '/auth/forgot-password', () => ({ ok: true }), false);
on('POST', '/auth/reset-password', (c) => { const u = byEmail(c.body.email); if (!u) throw err('INVALID_CODE'); return { token: `demo:${u.id}` }; }, false);
on('POST', '/auth/change-password', () => ({ ok: true }));
on('POST', '/auth/phone/send-otp', (c) => { c.me.phone = c.body.phone; return { ok: true }; });
on('POST', '/auth/phone/verify', (c) => { if (!/^\d{6}$/.test(c.body.code)) throw err('INVALID_CODE'); c.me.phoneVerified = true; return c.me; });
on('DELETE', '/auth/me', () => ({ ok: true }));

// utilisateurs
on('PATCH', '/users/me', (c) => Object.assign(c.me, c.body));
on('POST', '/users/me/documents', (c) => {
  db.documents = db.documents.filter((d) => !(d.userId === c.me.id && d.type === c.body.type));
  const d = { id: id('d'), userId: c.me.id, ...c.body, status: 'PENDING' }; db.documents.push(d); return d;
});
on('POST', '/users/me/verification', (c) => {
  // en démo, la vérification est acceptée immédiatement
  c.me.verificationStatus = 'VERIFIED';
  db.documents.filter((d) => d.userId === c.me.id).forEach((d) => (d.status = 'VERIFIED'));
  notify(c.me.id, 'VERIFICATION_VERIFIED', 'Profil vérifié ✅', 'Démo : votre profil a été validé automatiquement.');
  return c.me;
});
on('GET', '/users/:id', (c, m) => {
  const u = user(m[1]); if (!u) throw err('NOT_FOUND', 404);
  return { ...publicUser(u), cars: db.cars.filter((x) => x.ownerId === u.id && x.status === 'ACTIVE'),
    reviews: db.reviews.filter((r) => r.targetUserId === u.id).map((r) => ({ ...r, author: publicUser(user(r.authorId)) })) };
}, false);

// voitures
on('GET', '/cars', (c) => {
  const q = c.q;
  let list = db.cars.filter((x) => x.status === 'ACTIVE');
  const lat = q.lat ? Number(q.lat) : null; const lng = q.lng ? Number(q.lng) : null;
  if (lat == null && q.city) list = list.filter((x) => x.city.toLowerCase() === String(q.city).toLowerCase());
  if (q.category) list = list.filter((x) => String(q.category).split(',').includes(x.category));
  if (q.fuel) list = list.filter((x) => String(q.fuel).split(',').includes(x.fuel));
  if (q.transmission) list = list.filter((x) => x.transmission === q.transmission);
  if (q.minSeats) list = list.filter((x) => x.seats >= Number(q.minSeats));
  if (q.instant) list = list.filter((x) => x.instantBooking);
  if (q.delivery) list = list.filter((x) => x.deliveryAvailable);
  if (q.unlimitedKm) list = list.filter((x) => x.unlimitedKm);
  if (q.features) list = list.filter((x) => String(q.features).split(',').every((f) => x.features.includes(f)));
  if (q.minPrice) list = list.filter((x) => x.pricePerDay >= Number(q.minPrice));
  if (q.maxPrice) list = list.filter((x) => x.pricePerDay <= Number(q.maxPrice));
  if (q.ownerType) list = list.filter((x) => user(x.ownerId).isPro === (q.ownerType === 'pro'));
  const s = q.start ? new Date(q.start) : null; const e = q.end ? new Date(q.end) : null;
  if (s && e) list = list.filter((x) => available(x.id, s, e) && rentalDays(s, e) >= x.minDays && rentalDays(s, e) <= x.maxDays);
  let items: Any[] = list.map((x) => ({ ...carView(x, c.me), distanceKm: lat != null && lng != null ? dist(lat, lng, x.latitude, x.longitude) : null, quote: s && e ? quote(x, s, e) : null }));
  if (lat != null) items = items.filter((x) => (x.distanceKm ?? 0) <= Number(q.radius || 30));
  const price = (x: Any) => x.quote?.rentalPrice ?? x.pricePerDay;
  if (q.sort === 'price_asc') items.sort((a, b) => price(a) - price(b));
  else if (q.sort === 'price_desc') items.sort((a, b) => price(b) - price(a));
  else if (q.sort === 'rating') items.sort((a, b) => b.ratingAvg - a.ratingAvg);
  else if (lat != null) items.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
  else items.sort((a, b) => b.ratingCount - a.ratingCount);
  return { total: items.length, page: 1, items: items.slice(0, Number(q.pageSize || 30)) };
}, false);
on('GET', '/cars/meta/suggest-price', (c) => {
  const base: Any = { CITADINE: 250, COMPACTE: 300, BERLINE: 400, SUV: 550, QUATRE_X_QUATRE: 750, MONOSPACE: 500, BREAK: 380, CABRIOLET: 800, LUXE: 1500, UTILITAIRE: 450, MINIBUS: 900 };
  const p = (base[c.q.category] || 300) * Math.max(0.6, 1 - (new Date().getFullYear() - Number(c.q.year)) * 0.04);
  const r = (x: number) => Math.round(x / 10) * 10;
  return { suggested: r(p), min: r(p * 0.8), max: r(p * 1.25) };
}, false);
on('GET', '/cars/mine/list', (c) => db.cars.filter((x) => x.ownerId === c.me.id && x.status !== 'ARCHIVED'));
on('GET', '/cars/:id', (c, m) => {
  const x = car(m[1]); if (!x) throw err('NOT_FOUND', 404);
  const isOwner = c.me?.id === x.ownerId;
  return { ...carView(x, c.me), isOwner,
    unavailable: [...db.bookings.filter((b) => b.carId === x.id && BLOCKING.includes(b.status)), ...db.unav.filter((u) => u.carId === x.id)].map((b) => ({ startAt: b.startAt, endAt: b.endAt })),
    reviews: db.reviews.filter((r) => r.carId === x.id && r.role === 'DRIVER_TO_OWNER').map((r) => ({ ...r, author: publicUser(user(r.authorId)) })) };
}, false);
on('POST', '/cars', (c) => {
  const { photos = [], ...rest } = c.body;
  const x = { ...rest, id: id('car'), ownerId: c.me.id, status: 'ACTIVE', ratingAvg: 0, ratingCount: 0, tripsCount: 0, createdAt: iso(now()), photos: photos.map((url: string, position: number) => ({ id: id('ph'), url, position })) };
  db.cars.unshift(x);
  notify(c.me.id, 'CAR_ACTIVE', 'Annonce publiée 🚗', 'Démo : votre annonce est validée automatiquement.', { carId: x.id });
  return x;
});
on('PATCH', '/cars/:id', (c, m) => {
  const x = ownCar(c, m[1]); const { photos, ...rest } = c.body;
  Object.assign(x, rest); if (photos) x.photos = photos.map((url: string, position: number) => ({ id: id('ph'), url, position }));
  return x;
});
on('POST', '/cars/:id/status', (c, m) => Object.assign(ownCar(c, m[1]), { status: c.body.status }));
on('GET', '/cars/:id/documents', (c, m) => db.documents.filter((d) => d.carId === ownCar(c, m[1]).id));
on('POST', '/cars/:id/documents', (c, m) => {
  const x = ownCar(c, m[1]); db.documents = db.documents.filter((d) => !(d.carId === x.id && d.type === c.body.type));
  const d = { id: id('d'), carId: x.id, ...c.body, status: 'PENDING' }; db.documents.push(d); return d;
});
on('GET', '/cars/:id/calendar', (c, m) => {
  const x = ownCar(c, m[1]);
  return { pricePerDay: x.pricePerDay, unavailabilities: db.unav.filter((u) => u.carId === x.id), overrides: db.overrides.filter((o) => o.carId === x.id),
    bookings: db.bookings.filter((b) => b.carId === x.id && ['REQUESTED', ...BLOCKING].includes(b.status)).map((b) => ({ id: b.id, reference: b.reference, startAt: b.startAt, endAt: b.endAt, status: b.status, driver: publicUser(user(b.driverId)) })) };
});
on('POST', '/cars/:id/unavailability', (c, m) => {
  const x = ownCar(c, m[1]); const s = new Date(c.body.startAt); const e = new Date(c.body.endAt);
  if (!available(x.id, s, e)) throw err('OVERLAPS_BOOKING');
  const u = { id: id('un'), carId: x.id, startAt: iso(s), endAt: iso(e) }; db.unav.push(u); return u;
});
on('DELETE', '/cars/:id/unavailability/:uid', (c, m) => { ownCar(c, m[1]); db.unav = db.unav.filter((u) => u.id !== m[2]); return { ok: true }; });
on('PUT', '/cars/:id/prices', (c, m) => {
  const x = ownCar(c, m[1]);
  for (const d of c.body.dates) {
    db.overrides = db.overrides.filter((o) => !(o.carId === x.id && o.date === d));
    if (c.body.price != null) db.overrides.push({ id: id('o'), carId: x.id, date: d, price: c.body.price });
  }
  return { ok: true };
});

// réservations
on('POST', '/bookings/quote', (c) => {
  const { c: x, plan, promo, q } = buildQuote(c.me, c.body);
  return { quote: q, insurancePlanId: plan.id, promo, eligibility: eligibility(c.me, x), instant: x.instantBooking, walletBalance: c.me.walletBalance };
});
on('POST', '/bookings', (c) => {
  const { c: x, plan, promo, q, s, e } = buildQuote(c.me, c.body);
  const issues = eligibility(c.me, x); if (issues.length) throw err(issues[0]);
  const b = {
    id: id('b'), reference: ref('RTY'), carId: x.id, driverId: c.me.id, ownerId: x.ownerId, startAt: iso(s), endAt: iso(e),
    status: x.instantBooking ? 'PENDING_PAYMENT' : 'REQUESTED', instant: x.instantBooking, message: c.body.message || null, ...q,
    insurancePlanId: plan.id, deliveryAddress: c.body.delivery ? c.body.deliveryAddress : null, promoCode: promo?.code || null, paymentMethod: null,
    requestExpiresAt: x.instantBooking ? null : iso(new Date(Math.min(Date.now() + 24 * 3600000, s.getTime()))),
    paymentDueAt: x.instantBooking ? iso(new Date(Math.min(Date.now() + 24 * 3600000, s.getTime()))) : null,
    refundAmount: 0, ownerPenalty: 0, driverReviewed: false, ownerReviewed: false, contractNumber: ref('CTR'), createdAt: iso(now()),
  };
  db.bookings.push(b);
  const conv = { id: id('c'), userAId: c.me.id, userBId: x.ownerId, carId: x.id, bookingId: b.id, lastMessageAt: iso(now()) };
  db.conversations.push(conv);
  if (b.message) db.messages.push({ id: id('m'), conversationId: conv.id, senderId: c.me.id, body: b.message, system: false, readAt: null, createdAt: iso(now()) });
  notify(x.ownerId, b.instant ? 'BOOKING_INSTANT' : 'BOOKING_REQUEST', b.instant ? 'Réservation instantanée' : 'Nouvelle demande de location', `${c.me.firstName} — ${x.make} ${x.model}`, { bookingId: b.id });
  if (!b.instant) {
    // démo : le propriétaire accepte automatiquement après quelques secondes
    setTimeout(() => {
      if (b.status !== 'REQUESTED') return;
      Object.assign(b, { status: 'PENDING_PAYMENT', acceptedAt: iso(now()), paymentDueAt: iso(new Date(Date.now() + 24 * 3600000)) });
      notify(b.driverId, 'BOOKING_ACCEPTED', 'Demande acceptée ✅', 'Démo : le propriétaire a accepté. Finalisez le paiement.', { bookingId: b.id });
      sysMsg(b.id, 'Le propriétaire a accepté la demande. En attente du paiement.');
    }, 8000);
  }
  return b;
});
on('GET', '/bookings', (c) => {
  const owner = c.q.role === 'owner';
  let list = db.bookings.filter((b) => (owner ? b.ownerId : b.driverId) === c.me.id);
  if (c.q.scope === 'requests') list = list.filter((b) => b.status === 'REQUESTED');
  if (c.q.scope === 'upcoming') list = list.filter((b) => ['REQUESTED', ...BLOCKING].includes(b.status));
  if (c.q.scope === 'past') list = list.filter((b) => !['REQUESTED', ...BLOCKING].includes(b.status));
  list.sort((a, b) => (c.q.scope === 'past' ? -1 : 1) * (+new Date(a.startAt) - +new Date(b.startAt)));
  return list.map(bookingRow);
});
on('GET', '/bookings/:id', (c, m) => bookingView(getB(c, m[1]), c.me));
on('POST', '/bookings/:id/accept', (c, m) => {
  const b = getB(c, m[1]); if (b.ownerId !== c.me.id || b.status !== 'REQUESTED') throw err('INVALID_STATUS');
  if (!available(b.carId, new Date(b.startAt), new Date(b.endAt), b.id)) throw err('NOT_AVAILABLE');
  Object.assign(b, { status: 'PENDING_PAYMENT', acceptedAt: iso(now()), paymentDueAt: iso(new Date(Date.now() + 24 * 3600000)) });
  sysMsg(b.id, 'Le propriétaire a accepté la demande. En attente du paiement.');
  // démo : le conducteur paie automatiquement
  setTimeout(() => { if (b.status === 'PENDING_PAYMENT') { const p = { id: id('p'), bookingId: b.id, userId: b.driverId, type: 'BOOKING', method: 'CMI', status: 'PENDING', amount: b.totalPrice, orderId: ref('PAY'), createdAt: iso(now()) }; db.payments.push(p); markPaid(p); } }, 6000);
  return b;
});
on('POST', '/bookings/:id/decline', (c, m) => { const b = getB(c, m[1]); if (b.status !== 'REQUESTED') throw err('INVALID_STATUS'); b.status = 'DECLINED'; sysMsg(b.id, 'Le propriétaire a refusé la demande.'); return b; });
const cancelPreview = (b: Any, isDriver: boolean) => {
  if (b.status !== 'CONFIRMED') return { refund: b.walletUsed, penalty: 0, ratio: 1 };
  if (!isDriver) return { refund: b.totalPrice + b.walletUsed, ratio: 1, penalty: S.ownerCancelPenalty };
  const h = (+new Date(b.startAt) - Date.now()) / 3600000;
  const rules: Any = { FLEXIBLE: [[24, 1], [0, 0.5]], MODERATE: [[48, 1], [24, 0.5], [0, 0]], STRICT: [[168, 1], [48, 0.5], [0, 0]] };
  let ratio = 0; for (const [hh, r] of rules[car(b.carId)!.cancellationPolicy]) if (h >= hh) { ratio = r; break; }
  const paid = b.totalPrice + b.walletUsed;
  return { ratio, refund: ratio === 1 ? paid : Math.round(Math.max(0, paid - b.serviceFee) * ratio), penalty: 0 };
};
on('GET', '/bookings/:id/cancel-preview', (c, m) => { const b = getB(c, m[1]); return cancelPreview(b, b.driverId === c.me.id); });
on('POST', '/bookings/:id/cancel', (c, m) => {
  const b = getB(c, m[1]); if (!['REQUESTED', 'PENDING_PAYMENT', 'CONFIRMED'].includes(b.status)) throw err('INVALID_STATUS');
  const isDriver = b.driverId === c.me.id; const isAdmin = c.me.role === 'ADMIN' && !isDriver && b.ownerId !== c.me.id; const p = cancelPreview(b, isDriver);
  Object.assign(b, { status: isDriver ? 'CANCELLED_BY_DRIVER' : isAdmin ? 'CANCELLED_BY_ADMIN' : 'CANCELLED_BY_OWNER', cancelledAt: iso(now()), refundAmount: b.status === 'CONFIRMED' ? p.refund : 0, ownerPenalty: isAdmin ? 0 : p.penalty });
  if (b.refundAmount > b.walletUsed) db.payments.push({ id: id('p'), bookingId: b.id, userId: b.driverId, type: 'REFUND', method: b.paymentMethod || 'CMI', status: 'PENDING', amount: b.refundAmount - b.walletUsed, orderId: ref('RFD'), raw: { note: `Annulation ${b.reference}` }, createdAt: iso(now()) });
  sysMsg(b.id, `Location annulée par ${isDriver ? 'le conducteur' : 'le propriétaire'}.`);
  return b;
});
on('POST', '/bookings/:id/pay', (c, m) => {
  const b = getB(c, m[1]); if (b.status !== 'PENDING_PAYMENT') throw err('INVALID_STATUS');
  b.paymentMethod = c.body.method;
  return startPayment(c.me, b, 'BOOKING', c.body.method, b.totalPrice);
});
on('POST', '/bookings/:id/inspections', (c, m) => {
  const b = getB(c, m[1]); const x = car(b.carId)!;
  const ins = { ...c.body, id: id('i'), bookingId: b.id, createdById: c.me.id, createdAt: iso(now()) };
  if (c.body.type === 'CHECK_IN') {
    if (b.status !== 'CONFIRMED') throw err('INVALID_STATUS');
    db.inspections.push(ins); b.status = 'IN_PROGRESS'; x.odometerKm = c.body.odometerKm;
    sysMsg(b.id, `État des lieux de départ effectué — ${c.body.odometerKm} km, carburant ${c.body.fuelLevel}/8. Bonne route !`);
  } else {
    if (b.status !== 'IN_PROGRESS') throw err('INVALID_STATUS');
    db.inspections.push(ins);
    const ci = db.inspections.find((i) => i.bookingId === b.id && i.type === 'CHECK_IN');
    if (ci) {
      const driven = c.body.odometerKm - ci.odometerKm;
      if (!b.unlimitedKm && driven > b.kmIncluded) db.charges.push({ id: id('ch'), bookingId: b.id, type: 'EXTRA_KM', amount: Math.round((driven - b.kmIncluded) * b.extraKmPrice), description: `${driven - b.kmIncluded} km supplémentaires × ${b.extraKmPrice} MAD`, proofUrls: [], status: 'PENDING', createdAt: iso(now()) });
      const miss = ci.fuelLevel - c.body.fuelLevel;
      if (miss > 0) db.charges.push({ id: id('ch'), bookingId: b.id, type: 'FUEL', amount: Math.round((miss / 8) * 50) * S.fuelPricePerLiter, description: `Carburant manquant : ${miss}/8`, proofUrls: [], status: 'PENDING', createdAt: iso(now()) });
    }
    b.status = 'COMPLETED'; x.tripsCount += 1;
    sysMsg(b.id, `État des lieux de retour effectué — ${c.body.odometerKm} km. Merci ! Pensez à laisser un avis.`);
  }
  return ins;
});
on('POST', '/bookings/:id/extensions', (c, m) => {
  const b = getB(c, m[1]); const ne = new Date(c.body.newEndAt);
  if (!(ne > new Date(b.endAt))) throw err('INVALID_DATES');
  if (!available(b.carId, new Date(b.endAt), ne, b.id)) throw err('NOT_AVAILABLE');
  const extraDays = Math.max(0, rentalDays(new Date(b.startAt), ne) - b.days);
  const x = { id: id('x'), bookingId: b.id, newEndAt: iso(ne), extraDays, extraPrice: extraDays * b.pricePerDay, status: 'PENDING', createdAt: iso(now()) };
  db.extensions.push(x);
  setTimeout(() => { if (x.status === 'PENDING') { x.status = 'ACCEPTED'; notify(b.driverId, 'EXTENSION_ACCEPTED', 'Prolongation acceptée', 'Démo : réglez la prolongation pour la confirmer.', { bookingId: b.id }); } }, 6000);
  return x;
});
on('POST', '/bookings/:id/extensions/:eid/(accept|decline)', (c, m) => {
  getB(c, m[1]); const x = db.extensions.find((e) => e.id === m[2])!; x.status = m[3] === 'accept' ? 'ACCEPTED' : 'DECLINED'; return x;
});
on('POST', '/bookings/:id/extensions/:eid/pay', (c, m) => {
  const b = getB(c, m[1]); const x = db.extensions.find((e) => e.id === m[2] && e.status === 'ACCEPTED'); if (!x) throw err('NOT_FOUND', 404);
  return startPayment(c.me, b, 'EXTENSION', c.body.method, x.extraPrice, { extensionId: x.id });
});
on('POST', '/bookings/:id/charges', (c, m) => {
  const b = getB(c, m[1]); const ch = { id: id('ch'), bookingId: b.id, ...c.body, status: 'PENDING', createdAt: iso(now()) }; db.charges.push(ch); return ch;
});
on('POST', '/bookings/:id/charges/:cid/respond', (c, m) => {
  getB(c, m[1]); const ch = db.charges.find((x) => x.id === m[2])!; ch.status = c.body.accept ? 'ACCEPTED' : 'CONTESTED'; ch.response = c.body.response; return ch;
});
on('POST', '/bookings/:id/charges/:cid/pay', (c, m) => {
  const b = getB(c, m[1]); const ch = db.charges.find((x) => x.id === m[2])!;
  return startPayment(c.me, b, 'CHARGE', c.body.method, ch.amount, { chargeId: ch.id });
});
on('POST', '/bookings/:id/claims', (c, m) => { const b = getB(c, m[1]); const x = { id: id('cl'), bookingId: b.id, reporterId: c.me.id, ...c.body, status: 'OPEN', createdAt: iso(now()) }; db.claims.push(x); return x; });
on('POST', '/bookings/:id/review', (c, m) => {
  const b = getB(c, m[1]); if (b.status !== 'COMPLETED') throw err('INVALID_STATUS');
  const isDriver = b.driverId === c.me.id;
  const r = { id: id('r'), bookingId: b.id, authorId: c.me.id, targetUserId: isDriver ? b.ownerId : b.driverId, carId: isDriver ? b.carId : null, role: isDriver ? 'DRIVER_TO_OWNER' : 'OWNER_TO_DRIVER', ...c.body, createdAt: iso(now()) };
  db.reviews.unshift(r);
  if (isDriver) b.driverReviewed = true; else b.ownerReviewed = true;
  const t = user(r.targetUserId); const rs = db.reviews.filter((x) => x.targetUserId === t.id);
  t.ratingCount = rs.length; t.ratingAvg = rs.reduce((a, x) => a + x.rating, 0) / rs.length;
  return r;
});

// paiements
on('GET', '/payments', (c) => db.payments.filter((p) => p.userId === c.me.id).map((p) => ({ ...p, booking: p.booking || (() => { const b = db.bookings.find((x) => x.id === p.bookingId); const x = b && car(b.carId); return b && x ? { reference: b.reference, car: { make: x.make, model: x.model } } : null; })() })).reverse());
on('POST', '/payments/:id/proof', (c, m) => { const p = db.payments.find((x) => x.id === m[1])!; p.proofUrl = c.body.proofUrl; markPaid(p); return p; });

// messagerie
const convView = (cv: Any, me: Any) => {
  const other = user(cv.userAId === me.id ? cv.userBId : cv.userAId);
  const msgs = db.messages.filter((x) => x.conversationId === cv.id);
  const b = db.bookings.find((x) => x.id === cv.bookingId); const x = car(cv.carId);
  return { id: cv.id, other: publicUser(other), lastMessageAt: cv.lastMessageAt, lastMessage: msgs[msgs.length - 1] || null,
    unread: msgs.filter((y) => !y.readAt && y.senderId && y.senderId !== me.id).length,
    car: x && { id: x.id, make: x.make, model: x.model, photos: x.photos.slice(0, 1), photo: x.photos[0]?.url },
    booking: b && { id: b.id, reference: b.reference, status: b.status, startAt: b.startAt, endAt: b.endAt } };
};
const myConvs = (me: Any) => db.conversations.filter((x) => x.userAId === me.id || x.userBId === me.id);
on('GET', '/conversations', (c) => myConvs(c.me).sort((a, b) => +new Date(b.lastMessageAt) - +new Date(a.lastMessageAt)).map((x) => convView(x, c.me)));
on('GET', '/conversations/unread-count', (c) => ({ count: myConvs(c.me).reduce((a, x) => a + convView(x, c.me).unread, 0) }));
on('POST', '/conversations/start', (c) => {
  const x = car(c.body.carId)!; if (x.ownerId === c.me.id) throw err('OWN_CAR');
  let cv = db.conversations.find((y) => y.carId === x.id && y.userAId === c.me.id && !y.bookingId);
  if (!cv) { cv = { id: id('c'), userAId: c.me.id, userBId: x.ownerId, carId: x.id, bookingId: null, lastMessageAt: iso(now()) }; db.conversations.push(cv); }
  return { id: cv.id };
});
on('GET', '/conversations/:id', (c, m) => {
  const cv = db.conversations.find((x) => x.id === m[1]); if (!cv) throw err('NOT_FOUND', 404);
  db.messages.filter((x) => x.conversationId === cv.id && x.senderId !== c.me.id && !x.readAt).forEach((x) => (x.readAt = iso(now())));
  return { ...convView(cv, c.me), messages: db.messages.filter((x) => x.conversationId === cv.id) };
});
on('POST', '/conversations/:id', (c, m) => {
  const cv = db.conversations.find((x) => x.id === m[1])!;
  const msg = { id: id('m'), conversationId: cv.id, senderId: c.me.id, body: c.body.body || '', imageUrl: c.body.imageUrl, system: false, readAt: null, createdAt: iso(now()) };
  db.messages.push(msg); cv.lastMessageAt = msg.createdAt;
  const otherId = cv.userAId === c.me.id ? cv.userBId : cv.userAId;
  setTimeout(() => { db.messages.push({ id: id('m'), conversationId: cv.id, senderId: otherId, body: 'Merci pour votre message ! (réponse automatique de démo)', system: false, readAt: null, createdAt: iso(now()) }); cv.lastMessageAt = iso(now()); }, 4000);
  return msg;
});

// compte
on('GET', '/account/notifications', (c) => { const items = db.notifications.filter((n) => n.userId === c.me.id); return { items, unread: items.filter((n) => !n.read).length }; });
on('POST', '/account/notifications/read', (c) => { db.notifications.filter((n) => n.userId === c.me.id).forEach((n) => (n.read = true)); return { ok: true }; });
on('GET', '/account/favorites', (c) => db.favorites.filter((f) => f.userId === c.me.id).map((f) => car(f.carId)).filter((x): x is Any => !!x).map((x) => carView(x, c.me)));
on('PUT', '/account/favorites/:id', (c, m) => { if (!db.favorites.some((f) => f.userId === c.me.id && f.carId === m[1])) db.favorites.push({ userId: c.me.id, carId: m[1] }); return { ok: true }; });
on('DELETE', '/account/favorites/:id', (c, m) => { db.favorites = db.favorites.filter((f) => !(f.userId === c.me.id && f.carId === m[1])); return { ok: true }; });
on('GET', '/account/wallet', (c) => ({ balance: c.me.walletBalance, referralCode: c.me.referralCode, referrals: db.users.filter((u) => u.referredById === c.me.id).length,
  referralBonusReferee: S.referralBonusReferee, referralBonusReferrer: S.referralBonusReferrer, transactions: db.walletTxs.filter((t) => t.userId === c.me.id) }));
on('GET', '/account/earnings', (c) => {
  const year = Number(c.q.year || new Date().getFullYear());
  const list = db.bookings.filter((b) => b.ownerId === c.me.id && new Date(b.startAt).getFullYear() === year && ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].includes(b.status));
  const months = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, earnings: 0, bookings: 0, days: 0 }));
  const byCar: Any = {};
  for (const b of list) {
    const mm = months[new Date(b.startAt).getMonth()]; mm.earnings += b.ownerEarnings; mm.bookings++; mm.days += b.days;
    const x = car(b.carId)!; byCar[x.id] ||= { carId: x.id, name: `${x.make} ${x.model}`, earnings: 0, bookings: 0 }; byCar[x.id].earnings += b.ownerEarnings; byCar[x.id].bookings++;
  }
  const sum = (s: string[]) => db.bookings.filter((b) => b.ownerId === c.me.id && s.includes(b.status)).reduce((a, b) => a + b.ownerEarnings, 0);
  return { year, total: list.reduce((a, b) => a + b.ownerEarnings, 0), months, byCar: Object.values(byCar), pendingPayout: sum(['COMPLETED']), upcoming: sum(['CONFIRMED', 'IN_PROGRESS']),
    payouts: [], bankConfigured: !!c.me.rib };
});
on('GET', '/account/tickets', (c) => db.tickets.filter((t) => t.userId === c.me.id));
on('POST', '/account/tickets', (c) => { const t = { id: id('t'), userId: c.me.id, ...c.body, status: 'OPEN', createdAt: iso(now()) }; db.tickets.unshift(t); return t; });

// public
on('GET', '/public/config', () => ({ insurancePlans: db.plans, ...S, paymentMethods: ['CMI', 'WAFACASH', 'CASHPLUS', 'BANK_TRANSFER'], cmiLive: false }), false);
on('GET', '/public/help', (c) => db.help.filter((a) => a.locale === (c.q.locale || 'fr')), false);
on('GET', '/public/help/:slug', (c, m) => db.help.find((a) => a.slug === m[1] && a.locale === (c.q.locale || 'fr')) || db.help.find((a) => a.slug === m[1]), false);


// ---------------- back-office (démo) ----------------
const adm = (c: Ctx) => { if (c.me.role !== 'ADMIN') throw err('ADMIN_ONLY', 403); };
const A = (method: string, pattern: string, h: H) => on(method, '/admin' + pattern, (c, m) => { adm(c); return h(c, m); });
const contains = (v: unknown, q: string) => String(v ?? '').toLowerCase().includes(q.toLowerCase());
const SETTINGS: Any = { ...S, requestExpiryHours: 24, cashPaymentWindowHours: 24, payoutDelayDays: 3 };
let payouts: Any[] = [];
A('GET', '/stats', () => {
  const since = Date.now() - 30 * DAY;
  const paid = db.bookings.filter((b) => ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].includes(b.status));
  const count = (arr: Any[], k: string) => Object.entries(arr.reduce((a: Any, x) => ((a[x[k]] = (a[x[k]] || 0) + 1), a), {})).map(([v, n]) => ({ [k]: v, count: n }));
  const days: Any = {};
  for (const b of db.bookings.filter((x) => +new Date(x.createdAt) >= since)) { const d = b.createdAt.slice(0, 10); days[d] ||= { day: d, count: 0, gmv: 0 }; days[d].count++; days[d].gmv += b.totalPrice; }
  return {
    users: db.users.length, cars: db.cars.filter((x) => x.status === 'ACTIVE').length, pendingCars: db.cars.filter((x) => x.status === 'PENDING_REVIEW').length,
    pendingUsers: db.users.filter((u) => u.verificationStatus === 'PENDING').length, bookings30: db.bookings.length,
    gmv30: paid.reduce((a, b) => a + b.totalPrice, 0), revenue30: paid.reduce((a, b) => a + b.commission, 0),
    awaitingPayments: db.payments.filter((p) => p.status === 'AWAITING_VALIDATION').length, openClaims: db.claims.filter((x) => ['OPEN', 'UNDER_REVIEW'].includes(x.status)).length,
    contested: db.charges.filter((x) => x.status === 'CONTESTED').length, pendingRefunds: db.payments.filter((p) => p.type === 'REFUND' && p.status === 'PENDING').length,
    pendingPayouts: payouts.filter((p) => p.status !== 'PAID').length, openTickets: db.tickets.filter((t) => t.status === 'OPEN').length,
    byStatus: count(db.bookings, 'status'), byCity: count(db.cars.filter((x) => x.status === 'ACTIVE'), 'city'), daily: Object.values(days),
  };
});
A('GET', '/users', (c) => {
  let items = db.users;
  if (c.q.search) items = items.filter((u) => ['email', 'firstName', 'lastName', 'phone'].some((k) => contains(u[k], c.q.search)));
  if (c.q.verification) items = items.filter((u) => u.verificationStatus === c.q.verification);
  return { total: items.length, items: items.map((u) => ({ ...u, _count: { cars: db.cars.filter((x) => x.ownerId === u.id).length, bookingsAsDriver: db.bookings.filter((b) => b.driverId === u.id).length } })) };
});
A('GET', '/users/:id', (c, m) => {
  const u = user(m[1]);
  return { ...privateUser(u), cars: db.cars.filter((x) => x.ownerId === u.id), bookingsAsDriver: db.bookings.filter((b) => b.driverId === u.id),
    bookingsAsOwner: db.bookings.filter((b) => b.ownerId === u.id), walletTxs: db.walletTxs.filter((t) => t.userId === u.id) };
});
A('POST', '/users/:id/verification', (c, m) => {
  const u = user(m[1]); u.verificationStatus = c.body.status; u.verificationNote = c.body.note;
  db.documents.filter((d) => d.userId === u.id && d.status === 'PENDING').forEach((d) => (d.status = c.body.status));
  notify(u.id, 'VERIFICATION_' + c.body.status, c.body.status === 'VERIFIED' ? 'Profil vérifié ✅' : 'Vérification refusée', c.body.note || '');
  return u;
});
A('PATCH', '/users/:id', (c, m) => Object.assign(user(m[1]), c.body));
A('POST', '/users/:id/wallet', (c, m) => {
  const u = user(m[1]); u.walletBalance += c.body.amount;
  db.walletTxs.unshift({ id: id('w'), userId: u.id, type: 'ADJUSTMENT', amount: c.body.amount, note: c.body.note, createdAt: iso(now()) });
  return { balance: u.walletBalance };
});
A('GET', '/cars', (c) => {
  let items = db.cars;
  if (c.q.status) items = items.filter((x) => x.status === c.q.status);
  if (c.q.search) items = items.filter((x) => ['make', 'model', 'plate'].some((k) => contains(x[k], c.q.search)));
  return { total: items.length, items: items.map((x) => ({ ...x, owner: user(x.ownerId), documents: db.documents.filter((d) => d.carId === x.id) })) };
});
A('POST', '/cars/:id/review', (c, m) => {
  const x = car(m[1])!; x.status = c.body.status; x.rejectionReason = c.body.reason || null;
  notify(x.ownerId, 'CAR_' + x.status, x.status === 'ACTIVE' ? 'Annonce publiée 🚗' : 'Annonce non validée', c.body.reason || `${x.make} ${x.model}`, { carId: x.id });
  return x;
});
A('GET', '/bookings', (c) => {
  let items = [...db.bookings].reverse();
  if (c.q.status) items = items.filter((b) => b.status === c.q.status);
  if (c.q.search) items = items.filter((b) => contains(b.reference, c.q.search));
  return { total: items.length, items: items.map((b) => ({ ...b, car: car(b.carId), driver: user(b.driverId), owner: user(b.ownerId) })) };
});
A('GET', '/bookings/:id', (c, m) => {
  const b = db.bookings.find((x) => x.id === m[1])!; const v = bookingView(b, c.me);
  const conv = db.conversations.find((x) => x.bookingId === b.id);
  return { ...v, car: car(b.carId), driver: user(b.driverId), owner: user(b.ownerId), conversation: { messages: db.messages.filter((x) => x.conversationId === conv?.id) } };
});
A('GET', '/payments', (c) => {
  let items = [...db.payments].reverse();
  for (const k of ['status', 'type', 'method']) if (c.q[k]) items = items.filter((p) => p[k] === c.q[k]);
  return { total: items.length, items: items.map((p) => ({ ...p, user: user(p.userId), booking: (() => { const b = db.bookings.find((x) => x.id === p.bookingId); return b && { reference: b.reference, status: b.status }; })() })) };
});
A('POST', '/payments/:id/(validate|reject|refunded)', (c, m) => {
  const p = db.payments.find((x) => x.id === m[1])!;
  if (m[2] === 'validate') markPaid(p);
  else if (m[2] === 'reject') { p.status = 'FAILED'; notify(p.userId, 'PAYMENT_REJECTED', 'Paiement non validé', 'Votre preuve de paiement n\'a pas pu être validée.', { bookingId: p.bookingId }); }
  else { p.status = 'REFUNDED'; p.providerRef = c.body.providerRef; }
  return p;
});
A('GET', '/payouts', (c) => ({ items: payouts.filter((p) => !c.q.status || p.status === c.q.status).map((p) => ({ ...p, owner: user(p.ownerId), bookings: db.bookings.filter((b) => b.payoutId === p.id).map((b) => ({ reference: b.reference, ownerEarnings: b.ownerEarnings })) })) }));
A('POST', '/payouts/generate', () => {
  const by: Any = {};
  for (const b of db.bookings.filter((x) => x.status === 'COMPLETED' && !x.payoutId)) (by[b.ownerId] ||= []).push(b);
  for (const [ownerId, list] of Object.entries(by) as [string, Any[]][]) {
    const p = { id: id('po'), ownerId, amount: list.reduce((a, b) => a + b.ownerEarnings, 0), status: 'PENDING', createdAt: iso(now()) };
    payouts.unshift(p); list.forEach((b) => (b.payoutId = p.id));
  }
  return { created: Object.keys(by).length };
});
A('POST', '/payouts/:id', (c, m) => {
  const p = payouts.find((x) => x.id === m[1])!; Object.assign(p, { status: c.body.status, reference: c.body.reference, paidAt: c.body.status === 'PAID' ? iso(now()) : null });
  if (p.status === 'PAID') notify(p.ownerId, 'PAYOUT_PAID', 'Versement effectué 💸', `${p.amount} MAD ont été virés sur votre compte.`);
  return p;
});
A('GET', '/claims', (c) => db.claims.filter((x) => !c.q.status || x.status === c.q.status).map((x) => { const b = db.bookings.find((y) => y.id === x.bookingId)!; return { ...x, booking: { ...b, car: car(b.carId) }, reporter: user(x.reporterId) }; }));
A('PATCH', '/claims/:id', (c, m) => Object.assign(db.claims.find((x) => x.id === m[1])!, c.body));
A('GET', '/charges', (c) => db.charges.filter((x) => !c.q.status || x.status === c.q.status).map((x) => { const b = db.bookings.find((y) => y.id === x.bookingId)!; return { ...x, proofUrls: x.proofUrls || [], booking: { ...b, car: car(b.carId) } }; }));
A('POST', '/charges/:id', (c, m) => Object.assign(db.charges.find((x) => x.id === m[1])!, { status: c.body.status }, c.body.amount != null ? { amount: c.body.amount } : {}));
A('GET', '/reviews', () => db.reviews.map((r) => ({ ...r, author: user(r.authorId), targetUser: user(r.targetUserId) })));
A('POST', '/reviews/:id', (c, m) => Object.assign(db.reviews.find((x) => x.id === m[1])!, { hidden: c.body.hidden }));
A('GET', '/promos', () => db.promos.map((p, i) => ({ id: p.id || (p.id = 'promo' + i), usedCount: 0, active: true, ...p })));
A('POST', '/promos', (c) => { const p = { id: id('pr'), usedCount: 0, active: true, ...c.body }; db.promos.unshift(p); return p; });
A('PATCH', '/promos/:id', (c, m) => Object.assign(db.promos.find((x) => x.id === m[1])!, c.body));
A('DELETE', '/promos/:id', (c, m) => { db.promos = db.promos.filter((x) => x.id !== m[1]); return { ok: true }; });
A('GET', '/insurance', () => db.plans);
A('POST', '/insurance', (c) => { const p = { id: id('ip'), ...c.body }; db.plans.push(p); return p; });
A('PATCH', '/insurance/:id', (c, m) => Object.assign(db.plans.find((x) => x.id === m[1])!, c.body));
A('GET', '/help', () => db.help);
A('POST', '/help', (c) => { const a = { id: id('h'), ...c.body }; db.help.push(a); return a; });
A('PATCH', '/help/:id', (c, m) => Object.assign(db.help.find((x) => x.id === m[1])!, c.body));
A('DELETE', '/help/:id', (c, m) => { db.help = db.help.filter((x) => x.id !== m[1]); return { ok: true }; });
A('GET', '/settings', () => SETTINGS);
A('PUT', '/settings', (c) => { Object.assign(SETTINGS, c.body); for (const k of Object.keys(S)) if (k in c.body) (S as Any)[k] = c.body[k]; return SETTINGS; });
A('GET', '/tickets', (c) => db.tickets.filter((t) => !c.q.status || t.status === c.q.status).map((t) => ({ ...t, user: user(t.userId) })));
A('POST', '/tickets/:id', (c, m) => {
  const t = db.tickets.find((x) => x.id === m[1])!; Object.assign(t, c.body);
  if (c.body.reply) notify(t.userId, 'TICKET_REPLY', 'Réponse du support Rentaya', c.body.reply);
  return t;
});

export async function demoApi(method: string, path: string, query: Any | undefined, body: Any | undefined, token: string | null) {
  await new Promise((r) => setTimeout(r, 120)); // petite latence réaliste
  const me = token?.startsWith('demo:') ? db.users.find((u) => u.id === token.slice(5)) : undefined;
  for (const [mth, re, h, auth] of routes) {
    if (mth !== method) continue;
    const m = path.match(re);
    if (!m) continue;
    if (auth && !me) throw err('UNAUTHORIZED', 401);
    // copie profonde pour imiter le JSON d'un vrai serveur
    return JSON.parse(JSON.stringify(h({ method, path, q: query || {}, body: body || {}, me: me as Any }, m) ?? {}));
  }
  throw err('NOT_FOUND', 404);
}
export { DemoError };
