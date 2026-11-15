import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Button, Card, IconButton, Notice, Row, Section, T } from '../../components/ui';
import { CarCard, type CarSummary } from '../../components/CarCard';
import { CityPicker } from '../../components/CityPicker';
import { DateRangePicker } from '../../components/DateRangePicker';
import { useSearch, CITIES } from '../../lib/search';
import { api, DEMO } from '../../lib/api';
import { fmtDateTime, money } from '../../lib/format';
import { colors, gradient, radius, shadow } from '../../lib/theme';
import { useAuth } from '../../lib/auth';

export default function Home() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { s, set } = useSearch();
  const { user } = useAuth();
  const [cityOpen, setCityOpen] = useState(false);
  const [datesOpen, setDatesOpen] = useState(false);
  const featured = useQuery({ queryKey: ['featured'], queryFn: () => api<{ items: CarSummary[] }>('/cars', { query: { sort: 'rating', pageSize: 8 } }) });
  const notif = useQuery({ queryKey: ['notifications'], queryFn: () => api('/account/notifications'), enabled: !!user });
  const wide = width > 760;

  const go = () => {
    if (!s.city && s.lat == null) return setCityOpen(true);
    router.push('/search');
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#fff' }} contentContainerStyle={{ paddingBottom: 40 }}>
      <LinearGradient colors={[gradient[0], gradient[1], gradient[2]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[st.hero, { paddingTop: insets.top + 12 }]}>
        <View style={st.inner}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Row gap={8}>
              <View style={st.logoBox}><Image source={require('../../../assets/logo-mark.png')} style={{ width: 34, height: 34 }} contentFit="contain" /></View>
              <T variant="h2" color="#fff" style={{ letterSpacing: 1 }}>RENTAYA</T>
            </Row>
            {user ? <IconButton icon="notifications-outline" color="#fff" badge={notif.data?.unread} onPress={() => router.push('/account/notifications')} /> : (
              <Pressable onPress={() => router.push('/auth/login')}><T color="#fff" style={{ fontWeight: '700' }}>{t('auth.login')}</T></Pressable>
            )}
          </Row>
          <T variant="h1" color="#fff" style={{ marginTop: 26, fontSize: wide ? 40 : 30 }}>{t('home.title')}</T>
          <T color="rgba(255,255,255,0.9)" style={{ marginTop: 8, fontSize: 16 }}>{t('home.subtitle')}</T>

          <View style={st.searchCard}>
            <Pressable style={st.searchRow} onPress={() => setCityOpen(true)}>
              <Ionicons name="location" size={22} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <T variant="caption">{t('search.where')}</T>
                <T style={{ fontWeight: '700' }} color={s.label ? colors.ink : colors.muted}>{s.label || t('search.cityPlaceholder')}</T>
              </View>
            </Pressable>
            <View style={st.sep} />
            <Pressable style={st.searchRow} onPress={() => setDatesOpen(true)}>
              <Ionicons name="calendar" size={22} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <T variant="caption">{t('search.when')}</T>
                <T style={{ fontWeight: '700' }} numberOfLines={1}>{s.start && s.end ? `${fmtDateTime(s.start)} → ${fmtDateTime(s.end)}` : t('search.pickDates')}</T>
              </View>
            </Pressable>
            <Button title={t('search.cta')} icon="search" onPress={go} style={{ marginTop: 8 }} />
          </View>
        </View>
      </LinearGradient>

      <View style={st.inner}>
        <View style={{ paddingHorizontal: 16 }}>
          {DEMO ? <View style={{ marginTop: 16 }}><Notice icon="flask" title={t('demo.title')} text={t('demo.text')} /></View> : null}
          <Section title={t('home.popularCities')}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {CITIES.slice(0, 8).map((c, i) => (
                <Pressable key={c.name} onPress={() => { set({ city: c.name, label: c.name, lat: undefined, lng: undefined }); router.push('/search'); }}>
                  <LinearGradient colors={i % 2 ? [colors.primaryDark, colors.primary] : [colors.primary, colors.primaryLight]} style={st.city}>
                    <Ionicons name="location" size={18} color="#fff" />
                    <T color="#fff" style={{ fontWeight: '800' }}>{c.name}</T>
                  </LinearGradient>
                </Pressable>
              ))}
            </ScrollView>
          </Section>

          <Section title={t('home.how')}>
            <View style={{ flexDirection: wide ? 'row' : 'column', gap: 12 }}>
              {[
                ['search', 'home.step1', 'home.step1Text'],
                ['shield-checkmark', 'home.step2', 'home.step2Text'],
                ['key', 'home.step3', 'home.step3Text'],
              ].map(([icon, title, text], i) => (
                <Card key={i} style={{ flex: 1, flexDirection: 'row', gap: 12 }}>
                  <View style={st.stepIcon}><Ionicons name={icon as never} size={22} color={colors.primary} /></View>
                  <View style={{ flex: 1 }}>
                    <T style={{ fontWeight: '800' }}>{i + 1}. {t(title)}</T>
                    <T variant="small" color={colors.inkSoft}>{t(text)}</T>
                  </View>
                </Card>
              ))}
            </View>
          </Section>

          <Section title={t('home.topCars')} action={t('common.seeAll')} onAction={() => { if (!s.city && s.lat == null) set({ city: 'Casablanca', label: 'Casablanca' }); router.push('/search'); }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 8 }}>
              {(featured.data?.items || []).map((c) => <CarCard key={c.id} car={c} compact />)}
            </ScrollView>
          </Section>

          <LinearGradient colors={[colors.primaryDark, colors.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.ownerCta}>
            <Ionicons name="cash-outline" size={34} color="#fff" />
            <T variant="h2" color="#fff" style={{ marginTop: 8 }}>{t('home.ownerTitle')}</T>
            <T color="rgba(255,255,255,0.9)" style={{ marginVertical: 8 }}>{t('home.ownerText', { amount: money(6000) })}</T>
            <Button title={t('home.ownerCta')} variant="secondary" icon="add-circle" onPress={() => router.push(user ? '/owner/car-form' : '/auth/register')} />
          </LinearGradient>

          <Section title={t('home.trust')}>
            {[
              ['shield-checkmark-outline', 'home.trustInsurance', 'home.trustInsuranceText'],
              ['person-circle-outline', 'home.trustVerified', 'home.trustVerifiedText'],
              ['call-outline', 'home.trustAssistance', 'home.trustAssistanceText'],
              ['card-outline', 'home.trustPayment', 'home.trustPaymentText'],
            ].map(([icon, title, text]) => (
              <Row key={title} style={{ alignItems: 'flex-start', marginBottom: 14 }} gap={12}>
                <View style={st.stepIcon}><Ionicons name={icon as never} size={22} color={colors.primary} /></View>
                <View style={{ flex: 1 }}><T style={{ fontWeight: '700' }}>{t(title)}</T><T variant="small" color={colors.inkSoft}>{t(text)}</T></View>
              </Row>
            ))}
          </Section>
        </View>
      </View>

      <CityPicker visible={cityOpen} onClose={() => setCityOpen(false)} onPick={(p) => set({ city: p.city, label: p.label, lat: p.lat, lng: p.lng })} />
      {datesOpen ? <DateRangePicker visible value={{ start: s.start, end: s.end }} onClose={() => setDatesOpen(false)} onChange={(r) => set(r)} /> : null}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  hero: { paddingBottom: 26, paddingHorizontal: 16, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  inner: { width: '100%', maxWidth: 1000, alignSelf: 'center' },
  logoBox: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  searchCard: { backgroundColor: '#fff', borderRadius: radius.xl, padding: 14, marginTop: 22, ...shadow },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 6 },
  sep: { height: 1, backgroundColor: colors.border, marginHorizontal: 6 },
  city: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 14, borderRadius: radius.lg },
  stepIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  ownerCta: { borderRadius: radius.xl, padding: 22, marginTop: 28 },
});
