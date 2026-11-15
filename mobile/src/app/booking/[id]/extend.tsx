import React, { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button, Card, KV, Loading, Notice, Screen, T } from '../../../components/ui';
import { DateRangePicker } from '../../../components/DateRangePicker';
import { api } from '../../../lib/api';
import { apiErrorMessage, fmtDateTime, money } from '../../../lib/format';
import { colors } from '../../../lib/theme';

export default function Extend() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const b = useQuery({ queryKey: ['booking', id], queryFn: () => api(`/bookings/${id}`) });
  const [newEnd, setNewEnd] = useState<Date | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!b.data) return <Loading />;
  const end = new Date(b.data.endAt);
  const extraDays = newEnd ? Math.max(0, Math.ceil((newEnd.getTime() - new Date(b.data.startAt).getTime()) / 86400000) - b.data.days) : 0;

  const submit = async () => {
    setBusy(true);
    try {
      await api(`/bookings/${id}/extensions`, { body: { newEndAt: newEnd } });
      Alert.alert(t('extend.sent'), t('extend.sentText'));
      router.back();
    } catch (e) { Alert.alert(t('errors.title'), apiErrorMessage(e)); }
    finally { setBusy(false); }
  };

  return (
    <Screen footer={<Button title={t('extend.send')} disabled={!newEnd || newEnd <= end} loading={busy} onPress={submit} />}>
      <Notice icon="time" text={t('extend.intro')} />
      <Card style={{ marginTop: 14 }}>
        <KV k={t('extend.currentEnd')} v={fmtDateTime(end)} />
        <Pressable onPress={() => setOpen(true)}>
          <KV k={t('extend.newEnd')} v={<T color={colors.primary} style={{ fontWeight: '700' }}>{newEnd ? fmtDateTime(newEnd) : t('common.choose')}</T>} />
        </Pressable>
        {newEnd ? <KV k={t('extend.extraCost', { count: extraDays })} v={money(extraDays * b.data.pricePerDay)} bold /> : null}
      </Card>
      <View style={{ height: 10 }} />
      {open ? <DateRangePicker visible single value={{ start: newEnd || end }} onClose={() => setOpen(false)} onChange={(r) => setNewEnd(r.start)} /> : null}
    </Screen>
  );
}
