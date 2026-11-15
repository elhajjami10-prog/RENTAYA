import type { Car, CancellationPolicy, InsurancePlan, PriceOverride } from '@prisma/client';
import type { Settings } from './settings.js';

const DAY = 24 * 3600 * 1000;

/** Nombre de jours facturés (tranche de 24h entamée = jour facturé). */
export function rentalDays(start: Date, end: Date) {
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / DAY));
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

/** Prix d'une journée en tenant compte du calendrier et de la tarification intelligente. */
export function dayPrice(car: Pick<Car, 'pricePerDay' | 'smartPricing'>, date: Date, overrides: Map<string, number>) {
  const o = overrides.get(isoDate(date));
  if (o != null) return o;
  let p = car.pricePerDay;
  if (car.smartPricing) {
    const dow = date.getUTCDay();
    const month = date.getUTCMonth();
    if (dow === 5 || dow === 6) p *= 1.1; // vendredi / samedi
    if (month === 6 || month === 7) p *= 1.2; // haute saison (été, MRE)
    if (month === 11 && date.getUTCDate() >= 20) p *= 1.15; // fêtes de fin d'année
  }
  return Math.round(p);
}

export interface QuoteInput {
  car: Car & { priceOverrides?: PriceOverride[] };
  start: Date;
  end: Date;
  insurancePlan?: InsurancePlan | null;
  delivery?: boolean;
  promo?: { discount: number } | null;
  walletAvailable?: number;
  useWallet?: boolean;
  settings: Settings;
}

export interface Quote {
  days: number;
  pricePerDay: number; // moyenne
  basePrice: number;
  discountAmount: number;
  discountPercent: number;
  rentalPrice: number;
  deliveryFee: number;
  insuranceFee: number;
  serviceFee: number;
  promoDiscount: number;
  walletUsed: number;
  totalPrice: number;
  commission: number;
  ownerEarnings: number;
  depositAmount: number;
  kmIncluded: number;
  unlimitedKm: boolean;
  extraKmPrice: number;
}

export function computeQuote(i: QuoteInput): Quote {
  const days = rentalDays(i.start, i.end);
  const overrides = new Map((i.car.priceOverrides || []).map((o) => [isoDate(o.date), o.price]));
  let basePrice = 0;
  for (let d = 0; d < days; d++) basePrice += dayPrice(i.car, new Date(i.start.getTime() + d * DAY), overrides);

  const discountPercent = days >= 28 ? i.car.monthlyDiscount : days >= 7 ? i.car.weeklyDiscount : 0;
  const discountAmount = Math.round((basePrice * discountPercent) / 100);
  const rentalPrice = basePrice - discountAmount;
  const deliveryFee = i.delivery && i.car.deliveryAvailable ? i.car.deliveryPrice : 0;
  const insuranceFee = (i.insurancePlan?.pricePerDay || 0) * days;
  const serviceFee = Math.max(i.settings.minServiceFee, Math.round((rentalPrice * i.settings.serviceFeePercent) / 100));
  const gross = rentalPrice + deliveryFee + insuranceFee + serviceFee;
  const promoDiscount = Math.min(i.promo?.discount || 0, gross);
  const walletUsed = i.useWallet ? Math.min(i.walletAvailable || 0, gross - promoDiscount) : 0;
  const totalPrice = gross - promoDiscount - walletUsed;
  const ownerCommission = Math.round((rentalPrice * i.settings.commissionPercent) / 100);
  const ownerEarnings = rentalPrice - ownerCommission + deliveryFee;

  return {
    days,
    pricePerDay: Math.round(basePrice / days),
    basePrice,
    discountAmount,
    discountPercent,
    rentalPrice,
    deliveryFee,
    insuranceFee,
    serviceFee,
    promoDiscount,
    walletUsed,
    totalPrice,
    commission: ownerCommission + serviceFee + insuranceFee - promoDiscount - walletUsed,
    ownerEarnings,
    depositAmount: i.car.depositAmount,
    kmIncluded: i.car.unlimitedKm ? 0 : i.car.kmPerDay * days,
    unlimitedKm: i.car.unlimitedKm,
    extraKmPrice: i.car.extraKmPrice,
  };
}

/**
 * Remboursement en cas d'annulation par le conducteur.
 * Les frais de service ne sont remboursés que si l'annulation est gratuite.
 */
export function driverCancellationRefund(
  policy: CancellationPolicy,
  start: Date,
  now: Date,
  b: { totalPrice: number; serviceFee: number; walletUsed: number },
) {
  const hours = (start.getTime() - now.getTime()) / 3600_000;
  const rules: Record<CancellationPolicy, [number, number][]> = {
    FLEXIBLE: [[24, 1], [0, 0.5]],
    MODERATE: [[48, 1], [24, 0.5], [0, 0]],
    STRICT: [[168, 1], [48, 0.5], [0, 0]],
  };
  let ratio = 0;
  for (const [h, r] of rules[policy]) if (hours >= h) { ratio = r; break; }
  const paid = b.totalPrice + b.walletUsed;
  if (ratio === 1) return { ratio, refund: paid };
  const refundable = Math.max(0, paid - b.serviceFee);
  return { ratio, refund: Math.round(refundable * ratio) };
}

/** Prix conseillé par la tarification intelligente (MAD / jour). */
export function suggestPrice(category: string, year: number, city: string) {
  const base: Record<string, number> = {
    CITADINE: 250, COMPACTE: 300, BERLINE: 400, SUV: 550, QUATRE_X_QUATRE: 750, MONOSPACE: 500,
    BREAK: 380, CABRIOLET: 800, LUXE: 1500, UTILITAIRE: 450, MINIBUS: 900,
  };
  const age = Math.max(0, new Date().getFullYear() - year);
  const ageFactor = Math.max(0.6, 1 - age * 0.04);
  const tourist = ['Marrakech', 'Agadir', 'Tanger', 'Essaouira', 'Fès'].includes(city) ? 1.1 : 1;
  const p = (base[category] || 300) * ageFactor * tourist;
  return { suggested: Math.round(p / 10) * 10, min: Math.round((p * 0.8) / 10) * 10, max: Math.round((p * 1.25) / 10) * 10 };
}
