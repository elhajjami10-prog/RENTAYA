import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Badge, Card, KV, Loading, Notice, Row, Screen, Section, T } from '../../components/ui';
import { api } from '../../lib/api';
import { fmtDate, money } from '../../lib/format';
import { colors } from '../../lib/theme';

export default function Earnings() {
  const { t, i18n } = useTranslation();
  const [year, setYear] = useState(new Date().getFullYear());
  const q = useQuery({ queryKey: ['earnings', year], queryFn: () => api('/account/earnings', { query: { year } }) });
  if (!q.data) return <Loading />;
  const e = q.data;
  const max = Math.max(1, ...e.months.map((m: any) => m.earnings));
  const loc = i18n.language === 'ar' ? 'ar-MA' : i18n.language === 'en' ? 'en-GB' : 'fr-FR';
  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      {!e.bankConfigured ? <View style={{ marginBottom: 14 }}><Notice tone="warning" icon="business" text={t('earnings.noBank')} action={t('bank.title')} onAction={() => router.push('/account/bank')} /></View> : null}
      <Row>
        <Card style={{ flex: 1 }}><T variant="caption">{t('earnings.pending')}</T><T variant="h2" color={colors.primaryDark}>{money(e.pendingPayout)}</T></Card>
        <Card style={{ flex: 1 }}><T variant="caption">{t('earnings.upcoming')}</T><T variant="h2">{money(e.upcoming)}</T></Card>
      </Row>
      <Section title={t('earnings.year')}>
        <Card>
          <Row style={{ justifyContent: 'space-between', marginBottom: 12 }}>
            <Pressable onPress={() => setYear(year - 1)} hitSlop={10}><Ionicons name="chevron-back" size={22} color={colors.primary} /></Pressable>
            <View style={{ alignItems: 'center' }}><T variant="label">{year}</T><T variant="h2" color={colors.success}>{money(e.total)}</T></View>
            <Pressable disabled={year >= new Date().getFullYear()} onPress={() => setYear(year + 1)} hitSlop={10}><Ionicons name="chevron-forward" size={22} color={year >= new Date().getFullYear() ? colors.border : colors.primary} /></Pressable>
          </Row>
          <Row style={{ alignItems: 'flex-end', height: 140 }} gap={4}>
            {e.months.map((m: any) => (
              <View key={m.month} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                <View style={{ width: '100%', height: Math.max(3, (m.earnings / max) * 110), backgroundColor: m.earnings ? colors.primary : colors.border, borderRadius: 4 }} />
                <T style={{ fontSize: 10 }} color={colors.inkSoft}>{new Date(2024, m.month - 1, 1).toLocaleDateString(loc, { month: 'narrow' })}</T>
              </View>
            ))}
          </Row>
        </Card>
      </Section>
      {e.byCar.length ? (
        <Section title={t('earnings.byCar')}>
          <Card>{e.byCar.map((c: any) => <KV key={c.carId} k={`${c.name} (${t('earnings.bookings', { count: c.bookings })})`} v={money(c.earnings)} />)}</Card>
        </Section>
      ) : null}
      <Section title={t('earnings.payouts')}>
        {e.payouts.length === 0 ? <T variant="small" color={colors.inkSoft}>{t('earnings.noPayouts')}</T> : null}
        {e.payouts.map((p: any) => (
          <Card key={p.id} style={{ marginBottom: 8 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View><T style={{ fontWeight: '700' }}>{money(p.amount)}</T><T variant="caption">{fmtDate(p.paidAt || p.createdAt, true)}{p.reference ? ` · ${p.reference}` : ''}</T></View>
              <Badge label={t(`enums.payoutStatus.${p.status}`)} tone={p.status === 'PAID' ? 'success' : p.status === 'FAILED' ? 'danger' : 'warning'} />
            </Row>
          </Card>
        ))}
        <T variant="caption" style={{ marginTop: 8 }}>{t('earnings.payoutInfo')}</T>
      </Section>
    </Screen>
  );
}
