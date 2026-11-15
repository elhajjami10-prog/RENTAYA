import React, { useEffect, useState } from 'react';
import { Alert, Platform, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { useTranslation } from 'react-i18next';
import { Button, Chip, Field, Loading, Notice, Row, Screen, Section, Segmented, Stepper, T, Toggle, Card, KV } from '../../components/ui';
import { PhotoPicker } from '../../components/PhotoPicker';
import { api } from '../../lib/api';
import { apiErrorMessage, money } from '../../lib/format';
import { CITIES } from '../../lib/search';
import { CATEGORIES, FEATURES, FUELS, MAKES } from '../../lib/constants';
import { colors } from '../../lib/theme';

const STEPS = 6;
const blank = {
  make: '', model: '', year: new Date().getFullYear() - 3, plate: '', category: 'CITADINE', transmission: 'MANUAL', fuel: 'DIESEL',
  seats: 5, doors: 5, odometerKm: 50000, color: '', photos: [] as string[], city: 'Casablanca', district: '', address: '',
  latitude: 33.5731, longitude: -7.5898, pickupInstructions: '', title: '', description: '', features: ['AC'] as string[],
  pricePerDay: 300, smartPricing: true, weeklyDiscount: 10, monthlyDiscount: 25, depositAmount: 3000, kmPerDay: 250, unlimitedKm: false, extraKmPrice: 1.5,
  instantBooking: false, minDays: 1, maxDays: 30, advanceNoticeHours: 4, minDriverAge: 21, minLicenseYears: 2,
  cancellationPolicy: 'MODERATE', fuelPolicy: 'SAME_LEVEL', smokingAllowed: false, petsAllowed: false, crossBorderAllowed: false,
  deliveryAvailable: false, deliveryPrice: 100, deliveryRadiusKm: 10, airportDelivery: false,
};
type Form = typeof blank;

export default function CarForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [f, setF] = useState<Form>(blank);
  const [busy, setBusy] = useState(false);
  const existing = useQuery({ queryKey: ['car', id], queryFn: () => api(`/cars/${id}`), enabled: !!id });
  const suggestion = useQuery({ queryKey: ['suggest', f.category, f.year, f.city], queryFn: () => api('/cars/meta/suggest-price', { query: { category: f.category, year: f.year, city: f.city } }) });

  useEffect(() => {
    if (existing.data) {
      const c = existing.data;
      const next = { ...blank } as Record<string, unknown>;
      for (const k of Object.keys(blank)) if (c[k] !== undefined && c[k] !== null) next[k] = c[k];
      next.photos = c.photos.map((p: { url: string }) => p.url);
      setF(next as Form);
    }
  }, [existing.data]);
  if (id && !existing.data) return <Loading />;

  const up = (p: Partial<Form>) => setF((o) => ({ ...o, ...p }));
  const num = (k: keyof Form) => (v: string) => up({ [k]: Number(v.replace(',', '.')) || 0 } as Partial<Form>);

  const locate = async () => {
    try {
      if (Platform.OS !== 'web' && f.address) {
        const r = await Location.geocodeAsync(`${f.address}, ${f.city}, Maroc`);
        if (r[0]) return up({ latitude: r[0].latitude, longitude: r[0].longitude });
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const pos = await Location.getCurrentPositionAsync({});
      up({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      Alert.alert(t('carForm.located'));
    } catch { Alert.alert(t('errors.generic')); }
  };

  const valid = [
    f.make && f.model && f.plate.length >= 3 && f.year > 1990,
    f.photos.length >= 3,
    f.city && f.address.length >= 3,
    true,
    f.pricePerDay >= 50,
    true,
  ][step];

  const save = async () => {
    setBusy(true);
    try {
      const body = { ...f, color: f.color || null, title: f.title || null, district: f.district || null };
      const car = id ? await api(`/cars/${id}`, { method: 'PATCH', body }) : await api('/cars', { body });
      await qc.invalidateQueries({ queryKey: ['myCars'] });
      await qc.invalidateQueries({ queryKey: ['car', car.id] });
      Alert.alert(id ? t('carForm.saved') : t('carForm.submitted'), id ? '' : t('carForm.submittedText'));
      router.replace(id ? `/car/${car.id}` : { pathname: '/owner/car-documents', params: { id: car.id, created: '1' } });
    } catch (e) { Alert.alert(t('errors.title'), apiErrorMessage(e)); }
    finally { setBusy(false); }
  };

  const titles = [t('carForm.stepVehicle'), t('carForm.stepPhotos'), t('carForm.stepLocation'), t('carForm.stepDescription'), t('carForm.stepPrice'), t('carForm.stepRules')];

  return (
    <Screen footer={
      <Row>
        {step > 0 ? <Button title={t('common.back')} variant="ghost" style={{ flex: 1 }} onPress={() => setStep(step - 1)} /> : null}
        {step < STEPS - 1 ? <Button title={t('common.next')} disabled={!valid} style={{ flex: 2 }} onPress={() => setStep(step + 1)} />
          : <Button title={id ? t('common.save') : t('carForm.publish')} icon="checkmark" loading={busy} style={{ flex: 2 }} onPress={save} />}
      </Row>
    }>
      <Row gap={5} style={{ marginBottom: 10 }}>
        {titles.map((x, i) => <View key={x} style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: i <= step ? colors.primary : colors.border }} />)}
      </Row>
      <T variant="label">{t('common.step', { n: step + 1, total: STEPS })}</T>
      <T variant="h2" style={{ marginBottom: 14 }}>{titles[step]}</T>

      {step === 0 ? (
        <View>
          <T variant="label" style={{ marginBottom: 6 }}>{t('carForm.make')}</T>
          <Row gap={6} style={{ flexWrap: 'wrap', marginBottom: 10 }}>
            {MAKES.map((m) => <Chip key={m} label={m} selected={f.make === m} onPress={() => up({ make: m })} />)}
          </Row>
          {f.make === 'Autre' || (f.make && !MAKES.includes(f.make)) ? <Field label={t('carForm.makeOther')} value={f.make === 'Autre' ? '' : f.make} onChangeText={(v) => up({ make: v })} /> : null}
          <Field label={t('carForm.model')} value={f.model} onChangeText={(v) => up({ model: v })} placeholder="Logan, Clio, 208…" />
          <Row>
            <Field style={{ flex: 1 }} label={t('carForm.year')} keyboardType="numeric" value={String(f.year)} onChangeText={num('year')} />
            <Field style={{ flex: 1 }} label={t('carForm.odometer')} keyboardType="numeric" value={String(f.odometerKm)} onChangeText={num('odometerKm')} />
          </Row>
          <Field label={t('carForm.plate')} value={f.plate} onChangeText={(v) => up({ plate: v })} placeholder="12345-أ-6" hint={t('carForm.plateHint')} />
          <T variant="label" style={{ marginBottom: 6 }}>{t('filters.category')}</T>
          <Row gap={6} style={{ flexWrap: 'wrap', marginBottom: 14 }}>{CATEGORIES.map((c) => <Chip key={c} label={t(`enums.category.${c}`)} selected={f.category === c} onPress={() => up({ category: c })} />)}</Row>
          <T variant="label" style={{ marginBottom: 6 }}>{t('filters.transmission')}</T>
          <Segmented value={f.transmission} onChange={(v) => up({ transmission: v })} options={[{ value: 'MANUAL', label: t('enums.transmission.MANUAL') }, { value: 'AUTOMATIC', label: t('enums.transmission.AUTOMATIC') }]} />
          <T variant="label" style={{ marginBottom: 6, marginTop: 14 }}>{t('filters.fuel')}</T>
          <Row gap={6} style={{ flexWrap: 'wrap' }}>{FUELS.map((c) => <Chip key={c} label={t(`enums.fuel.${c}`)} selected={f.fuel === c} onPress={() => up({ fuel: c })} />)}</Row>
          <Stepper label={t('carForm.seats')} value={f.seats} min={1} max={20} onChange={(v) => up({ seats: v })} />
          <Stepper label={t('carForm.doors')} value={f.doors} min={2} max={6} onChange={(v) => up({ doors: v })} />
          <Field label={t('carForm.color')} value={f.color} onChangeText={(v) => up({ color: v })} />
        </View>
      ) : null}

      {step === 1 ? (
        <View style={{ gap: 12 }}>
          <Notice icon="camera" text={t('carForm.photosHint')} />
          <PhotoPicker value={f.photos} onChange={(photos) => up({ photos })} min={3} max={20} camera />
        </View>
      ) : null}

      {step === 2 ? (
        <View>
          <T variant="label" style={{ marginBottom: 6 }}>{t('carForm.city')}</T>
          <Row gap={6} style={{ flexWrap: 'wrap', marginBottom: 14 }}>
            {CITIES.map((c) => <Chip key={c.name} label={c.name} selected={f.city === c.name} onPress={() => up({ city: c.name, latitude: c.lat, longitude: c.lng })} />)}
          </Row>
          <Field label={t('carForm.district')} value={f.district} onChangeText={(v) => up({ district: v })} placeholder="Maârif, Agdal, Guéliz…" />
          <Field label={t('carForm.address')} value={f.address} onChangeText={(v) => up({ address: v })} hint={t('carForm.addressHint')} />
          <Button title={t('carForm.locate')} icon="locate" variant="secondary" onPress={locate} />
          <T variant="caption" style={{ marginTop: 6 }}>GPS : {f.latitude.toFixed(4)}, {f.longitude.toFixed(4)}</T>
          <Field style={{ marginTop: 14 }} label={t('carForm.pickupInstructions')} multiline value={f.pickupInstructions} onChangeText={(v) => up({ pickupInstructions: v })} />
          <Section title={t('car.delivery')}>
            <Toggle label={t('carForm.deliveryAvailable')} value={f.deliveryAvailable} onChange={(v) => up({ deliveryAvailable: v })} />
            {f.deliveryAvailable ? <>
              <Row>
                <Field style={{ flex: 1 }} label={t('carForm.deliveryPrice')} keyboardType="numeric" value={String(f.deliveryPrice)} onChangeText={num('deliveryPrice')} />
                <Field style={{ flex: 1 }} label={t('carForm.deliveryRadius')} keyboardType="numeric" value={String(f.deliveryRadiusKm)} onChangeText={num('deliveryRadiusKm')} />
              </Row>
              <Toggle label={t('carForm.airport')} value={f.airportDelivery} onChange={(v) => up({ airportDelivery: v })} />
            </> : null}
          </Section>
        </View>
      ) : null}

      {step === 3 ? (
        <View>
          <Field label={t('carForm.listingTitle')} value={f.title} onChangeText={(v) => up({ title: v })} placeholder={`${f.make} ${f.model} — ${f.district || f.city}`} />
          <Field label={t('car.description')} multiline value={f.description} onChangeText={(v) => up({ description: v })} placeholder={t('carForm.descriptionPlaceholder')} />
          <T variant="label" style={{ marginBottom: 6 }}>{t('car.features')}</T>
          <Row gap={6} style={{ flexWrap: 'wrap' }}>
            {FEATURES.map((x) => <Chip key={x} label={t(`features.${x}`)} selected={f.features.includes(x)} onPress={() => up({ features: f.features.includes(x) ? f.features.filter((y) => y !== x) : [...f.features, x] })} />)}
          </Row>
        </View>
      ) : null}

      {step === 4 ? (
        <View>
          {suggestion.data ? <Notice icon="bulb" title={t('carForm.suggested', { price: money(suggestion.data.suggested) })} text={t('carForm.suggestedText', { min: money(suggestion.data.min), max: money(suggestion.data.max) })} action={t('carForm.useSuggested')} onAction={() => up({ pricePerDay: suggestion.data.suggested })} /> : null}
          <Field style={{ marginTop: 14 }} label={t('carForm.pricePerDay')} keyboardType="numeric" value={String(f.pricePerDay)} onChangeText={num('pricePerDay')} right={<T variant="caption">MAD</T>} />
          <Toggle label={t('carForm.smartPricing')} description={t('carForm.smartPricingHint')} value={f.smartPricing} onChange={(v) => up({ smartPricing: v })} />
          <Stepper label={t('carForm.weeklyDiscount')} value={f.weeklyDiscount} max={70} step={5} suffix="%" onChange={(v) => up({ weeklyDiscount: v })} />
          <Stepper label={t('carForm.monthlyDiscount')} value={f.monthlyDiscount} max={80} step={5} suffix="%" onChange={(v) => up({ monthlyDiscount: v })} />
          <Field label={t('carForm.deposit')} keyboardType="numeric" value={String(f.depositAmount)} onChangeText={num('depositAmount')} right={<T variant="caption">MAD</T>} />
          <Toggle label={t('car.unlimitedKm')} value={f.unlimitedKm} onChange={(v) => up({ unlimitedKm: v })} />
          {!f.unlimitedKm ? <Row>
            <Field style={{ flex: 1 }} label={t('carForm.kmPerDay')} keyboardType="numeric" value={String(f.kmPerDay)} onChangeText={num('kmPerDay')} />
            <Field style={{ flex: 1 }} label={t('carForm.extraKm')} keyboardType="decimal-pad" value={String(f.extraKmPrice)} onChangeText={num('extraKmPrice')} />
          </Row> : null}
          <Card style={{ marginTop: 8 }}>
            <KV k={t('carForm.earningsEstimate')} v={money(Math.round(f.pricePerDay * 0.8 * 10))} bold color={colors.success} />
            <T variant="caption">{t('carForm.earningsHint')}</T>
          </Card>
        </View>
      ) : null}

      {step === 5 ? (
        <View>
          <Toggle label={t('car.instant')} description={t('carForm.instantHint')} value={f.instantBooking} onChange={(v) => up({ instantBooking: v })} />
          <Stepper label={t('carForm.minDays')} value={f.minDays} min={1} max={30} onChange={(v) => up({ minDays: v })} />
          <Stepper label={t('carForm.maxDays')} value={f.maxDays} min={1} max={90} onChange={(v) => up({ maxDays: v })} />
          <Stepper label={t('carForm.notice')} value={f.advanceNoticeHours} min={0} max={72} step={2} suffix="h" onChange={(v) => up({ advanceNoticeHours: v })} />
          <Stepper label={t('carForm.minAge')} value={f.minDriverAge} min={18} max={35} onChange={(v) => up({ minDriverAge: v })} />
          <Stepper label={t('carForm.minLicense')} value={f.minLicenseYears} min={0} max={10} onChange={(v) => up({ minLicenseYears: v })} />
          <Section title={t('carForm.cancellation')}>
            <Segmented value={f.cancellationPolicy} onChange={(v) => up({ cancellationPolicy: v })} options={['FLEXIBLE', 'MODERATE', 'STRICT'].map((v) => ({ value: v, label: t(`enums.cancellation.${v}`) }))} />
            <T variant="caption" style={{ marginTop: 6 }}>{t(`car.cancellation.${f.cancellationPolicy}`)}</T>
          </Section>
          <Section title={t('carForm.fuelPolicy')}>
            <Segmented value={f.fuelPolicy} onChange={(v) => up({ fuelPolicy: v })} options={[{ value: 'SAME_LEVEL', label: t('carForm.sameLevel') }, { value: 'FULL_TO_FULL', label: t('carForm.fullToFull') }]} />
          </Section>
          <Section title={t('carForm.rules')}>
            <Toggle label={t('car.smokingOk')} value={f.smokingAllowed} onChange={(v) => up({ smokingAllowed: v })} />
            <Toggle label={t('car.petsOk')} value={f.petsAllowed} onChange={(v) => up({ petsAllowed: v })} />
            <Toggle label={t('carForm.crossBorder')} value={f.crossBorderAllowed} onChange={(v) => up({ crossBorderAllowed: v })} />
          </Section>
          {!id ? <View style={{ marginTop: 14 }}><Notice icon="shield-checkmark" text={t('carForm.reviewInfo')} /></View> : null}
        </View>
      ) : null}
    </Screen>
  );
}
