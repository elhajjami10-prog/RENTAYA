import React, { useLayoutEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { router, useNavigation } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Chip, Empty, Loading, Row, T } from '../components/ui';
import { CarCard, type CarSummary } from '../components/CarCard';
import CarMap from '../components/CarMap';
import { CityPicker } from '../components/CityPicker';
import { DateRangePicker } from '../components/DateRangePicker';
import { activeFilterCount, CITIES, searchQuery, useSearch } from '../lib/search';
import { api } from '../lib/api';
import { fmtDate } from '../lib/format';
import { colors, radius } from '../lib/theme';

export default function Search() {
  const { t } = useTranslation();
  const nav = useNavigation();
  const { width } = useWindowDimensions();
  const { s, set, setFilters } = useSearch();
  const [view, setView] = useState<'list' | 'map'>('list');
  const [cityOpen, setCityOpen] = useState(false);
  const [datesOpen, setDatesOpen] = useState(false);
  const q = searchQuery(s);
  const res = useQuery({ queryKey: ['search', q], queryFn: () => api<{ total: number; items: (CarSummary & { latitude: number; longitude: number })[] }>('/cars', { query: { ...q, pageSize: 100 } }) });
  const n = activeFilterCount(s.filters);
  const wide = width > 900;
  const center = s.lat != null ? { lat: s.lat, lng: s.lng! } : (() => { const c = CITIES.find((x) => x.name === s.city); return c ? { lat: c.lat, lng: c.lng } : { lat: 33.5731, lng: -7.5898 }; })();

  useLayoutEffect(() => { nav.setOptions({ title: s.label || t('search.results') }); }, [nav, s.label, t]);

  const sorts = [
    ['distance', 'filters.sortRelevance'], ['price_asc', 'filters.sortPriceAsc'], ['price_desc', 'filters.sortPriceDesc'], ['rating', 'filters.sortRating'], ['newest', 'filters.sortNewest'],
  ] as const;

  const header = (
    <View style={{ gap: 10, paddingBottom: 12 }}>
      <Row gap={8}>
        <Pressable style={st.pill} onPress={() => setCityOpen(true)}><Ionicons name="location" size={16} color={colors.primary} /><T variant="small" numberOfLines={1} style={{ fontWeight: '700' }}>{s.label || t('search.where')}</T></Pressable>
        <Pressable style={[st.pill, { flex: 1 }]} onPress={() => setDatesOpen(true)}><Ionicons name="calendar" size={16} color={colors.primary} /><T variant="small" numberOfLines={1} style={{ fontWeight: '700' }}>{s.start && s.end ? `${fmtDate(s.start)} → ${fmtDate(s.end)}` : t('search.pickDates')}</T></Pressable>
      </Row>
      <Row gap={8} style={{ flexWrap: 'wrap' }}>
        <Chip label={n ? `${t('filters.title')} (${n})` : t('filters.title')} icon="options" selected={n > 0} onPress={() => router.push('/filters')} />
        <Chip label={t('car.instant')} icon="flash" selected={!!s.filters.instant} onPress={() => setFilters({ instant: !s.filters.instant })} />
        <Chip label={t('enums.transmission.AUTOMATIC')} selected={s.filters.transmission === 'AUTOMATIC'} onPress={() => setFilters({ transmission: s.filters.transmission === 'AUTOMATIC' ? undefined : 'AUTOMATIC' })} />
        <Chip label={t('car.delivery')} icon="navigate" selected={!!s.filters.delivery} onPress={() => setFilters({ delivery: !s.filters.delivery })} />
        {!wide ? <Chip label={view === 'list' ? t('search.map') : t('search.list')} icon={view === 'list' ? 'map' : 'list'} onPress={() => setView(view === 'list' ? 'map' : 'list')} /> : null}
      </Row>
      <Row style={{ justifyContent: 'space-between' }}>
        <T variant="small" style={{ fontWeight: '700' }}>{t('search.count', { count: res.data?.total ?? 0 })}</T>
        <Pressable onPress={() => { const i = sorts.findIndex(([v]) => v === (s.filters.sort || 'distance')); setFilters({ sort: sorts[(i + 1) % sorts.length][0] }); }}>
          <Row gap={4}><Ionicons name="swap-vertical" size={15} color={colors.primary} /><T variant="small" color={colors.primary} style={{ fontWeight: '700' }}>{t(sorts.find(([v]) => v === (s.filters.sort || 'distance'))![1])}</T></Row>
        </Pressable>
      </Row>
    </View>
  );

  const items = res.data?.items || [];
  const list = (
    <FlatList
      data={items}
      keyExtractor={(c) => c.id}
      ListHeaderComponent={header}
      contentContainerStyle={{ padding: 16, gap: 14 }}
      renderItem={({ item }) => <CarCard car={item} />}
      ListEmptyComponent={res.isLoading ? <Loading /> : <Empty icon="search" title={t('search.empty')} text={t('search.emptyText')} />}
      refreshing={res.isRefetching}
      onRefresh={() => res.refetch()}
    />
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      {wide ? (
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <View style={{ width: 460 }}>{list}</View>
          <View style={{ flex: 1, padding: 16 }}><CarMap cars={items} center={center} onSelect={(id) => router.push(`/car/${id}`)} height={800} /></View>
        </View>
      ) : view === 'list' ? list : (
        <View style={{ flex: 1 }}>
          <View style={{ padding: 16, paddingBottom: 0 }}>{header}</View>
          <CarMap cars={items} center={center} onSelect={(id) => router.push(`/car/${id}`)} height={620} />
        </View>
      )}
      <CityPicker visible={cityOpen} onClose={() => setCityOpen(false)} onPick={(p) => set({ city: p.city, label: p.label, lat: p.lat, lng: p.lng })} />
      {datesOpen ? <DateRangePicker visible value={{ start: s.start, end: s.end }} onClose={() => setDatesOpen(false)} onChange={(r) => set(r)} /> : null}
    </View>
  );
}

const st = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 10, maxWidth: '55%' },
});
