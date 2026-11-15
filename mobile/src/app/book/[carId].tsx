import React, { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Button, Card, Field, Loading, Notice, Row, Screen, Section, T, Toggle } from '../../components/ui';
import { PriceBreakdown } from '../../components/booking-ui';
import { DateRangePicker } from '../../components/DateRangePicker';
import { api } from '../../lib/api';
import { useSearch } from '../../lib/search';
import { useAuth } from '../../lib/auth';
import { apiErrorMessage, fmtDateTime, money } from '../../lib/format';
import { colors, radius } from '../../lib/theme';

export default function Checkout() {
  const { carId } = useLocalSearchParams<{ carId: string }>();
  const { t, i18n } = useTranslation();
  const { s, set } = useSearch();
  const { user, refresh } = useAuth();
  const [planId, setPlanId] = useState<string | null>(null);
  const [delivery, setDelivery] = useState(false);
  const [address, setAddress] = useState('');
  const [promo, setPromo] = useState('');
  const [promoApplied, setPromoApplied] = useState<string | null>(null);
  const [useWallet, setUseWallet] = useState(false);
  const [message, setMessage] = useState('');
  const [accept, setAccept] = useState(false);
  const [busy, setBusy] = useState(false);
  const [datesOpen, setDatesOpen] = useState(false);

  const car = useQuery({ queryKey: ['car', carId], queryFn: () => api(`/cars/${carId}`) });
  const config = useQuery({ queryKey: ['config'], queryFn: () => api('/public/config') });
  const body = { carId, startAt: s.start, endAt: s.end, insurancePlanId: planId, delivery, deliveryAddress: address, promoCode: promoApplied, useWallet };
  const quote = useQuery({ queryKey: ['quote', body], queryFn: () => api('/bookings/quote', { body }), enabled: !!s.start && !!s.end, retry: false });

  if (!car.data || !config.data) return <Loading />;
  const c = car.data;
  const plans = config.data.insurancePlans as any[];
  const selectedPlan = planId || quote.data?.insurancePlanId || plans[0]?.id;
  const lang = i18n.language === 'ar' ? 'Ar' : i18n.language === 'en' ? 'En' : 'Fr';
  const eligibility: string[] = quote.data?.eligibility || [];
  const err = quote.error as any;

  const applyPromo = () => setPromoApplied(promo.trim().toUpperCase() || null);
  const submit = async () => {
    if (delivery && !address.trim()) return Alert.alert(t('checkout.addressRequired'));
    setBusy(true);
    try {
      const b = await api('/bookings', { body: { ...body, insurancePlanId: selectedPlan, message: message.trim() || undefined } });
      await refresh();
      router.replace(b.status === 'PENDING_PAYMENT' ? `/booking/${b.id}/pay` : `/booking/${b.id}`);
    } catch (e) {
      Alert.alert(t('errors.title'), apiErrorMessage(e));
    } finally { setBusy(false); }
  };

  return (
    <Screen footer={
      <View style={{ gap: 8 }}>
        <Pressable onPress={() => setAccept(!accept)}>
          <Row gap={8}><Ionicons name={accept ? 'checkbox' : 'square-outline'} size={22} color={colors.primary} /><T variant="caption" style={{ flex: 1 }}>{t('checkout.acceptTerms')}</T></Row>
        </Pressable>
        <Button
          title={c.instantBooking ? t('checkout.bookAndPay', { price: money(quote.data?.quote.totalPrice) }) : t('checkout.sendRequest')}
          icon={c.instantBooking ? 'flash' : 'paper-plane'}
          loading={busy}
          disabled={!accept || !quote.data || eligibility.length > 0}
          onPress={submit}
        />
      </View>
    }>
      <Card>
        <Row gap={12}>
          <Image source={{ uri: c.photos[0]?.url }} style={{ width: 92, height: 68, borderRadius: radius.sm }} />
          <View style={{ flex: 1 }}>
            <T variant="h3">{c.make} {c.model}</T>
            <T variant="caption">{c.city} · {c.owner.firstName}</T>
          </View>
        </Row>
        <Pressable onPress={() => setDatesOpen(true)} style={{ marginTop: 12 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <T variant="label">{t('checkout.dates')}</T>
              <T style={{ fontWeight: '700' }}>{s.start && s.end ? `${fmtDateTime(s.start)} → ${fmtDateTime(s.end)}` : t('search.pickDates')}</T>
            </View>
            <T color={colors.primary} style={{ fontWeight: '700' }}>{t('common.edit')}</T>
          </Row>
        </Pressable>
      </Card>

      {err ? <View style={{ marginTop: 12 }}><Notice tone="danger" text={t(`errors.${err.code}`, { value: err.message, defaultValue: t('errors.generic') })} /></View> : null}
      {eligibility.includes('PROFILE_NOT_VERIFIED') ? (
        <View style={{ marginTop: 12 }}><Notice tone="warning" icon="id-card" title={t('checkout.verifyTitle')} text={user?.verificationStatus === 'PENDING' ? t('verification.pendingText') : t('checkout.verifyText')} action={t('verification.start')} onAction={() => router.push('/account/verification')} /></View>
      ) : null}
      {eligibility.includes('PHONE_NOT_VERIFIED') ? (
        <View style={{ marginTop: 12 }}><Notice tone="warning" icon="call" text={t('checkout.phoneText')} action={t('phone.verify')} onAction={() => router.push('/account/phone')} /></View>
      ) : null}
      {eligibility.filter((e) => ['DRIVER_TOO_YOUNG', 'LICENSE_TOO_RECENT'].includes(e)).map((e) => (
        <View key={e} style={{ marginTop: 12 }}><Notice tone="danger" text={t(`errors.${e}`)} /></View>
      ))}

      <Section title={t('checkout.insurance')}>
        <View style={{ gap: 10 }}>
          {plans.map((p) => {
            const on = p.id === selectedPlan;
            return (
              <Pressable key={p.id} onPress={() => setPlanId(p.id)} style={{ borderWidth: 2, borderColor: on ? colors.primary : colors.border, borderRadius: radius.lg, padding: 14, backgroundColor: on ? colors.primarySoft : '#fff' }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Row gap={8}><Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={20} color={colors.primary} /><T variant="h3">{p[`name${lang}`]}</T></Row>
                  <T style={{ fontWeight: '800' }}>{p.pricePerDay ? `+${money(p.pricePerDay)}/${t('common.day')}` : t('price.included')}</T>
                </Row>
                <T variant="small" color={colors.inkSoft} style={{ marginTop: 6 }}>{p[`description${lang}`]}</T>
                <T variant="caption" style={{ marginTop: 4, fontWeight: '700' }}>{t('checkout.franchise', { amount: money(p.franchise) })}</T>
              </Pressable>
            );
          })}
        </View>
      </Section>

      {c.deliveryAvailable ? (
        <Section title={t('car.delivery')}>
          <Toggle label={t('checkout.delivery', { price: money(c.deliveryPrice) })} description={t('checkout.deliveryHint', { km: c.deliveryRadiusKm })} value={delivery} onChange={setDelivery} />
          {delivery ? <Field placeholder={t('checkout.deliveryAddress')} value={address} onChangeText={setAddress} /> : null}
        </Section>
      ) : null}

      <Section title={t('checkout.promo')}>
        <Row>
          <Field style={{ flex: 1, marginBottom: 0 }} placeholder="BIENVENUE" autoCapitalize="characters" value={promo} onChangeText={setPromo} />
          <Button title={t('common.apply')} variant="secondary" onPress={applyPromo} />
        </Row>
        {promoApplied && quote.data?.promo ? <T variant="caption" color={colors.success} style={{ marginTop: 6 }}>✓ {t('checkout.promoApplied', { amount: money(quote.data.promo.discount) })}</T> : null}
        {(user?.walletBalance || 0) > 0 ? <Toggle label={t('checkout.useWallet', { amount: money(user!.walletBalance) })} value={useWallet} onChange={setUseWallet} /> : null}
      </Section>

      {!c.instantBooking ? (
        <Section title={t('checkout.message')}>
          <Field multiline placeholder={t('checkout.messagePlaceholder', { name: c.owner.firstName })} value={message} onChangeText={setMessage} />
          <Notice icon="time-outline" text={t('checkout.requestInfo')} />
        </Section>
      ) : null}

      <Section title={t('checkout.summary')}>
        {quote.data ? <Card><PriceBreakdown q={quote.data.quote} /></Card> : quote.isLoading ? <Loading full={false} /> : null}
        <T variant="caption" style={{ marginTop: 10 }}>{t(`car.cancellation.${c.cancellationPolicy}`)}</T>
      </Section>
      {datesOpen ? <DateRangePicker visible blocked={c.unavailable} value={{ start: s.start, end: s.end }} onClose={() => setDatesOpen(false)} onChange={(r) => set(r)} /> : null}
    </Screen>
  );
}
