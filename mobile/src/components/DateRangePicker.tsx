import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Button, Row, T } from './ui';
import { colors, radius } from '../lib/theme';
import { fmtDateTime } from '../lib/format';

const DAY = 86400000;
const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const sameDay = (a?: Date | null, b?: Date | null) => !!a && !!b && startOfDay(a).getTime() === startOfDay(b).getTime();
const HOURS = Array.from({ length: 33 }, (_, i) => 6 * 60 + i * 30); // 06:00 → 22:00

type Range = { start: Date; end: Date };
type Blocked = { startAt: string; endAt: string }[];

function isBlocked(day: Date, blocked?: Blocked) {
  if (!blocked) return false;
  const s = startOfDay(day).getTime(); const e = s + DAY;
  return blocked.some((b) => new Date(b.startAt).getTime() < e && new Date(b.endAt).getTime() > s + 12 * 3600_000 - 1 && new Date(b.startAt).getTime() <= s + 12 * 3600_000);
}

/** Sélecteur de période (dates + heures de départ et de retour), utilisable sur mobile et web. */
export function DateRangePicker({ visible, value, onClose, onChange, blocked, single }: {
  visible: boolean; value?: Partial<Range>; onClose: () => void; onChange: (r: Range) => void; blocked?: Blocked; single?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const [start, setStart] = useState<Date | null>(value?.start ?? null);
  const [end, setEnd] = useState<Date | null>(value?.end ?? null);
  const [startMin, setStartMin] = useState(value?.start ? value.start.getHours() * 60 + value.start.getMinutes() : 600);
  const [endMin, setEndMin] = useState(value?.end ? value.end.getHours() * 60 + value.end.getMinutes() : 600);
  const today = startOfDay(new Date());
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => new Date(today.getFullYear(), today.getMonth() + i, 1)), [today.getTime()]); // eslint-disable-line
  const loc = i18n.language === 'ar' ? 'ar-MA' : i18n.language === 'en' ? 'en-GB' : 'fr-FR';
  const weekdays = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(loc, { weekday: 'narrow' }));

  const pick = (d: Date) => {
    if (single) { setStart(d); setEnd(d); return; }
    if (!start || (start && end && !sameDay(start, end)) || d < start) { setStart(d); setEnd(null); }
    else setEnd(d);
  };
  const withTime = (d: Date, min: number) => { const x = startOfDay(d); x.setMinutes(min); return x; };
  const result = start && (end || single) ? { start: withTime(start, startMin), end: withTime(end || start, single ? startMin : endMin) } : null;
  const valid = !!result && (single || result.end > result.start) && result.start.getTime() > Date.now();
  const hm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
        <Row style={{ justifyContent: 'space-between', padding: 16 }}>
          <T variant="h2">{single ? t('dates.pickDate') : t('dates.title')}</T>
          <Pressable onPress={onClose} hitSlop={10}><Ionicons name="close" size={26} color={colors.ink} /></Pressable>
        </Row>
        <Row style={{ paddingHorizontal: 16 }}>
          {weekdays.map((w, i) => <T key={i} variant="caption" style={{ flex: 1, textAlign: 'center' }}>{w}</T>)}
        </Row>
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4 }}>
          {months.map((m) => {
            const first = (m.getDay() + 6) % 7; // lundi = 0
            const daysIn = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
            const cells: (Date | null)[] = [...Array(first).fill(null), ...Array.from({ length: daysIn }, (_, i) => new Date(m.getFullYear(), m.getMonth(), i + 1))];
            return (
              <View key={m.toISOString()} style={{ marginBottom: 18 }}>
                <T variant="h3" style={{ marginBottom: 8, textTransform: 'capitalize' }}>{m.toLocaleDateString(loc, { month: 'long', year: 'numeric' })}</T>
                <View style={s.grid}>
                  {cells.map((d, i) => {
                    if (!d) return <View key={i} style={s.cell} />;
                    const past = d < today;
                    const blockedDay = isBlocked(d, blocked);
                    const isStart = sameDay(d, start); const isEnd = sameDay(d, end);
                    const inRange = start && end && d > start && d < end;
                    return (
                      <Pressable key={i} disabled={past || blockedDay} onPress={() => pick(d)} style={[s.cell, inRange && s.inRange]}>
                        <View style={[s.day, (isStart || isEnd) && s.daySel]}>
                          <T style={[{ fontSize: 15 }, (past || blockedDay) && { color: '#CFC6DD', textDecorationLine: blockedDay ? 'line-through' : 'none' }, (isStart || isEnd) && { color: '#fff', fontWeight: '800' }]}>{d.getDate()}</T>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </ScrollView>
        <View style={s.footer}>
          <T variant="label">{t('dates.startTime')}</T>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 6 }}>
            {HOURS.map((h) => <Pressable key={h} onPress={() => setStartMin(h)} style={[s.hour, h === startMin && s.hourOn]}><T variant="small" color={h === startMin ? '#fff' : colors.ink}>{hm(h)}</T></Pressable>)}
          </ScrollView>
          {!single ? <>
            <T variant="label">{t('dates.endTime')}</T>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 6 }}>
              {HOURS.map((h) => <Pressable key={h} onPress={() => setEndMin(h)} style={[s.hour, h === endMin && s.hourOn]}><T variant="small" color={h === endMin ? '#fff' : colors.ink}>{hm(h)}</T></Pressable>)}
            </ScrollView>
          </> : null}
          {result ? <T variant="small" center style={{ marginVertical: 6 }}>{single ? fmtDateTime(result.start) : `${fmtDateTime(result.start)} → ${fmtDateTime(result.end)}`}</T> : null}
          <Button title={t('common.confirm')} disabled={!valid} onPress={() => { if (result) { onChange(result); onClose(); } }} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', maxHeight: 54 },
  inRange: { backgroundColor: colors.primarySoft },
  day: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  daySel: { backgroundColor: colors.primary },
  footer: { borderTopWidth: 1, borderTopColor: colors.border, padding: 16, gap: 4 },
  hour: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.bgSoft },
  hourOn: { backgroundColor: colors.primary },
});
