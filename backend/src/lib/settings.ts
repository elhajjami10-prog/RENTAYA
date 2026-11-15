import { prisma } from '../db.js';

/** Paramètres de la plateforme, modifiables depuis le back-office. */
export const DEFAULT_SETTINGS = {
  serviceFeePercent: 10, // frais de service payés par le conducteur (% du prix de location)
  minServiceFee: 20, // MAD
  commissionPercent: 20, // commission prélevée sur le revenu du propriétaire
  requestExpiryHours: 24, // délai de réponse du propriétaire
  cashPaymentWindowHours: 24, // délai pour payer en espèces / Wafacash / CashPlus / virement
  ownerCancelPenalty: 200, // MAD, pénalité si le propriétaire annule une location confirmée
  lateFeePerHour: 50, // MAD
  cleaningFee: 150, // MAD
  fuelPricePerLiter: 14, // MAD
  referralBonusReferee: 100, // MAD crédités au filleul
  referralBonusReferrer: 100, // MAD crédités au parrain après la première location du filleul
  payoutDelayDays: 3, // délai après la fin de la location avant versement
  supportPhone: '+212 5 22 00 00 00',
  supportEmail: 'support@rentaya.ma',
  bankTransferRib: '000 000 0000000000000000 00',
  bankTransferHolder: 'RENTAYA SARL',
};

export type Settings = typeof DEFAULT_SETTINGS;

let cache: { value: Settings; at: number } | null = null;

export async function getSettings(): Promise<Settings> {
  if (cache && Date.now() - cache.at < 30_000) return cache.value;
  const rows = await prisma.setting.findMany();
  const value = { ...DEFAULT_SETTINGS } as Record<string, unknown>;
  for (const r of rows) if (r.key in value) value[r.key] = r.value;
  cache = { value: value as Settings, at: Date.now() };
  return cache.value;
}

export async function updateSettings(patch: Partial<Settings>) {
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in DEFAULT_SETTINGS)) continue;
    await prisma.setting.upsert({ where: { key }, create: { key, value: value as never }, update: { value: value as never } });
  }
  cache = null;
  return getSettings();
}
