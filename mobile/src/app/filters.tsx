import React, { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, Chip, Field, Row, Screen, Section, Segmented, Stepper, Toggle } from '../components/ui';
import { emptyFilters, useSearch, type Filters } from '../lib/search';
import { CATEGORIES, FEATURES, FUELS } from '../lib/constants';


const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

export default function FiltersScreen() {
  const { t } = useTranslation();
  const { s, setFilters } = useSearch();
  const [f, setF] = useState<Filters>(s.filters);
  const up = (p: Partial<Filters>) => setF((o) => ({ ...o, ...p }));
  return (
    <Screen footer={<Row><Button title={t('filters.reset')} variant="ghost" onPress={() => setF(emptyFilters)} style={{ flex: 1 }} /><Button title={t('filters.apply')} onPress={() => { setFilters(f); router.back(); }} style={{ flex: 2 }} /></Row>}>
      <Section title={t('filters.sort')} style={{ marginTop: 0 }}>
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          {([['distance', 'filters.sortRelevance'], ['price_asc', 'filters.sortPriceAsc'], ['price_desc', 'filters.sortPriceDesc'], ['rating', 'filters.sortRating'], ['newest', 'filters.sortNewest']] as const).map(([v, k]) => (
            <Chip key={v} label={t(k)} selected={(f.sort || 'distance') === v} onPress={() => up({ sort: v })} />
          ))}
        </Row>
      </Section>
      <Section title={t('filters.price')}>
        <Row>
          <Field style={{ flex: 1 }} label={t('filters.minPrice')} keyboardType="numeric" value={f.minPrice ? String(f.minPrice) : ''} onChangeText={(v) => up({ minPrice: Number(v) || undefined })} placeholder="0" />
          <Field style={{ flex: 1 }} label={t('filters.maxPrice')} keyboardType="numeric" value={f.maxPrice ? String(f.maxPrice) : ''} onChangeText={(v) => up({ maxPrice: Number(v) || undefined })} placeholder="2000" />
        </Row>
      </Section>
      <Section title={t('filters.category')}>
        <Row gap={8} style={{ flexWrap: 'wrap' }}>{CATEGORIES.map((c) => <Chip key={c} label={t(`enums.category.${c}`)} selected={f.category.includes(c)} onPress={() => up({ category: toggle(f.category, c) })} />)}</Row>
      </Section>
      <Section title={t('filters.transmission')}>
        <Segmented value={f.transmission || 'ALL'} onChange={(v) => up({ transmission: v === 'ALL' ? undefined : (v as 'MANUAL' | 'AUTOMATIC') })}
          options={[{ value: 'ALL', label: t('common.all') }, { value: 'AUTOMATIC', label: t('enums.transmission.AUTOMATIC') }, { value: 'MANUAL', label: t('enums.transmission.MANUAL') }]} />
      </Section>
      <Section title={t('filters.fuel')}>
        <Row gap={8} style={{ flexWrap: 'wrap' }}>{FUELS.map((c) => <Chip key={c} label={t(`enums.fuel.${c}`)} selected={f.fuel.includes(c)} onPress={() => up({ fuel: toggle(f.fuel, c) })} />)}</Row>
      </Section>
      <Section title={t('filters.options')}>
        <Stepper label={t('filters.minSeats')} value={f.minSeats || 2} min={2} max={9} onChange={(v) => up({ minSeats: v <= 2 ? undefined : v })} />
        <Toggle label={t('car.instant')} description={t('filters.instantHint')} value={!!f.instant} onChange={(v) => up({ instant: v })} />
        <Toggle label={t('car.delivery')} description={t('filters.deliveryHint')} value={!!f.delivery} onChange={(v) => up({ delivery: v })} />
        <Toggle label={t('car.unlimitedKm')} value={!!f.unlimitedKm} onChange={(v) => up({ unlimitedKm: v })} />
      </Section>
      <Section title={t('filters.ownerType')}>
        <Segmented value={f.ownerType || 'all'} onChange={(v) => up({ ownerType: v === 'all' ? undefined : (v as 'pro' | 'private') })}
          options={[{ value: 'all', label: t('common.all') }, { value: 'private', label: t('filters.private') }, { value: 'pro', label: t('filters.pro') }]} />
      </Section>
      <Section title={t('filters.features')}>
        <Row gap={8} style={{ flexWrap: 'wrap' }}>{FEATURES.map((c) => <Chip key={c} label={t(`features.${c}`)} selected={f.features.includes(c)} onPress={() => up({ features: toggle(f.features, c) })} />)}</Row>
      </Section>
      <View style={{ height: 20 }} />
    </Screen>
  );
}
