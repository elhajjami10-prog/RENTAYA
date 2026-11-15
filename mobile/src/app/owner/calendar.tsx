import React, { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Button, Card, Field, Loading, Row, Screen, Section, T } from '../../components/ui';
import { StatusBadge } from '../../components/booking-ui';
import { api } from '../../lib/api';
import { apiErrorMessage, fmtDate } from '../../lib/format';
import { colors, radius } from '../../lib/theme';

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Calendrier du propriétaire : disponibilités et prix jour par jour. */
export default function Calendar() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const [offset, setOffset] = useState(0);
  const [sel, setSel] = useState<string[]>([]);
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false);
  const q = useQuery({ queryKey: ['calendar', id], queryFn: () => api(`/cars/${id}/calendar`) });
  const loc = i18n.language === 'ar' ? 'ar-MA' : i18n.language === 'en' ? 'en-GB' : 'fr-FR';
  const month = useMemo(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + offset, 1); }, [offset]);
  if (!q.data) return <Loading />;
  const cal = q.data;

  const dayState = (d: Date) => {
    const s = new Date(d); s.setHours(0, 0, 0, 0); const e = new Date(s.getTime() + 86400000);
    const overlap = (a: string, b: string) => new Date(a) < e && new Date(b) > s;
    const booking = cal.bookings.find((b: any) => b.status !== 'REQUESTED' && overlap(b.startAt, b.endAt));
    const request = cal.bookings.find((b: any) => b.status === 'REQUESTED' && overlap(b.startAt, b.endAt));
    const blocked = cal.unavailabilities.find((u: any) => overlap(u.startAt, u.endAt));
    const override = cal.overrides.find((o: any) => o.date.slice(0, 10) === iso(d));
    return { booking, request, blocked, price: override?.price ?? cal.pricePerDay, custom: !!override };
  };

  const first = (month.getDay() + 6) % 7;
  const daysIn = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [...Array(first).fill(null), ...Array.from({ length: daysIn }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1))];
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try { await fn(); setSel([]); setPrice(''); await q.refetch(); } catch (e) { Alert.alert(t('errors.title'), apiErrorMessage(e)); } finally { setBusy(false); }
  };
  const sorted = [...sel].sort();
  const block = () => run(async () => {
    // regroupe les jours consécutifs en périodes
    let start = sorted[0]; let prev = sorted[0];
    const ranges: [string, string][] = [];
    for (const d of sorted.slice(1).concat('')) {
      const next = new Date(new Date(prev).getTime() + 86400000);
      if (d && iso(next) === d) { prev = d; continue; }
      ranges.push([start, prev]); start = d; prev = d;
    }
    for (const [a, b] of ranges) {
      const s = new Date(a + 'T00:00:00'); const e = new Date(new Date(b + 'T00:00:00').getTime() + 86400000);
      await api(`/cars/${id}/unavailability`, { body: { startAt: s, endAt: e } });
    }
  });
  const unblock = () => run(async () => {
    const ids = new Set<string>();
    for (const d of sorted) { const st = dayState(new Date(d + 'T12:00:00')); if (st.blocked) ids.add(st.blocked.id); }
    for (const uid of ids) await api(`/cars/${id}/unavailability/${uid}`, { method: 'DELETE' });
  });
  const setPrices = (p: number | null) => run(() => api(`/cars/${id}/prices`, { method: 'PUT', body: { dates: sorted, price: p } }));

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <Pressable disabled={offset === 0} onPress={() => setOffset(offset - 1)} hitSlop={10}><Ionicons name="chevron-back" size={24} color={offset === 0 ? colors.border : colors.primary} /></Pressable>
        <T variant="h3" style={{ textTransform: 'capitalize' }}>{month.toLocaleDateString(loc, { month: 'long', year: 'numeric' })}</T>
        <Pressable onPress={() => setOffset(offset + 1)} hitSlop={10}><Ionicons name="chevron-forward" size={24} color={colors.primary} /></Pressable>
      </Row>
      <View style={st.grid}>
        {cells.map((d, i) => {
          if (!d) return <View key={i} style={st.cell} />;
          const s = dayState(d); const k = iso(d); const on = sel.includes(k); const past = d < today;
          const bg = s.booking ? colors.primary : s.blocked ? '#D9D2E5' : s.request ? colors.warningSoft : '#fff';
          return (
            <Pressable key={i} disabled={past || !!s.booking} onPress={() => setSel(on ? sel.filter((x) => x !== k) : [...sel, k])} style={st.cell}>
              <View style={[st.day, { backgroundColor: bg }, on && { borderColor: colors.primaryDark, borderWidth: 2.5 }, past && { opacity: 0.4 }]}>
                <T variant="small" style={{ fontWeight: '700' }} color={s.booking ? '#fff' : colors.ink}>{d.getDate()}</T>
                <T style={{ fontSize: 10 }} color={s.booking ? '#fff' : s.custom ? colors.primary : colors.inkSoft}>{s.booking || s.blocked ? '—' : s.price}</T>
              </View>
            </Pressable>
          );
        })}
      </View>
      <Row gap={14} style={{ flexWrap: 'wrap', marginTop: 8 }}>
        {[[colors.primary, t('calendar.booked')], ['#D9D2E5', t('calendar.blocked')], [colors.warningSoft, t('calendar.request')]].map(([c, l]) => (
          <Row key={l} gap={6}><View style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: c }} /><T variant="caption">{l}</T></Row>
        ))}
      </Row>

      {sel.length ? (
        <Card style={{ marginTop: 16 }}>
          <T style={{ fontWeight: '700' }}>{t('calendar.selected', { count: sel.length })}</T>
          <Row style={{ marginTop: 10 }}>
            <Button small title={t('calendar.block')} icon="lock-closed" variant="secondary" style={{ flex: 1 }} loading={busy} onPress={block} />
            <Button small title={t('calendar.unblock')} icon="lock-open" variant="secondary" style={{ flex: 1 }} loading={busy} onPress={unblock} />
          </Row>
          <Row style={{ marginTop: 10 }}>
            <Field style={{ flex: 1, marginBottom: 0 }} placeholder={t('calendar.customPrice')} keyboardType="numeric" value={price} onChangeText={setPrice} />
            <Button small title={t('common.apply')} disabled={!Number(price)} onPress={() => setPrices(Number(price))} />
          </Row>
          <Button small title={t('calendar.resetPrice')} variant="ghost" onPress={() => setPrices(null)} />
        </Card>
      ) : <T variant="caption" style={{ marginTop: 12 }}>{t('calendar.hint')}</T>}

      <Section title={t('calendar.upcoming')}>
        {cal.bookings.length === 0 ? <T variant="small" color={colors.inkSoft}>{t('garage.noBookings')}</T> : null}
        {cal.bookings.map((b: any) => (
          <Card key={b.id} style={{ marginBottom: 8 }} onPress={() => router.push(`/booking/${b.id}`)}>
            <Row style={{ justifyContent: 'space-between' }}>
              <T style={{ fontWeight: '700' }}>{fmtDate(b.startAt)} → {fmtDate(b.endAt)}</T>
              <StatusBadge status={b.status} />
            </Row>
            <T variant="caption">{b.driver.firstName} · {b.reference}</T>
          </Card>
        ))}
      </Section>
    </Screen>
  );
}

const st = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 },
  cell: { width: `${100 / 7}%`, padding: 2 },
  day: { borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', paddingVertical: 6, minHeight: 50 },
});
