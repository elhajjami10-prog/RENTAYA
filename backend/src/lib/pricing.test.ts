import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeQuote, driverCancellationRefund, rentalDays } from './pricing.js';
import { cmiHash } from './cmi.js';
import { DEFAULT_SETTINGS } from './settings.js';

const car = {
  pricePerDay: 300, smartPricing: false, weeklyDiscount: 10, monthlyDiscount: 25, deliveryAvailable: true, deliveryPrice: 100,
  depositAmount: 3000, unlimitedKm: false, kmPerDay: 200, extraKmPrice: 1.5, priceOverrides: [],
} as never;
const d = (s: string) => new Date(s);

test('jours facturés : toute tranche de 24 h entamée compte', () => {
  assert.equal(rentalDays(d('2026-01-01T10:00Z'), d('2026-01-02T10:00Z')), 1);
  assert.equal(rentalDays(d('2026-01-01T10:00Z'), d('2026-01-02T11:00Z')), 2);
  assert.equal(rentalDays(d('2026-01-01T10:00Z'), d('2026-01-01T12:00Z')), 1);
});

test('devis : réduction 7 jours, livraison, assurance, frais de service, commission', () => {
  const q = computeQuote({ car, start: d('2026-01-01T10:00Z'), end: d('2026-01-08T10:00Z'), delivery: true, insurancePlan: { pricePerDay: 60 } as never, settings: DEFAULT_SETTINGS });
  assert.equal(q.days, 7);
  assert.equal(q.basePrice, 2100);
  assert.equal(q.discountAmount, 210);
  assert.equal(q.rentalPrice, 1890);
  assert.equal(q.insuranceFee, 420);
  assert.equal(q.serviceFee, 189);
  assert.equal(q.totalPrice, 1890 + 100 + 420 + 189);
  assert.equal(q.ownerEarnings, 1890 - 378 + 100);
  assert.equal(q.totalPrice, q.ownerEarnings + q.commission);
  assert.equal(q.kmIncluded, 1400);
});

test('devis : code promo et crédit réduisent la part Rentaya, pas celle du propriétaire', () => {
  const base = computeQuote({ car, start: d('2026-01-01T10:00Z'), end: d('2026-01-03T10:00Z'), settings: DEFAULT_SETTINGS });
  const q = computeQuote({ car, start: d('2026-01-01T10:00Z'), end: d('2026-01-03T10:00Z'), promo: { discount: 50 }, useWallet: true, walletAvailable: 30, settings: DEFAULT_SETTINGS });
  assert.equal(q.totalPrice, base.totalPrice - 80);
  assert.equal(q.ownerEarnings, base.ownerEarnings);
  assert.equal(q.totalPrice + q.walletUsed + q.promoDiscount, base.totalPrice);
});

test('annulation conducteur selon la politique', () => {
  const b = { totalPrice: 1000, serviceFee: 100, walletUsed: 0 };
  const start = d('2026-01-10T10:00Z');
  assert.deepEqual(driverCancellationRefund('MODERATE', start, d('2026-01-07T10:00Z'), b), { ratio: 1, refund: 1000 });
  assert.deepEqual(driverCancellationRefund('MODERATE', start, d('2026-01-09T00:00Z'), b), { ratio: 0.5, refund: 450 });
  assert.deepEqual(driverCancellationRefund('MODERATE', start, d('2026-01-10T00:00Z'), b), { ratio: 0, refund: 0 });
  assert.deepEqual(driverCancellationRefund('STRICT', start, d('2026-01-05T10:00Z'), b), { ratio: 0.5, refund: 450 });
  assert.deepEqual(driverCancellationRefund('FLEXIBLE', start, d('2026-01-09T09:00Z'), b), { ratio: 1, refund: 1000 });
});

test('hash CMI ver3 : tri insensible à la casse, échappement, exclusion de hash/encoding', () => {
  const h1 = cmiHash({ b: '2', A: '1', encoding: 'UTF-8', hash: 'x' }, 'KEY');
  const h2 = cmiHash({ A: '1', b: '2' }, 'KEY');
  assert.equal(h1, h2);
  assert.notEqual(cmiHash({ A: '1|', b: '2' }, 'KEY'), cmiHash({ A: '1', b: '|2' }, 'KEY'));
  assert.match(h1, /^[A-Za-z0-9+/]+=*$/);
});
