import React from 'react';
import { FlatList, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Badge, Card, Empty, Loading, Row, T } from '../../components/ui';
import { api } from '../../lib/api';
import { fmtDate, money } from '../../lib/format';
import { colors } from '../../lib/theme';

const TONE: Record<string, 'success' | 'warning' | 'danger' | 'muted' | 'primary'> = { PAID: 'success', REFUNDED: 'primary', PENDING: 'warning', AWAITING_VALIDATION: 'warning', FAILED: 'danger', CANCELLED: 'muted' };

export default function Payments() {
  const { t } = useTranslation();
  const q = useQuery({ queryKey: ['payments'], queryFn: () => api('/payments') });
  return (
    <FlatList style={{ backgroundColor: '#fff' }} data={q.data || []} keyExtractor={(p) => p.id}
      contentContainerStyle={{ padding: 16, gap: 10, maxWidth: 820, width: '100%', alignSelf: 'center' }}
      refreshing={q.isRefetching} onRefresh={() => q.refetch()}
      ListEmptyComponent={q.isLoading ? <Loading /> : <Empty icon="receipt-outline" title={t('paymentsHistory.empty')} />}
      renderItem={({ item: p }) => (
        <Card onPress={p.bookingId ? () => router.push(`/booking/${p.bookingId}`) : undefined}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <T style={{ fontWeight: '700' }}>{t(`enums.paymentType.${p.type}`)}{p.booking ? ` · ${p.booking.car.make} ${p.booking.car.model}` : ''}</T>
              <T variant="caption">{fmtDate(p.createdAt, true)} · {t(`payment.methods.${p.method}`)} · {p.orderId}</T>
            </View>
            <T style={{ fontWeight: '800' }} color={p.type === 'REFUND' ? colors.success : colors.ink}>{p.type === 'REFUND' ? '+' : ''}{money(p.amount)}</T>
          </Row>
          <View style={{ marginTop: 6 }}><Badge label={t(`enums.paymentStatus.${p.status}`)} tone={TONE[p.status] || 'muted'} /></View>
        </Card>
      )} />
  );
}
