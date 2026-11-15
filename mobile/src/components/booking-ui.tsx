import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Badge, Divider, KV } from './ui';
import { money } from '../lib/format';
import { colors } from '../lib/theme';

export const STATUS_TONE: Record<string, 'primary' | 'success' | 'warning' | 'danger' | 'muted'> = {
  REQUESTED: 'warning', PENDING_PAYMENT: 'warning', CONFIRMED: 'success', IN_PROGRESS: 'primary', COMPLETED: 'muted',
  DECLINED: 'danger', EXPIRED: 'muted', CANCELLED_BY_DRIVER: 'danger', CANCELLED_BY_OWNER: 'danger', CANCELLED_BY_ADMIN: 'danger',
};

export function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  return <Badge label={t(`enums.bookingStatus.${status}`)} tone={STATUS_TONE[status] || 'muted'} />;
}

export type PriceData = {
  days: number; basePrice: number; discountAmount: number; discountPercent?: number; deliveryFee: number; insuranceFee: number;
  serviceFee: number; promoDiscount: number; walletUsed: number; totalPrice: number; depositAmount: number;
  ownerEarnings?: number; commission?: number; pricePerDay?: number;
};

/** Détail du prix côté conducteur ou côté propriétaire. */
export function PriceBreakdown({ q, owner }: { q: PriceData; owner?: boolean }) {
  const { t } = useTranslation();
  const rental = q.basePrice - q.discountAmount;
  if (owner) {
    return (
      <View>
        <KV k={t('price.rental', { count: q.days })} v={money(rental)} />
        {q.deliveryFee ? <KV k={t('price.delivery')} v={money(q.deliveryFee)} /> : null}
        <KV k={t('price.commission')} v={`- ${money(rental + q.deliveryFee - (q.ownerEarnings || 0))}`} />
        <Divider style={{ marginVertical: 8 }} />
        <KV k={t('price.yourEarnings')} v={money(q.ownerEarnings)} bold color={colors.success} />
      </View>
    );
  }
  return (
    <View>
      <KV k={t('price.rental', { count: q.days })} v={money(q.basePrice)} />
      {q.discountAmount ? <KV k={t('price.longDiscount', { pct: q.discountPercent ?? '' })} v={`- ${money(q.discountAmount)}`} color={colors.success} /> : null}
      {q.deliveryFee ? <KV k={t('price.delivery')} v={money(q.deliveryFee)} /> : null}
      <KV k={t('price.insurance')} v={q.insuranceFee ? money(q.insuranceFee) : t('price.included')} />
      <KV k={t('price.serviceFee')} v={money(q.serviceFee)} />
      {q.promoDiscount ? <KV k={t('price.promo')} v={`- ${money(q.promoDiscount)}`} color={colors.success} /> : null}
      {q.walletUsed ? <KV k={t('price.wallet')} v={`- ${money(q.walletUsed)}`} color={colors.success} /> : null}
      <Divider style={{ marginVertical: 8 }} />
      <KV k={t('price.total')} v={money(q.totalPrice)} bold />
      <KV k={t('price.deposit')} v={money(q.depositAmount)} />
    </View>
  );
}
