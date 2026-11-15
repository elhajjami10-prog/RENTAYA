import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions, Share, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Avatar, Badge, Button, Card, Divider, Loading, Row, Section, Stars, T, Notice } from '../../components/ui';
import { FavoriteButton } from '../../components/CarCard';
import CarMap from '../../components/CarMap';
import { DateRangePicker } from '../../components/DateRangePicker';
import { api } from '../../lib/api';
import { useSearch } from '../../lib/search';
import { useAuth } from '../../lib/auth';
import { fmtDate, fmtDateTime, money, responseTime } from '../../lib/format';
import { colors, radius } from '../../lib/theme';
import { FEATURE_ICONS } from '../../lib/constants';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CarDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const { s, set } = useSearch();
  const { user } = useAuth();
  const [photo, setPhoto] = useState(0);
  const [datesOpen, setDatesOpen] = useState(false);
  const [allReviews, setAllReviews] = useState(false);
  const car = useQuery({ queryKey: ['car', id], queryFn: () => api(`/cars/${id}`) });
  const quote = useQuery({
    queryKey: ['carQuote', id, s.start?.toISOString(), s.end?.toISOString()],
    queryFn: () => api('/bookings/quote', { body: { carId: id, startAt: s.start, endAt: s.end } }),
    enabled: !!user && !!s.start && !!s.end && !!car.data && !car.data.isOwner,
    retry: false,
  });
  if (car.isLoading || !car.data) return <Loading />;
  const c = car.data;
  const w = Math.min(width, 900);
  const photoH = Math.min(w * 0.66, 520);
  const days = s.start && s.end ? Math.max(1, Math.ceil((s.end.getTime() - s.start.getTime()) / 86400000)) : 0;
  const quoteError = (quote.error as any)?.code as string | undefined;

  const contact = async () => {
    if (!user) return router.push('/auth/login');
    const r = await api('/conversations/start', { body: { carId: c.id } });
    router.push(`/chat/${r.id}`);
  };
  const book = () => {
    if (!user) return router.push('/auth/login');
    if (!s.start || !s.end) return setDatesOpen(true);
    router.push(`/book/${c.id}`);
  };
  const share = () => {
    const url = Platform.OS === 'web' ? window.location.href : `rentaya://car/${c.id}`;
    Share.share({ message: `${c.make} ${c.model} — Rentaya ${url}` });
  };

  const specs: [string, string][] = [
    ['cog-outline', t(`enums.transmission.${c.transmission}`)],
    ['water-outline', t(`enums.fuel.${c.fuel}`)],
    ['people-outline', t('car.seats', { count: c.seats })],
    ['car-outline', t('car.doors', { count: c.doors })],
    ['speedometer-outline', `${Math.round(c.odometerKm / 1000)}k km`],
    ['pricetag-outline', t(`enums.category.${c.category}`)],
  ];

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
        <View style={{ width: '100%', maxWidth: 900, alignSelf: 'center' }}>
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={(e) => setPhoto(Math.round(e.nativeEvent.contentOffset.x / w))} scrollEventThrottle={16}
            onScroll={Platform.OS === 'web' ? (e) => setPhoto(Math.round(e.nativeEvent.contentOffset.x / w)) : undefined}>
            {c.photos.map((p: { url: string }) => <Image key={p.url} source={{ uri: p.url }} style={{ width: w, height: photoH, backgroundColor: colors.primarySoft }} contentFit="cover" />)}
          </ScrollView>
          <View style={[st.dots, { top: photoH - 22 }]}>{c.photos.map((_: unknown, i: number) => <View key={i} style={[st.dot, i === photo && { backgroundColor: '#fff', width: 18 }]} />)}</View>
          <SafeAreaView edges={['top']} style={st.topBar} pointerEvents="box-none">
            <Pressable style={st.round} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}><Ionicons name="arrow-back" size={20} color={colors.ink} /></Pressable>
            <Row>
              <Pressable style={st.round} onPress={share}><Ionicons name="share-outline" size={20} color={colors.ink} /></Pressable>
              {!c.isOwner ? <FavoriteButton carId={c.id} initial={c.isFavorite} style={st.round} /> : null}
            </Row>
          </SafeAreaView>

          <View style={{ padding: 16 }}>
            <Row style={{ flexWrap: 'wrap' }} gap={6}>
              {c.instantBooking ? <Badge label={t('car.instant')} icon="flash" /> : null}
              {c.deliveryAvailable ? <Badge label={t('car.delivery')} icon="navigate" tone="muted" /> : null}
              {c.owner.isPro ? <Badge label={t('car.proOwner')} icon="briefcase" tone="success" /> : null}
              {c.status !== 'ACTIVE' ? <Badge label={t(`enums.carStatus.${c.status}`)} tone="warning" /> : null}
            </Row>
            <T variant="h1" style={{ marginTop: 8 }}>{c.make} {c.model}</T>
            <Row gap={10} style={{ marginTop: 4 }}>
              <T color={colors.inkSoft}>{c.year}</T>
              <Stars value={c.ratingAvg} count={c.ratingCount} />
              <T variant="caption">{t('car.trips', { count: c.tripsCount })}</T>
            </Row>
            <Row gap={4} style={{ marginTop: 4 }}><Ionicons name="location-outline" size={15} color={colors.inkSoft} /><T color={colors.inkSoft}>{c.district ? `${c.district}, ` : ''}{c.city}</T></Row>

            {c.isOwner ? (
              <Row style={{ marginTop: 14 }}>
                <Button title={t('common.edit')} icon="create-outline" variant="secondary" small style={{ flex: 1 }} onPress={() => router.push({ pathname: '/owner/car-form', params: { id: c.id } })} />
                <Button title={t('calendar.title')} icon="calendar-outline" variant="secondary" small style={{ flex: 1 }} onPress={() => router.push({ pathname: '/owner/calendar', params: { id: c.id } })} />
              </Row>
            ) : null}

            <View style={st.specs}>
              {specs.map(([icon, label]) => (
                <View key={icon} style={st.spec}><Ionicons name={icon as never} size={20} color={colors.primary} /><T variant="small" style={{ fontWeight: '600' }} center>{label}</T></View>
              ))}
            </View>

            {!c.isOwner ? (
              <Card style={{ marginTop: 8 }}>
                <Pressable onPress={() => setDatesOpen(true)}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <View style={{ flex: 1 }}>
                      <T variant="label">{t('search.when')}</T>
                      <T style={{ fontWeight: '700' }}>{s.start && s.end ? `${fmtDateTime(s.start)} → ${fmtDateTime(s.end)}` : t('search.pickDates')}</T>
                    </View>
                    <Ionicons name="calendar" size={22} color={colors.primary} />
                  </Row>
                </Pressable>
                {quoteError ? <View style={{ marginTop: 10 }}><Notice tone="warning" text={t(`errors.${quoteError}`, { value: (quote.error as any)?.message })} /></View> : null}
                {quote.data ? (
                  <Row style={{ justifyContent: 'space-between', marginTop: 10 }}>
                    <T variant="small">{t('price.rental', { count: quote.data.quote.days })}</T>
                    <T style={{ fontWeight: '800' }}>{money(quote.data.quote.rentalPrice)}</T>
                  </Row>
                ) : null}
              </Card>
            ) : null}

            <Section title={t('car.owner')}>
              <Pressable onPress={() => router.push(`/user/${c.owner.id}`)}>
                <Row gap={12}>
                  <Avatar uri={c.owner.avatarUrl} name={c.owner.firstName} size={56} />
                  <View style={{ flex: 1 }}>
                    <Row gap={6}><T variant="h3">{c.owner.isPro && c.owner.companyName ? c.owner.companyName : `${c.owner.firstName} ${c.owner.lastName}`}</T>{c.owner.verified ? <Ionicons name="checkmark-circle" size={18} color={colors.success} /> : null}</Row>
                    <Stars value={c.owner.ratingAvg} count={c.owner.ratingCount} />
                    <T variant="caption">{responseTime(c.owner.responseTimeMin)} · {t('owner.responseRate', { rate: Math.round(c.owner.responseRate) })}</T>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                </Row>
              </Pressable>
              {!c.isOwner ? <Button title={t('car.contactOwner')} icon="chatbubble-ellipses-outline" variant="outline" small style={{ marginTop: 12 }} onPress={contact} /> : null}
            </Section>

            {c.description ? (
              <Section title={t('car.description')}><T color={colors.inkSoft} style={{ lineHeight: 23 }}>{c.description}</T></Section>
            ) : null}

            {c.features?.length ? (
              <Section title={t('car.features')}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                  {c.features.map((f: string) => (
                    <Row key={f} gap={8} style={{ width: '46%' }}><Ionicons name={(FEATURE_ICONS[f] || 'checkmark') as never} size={18} color={colors.primary} /><T variant="small">{t(`features.${f}`)}</T></Row>
                  ))}
                </View>
              </Section>
            ) : null}

            <Section title={t('car.conditions')}>
              {[
                ['speedometer-outline', c.unlimitedKm ? t('car.unlimitedKm') : t('car.kmPerDay', { km: c.kmPerDay, price: c.extraKmPrice })],
                ['shield-outline', t('car.depositInfo', { amount: money(c.depositAmount) })],
                ['person-outline', t('car.minAge', { age: c.minDriverAge, years: c.minLicenseYears })],
                ['water-outline', t(`car.fuelPolicy.${c.fuelPolicy}`)],
                ['close-circle-outline', t(`car.cancellation.${c.cancellationPolicy}`)],
                ['time-outline', t('car.duration', { min: c.minDays, max: c.maxDays, notice: c.advanceNoticeHours })],
                ['ban-outline', [c.smokingAllowed ? t('car.smokingOk') : t('car.noSmoking'), c.petsAllowed ? t('car.petsOk') : t('car.noPets')].join(' · ')],
              ].map(([icon, text]) => (
                <Row key={icon} gap={10} style={{ marginBottom: 10, alignItems: 'flex-start' }}><Ionicons name={icon as never} size={19} color={colors.primary} /><T variant="small" style={{ flex: 1 }}>{text}</T></Row>
              ))}
            </Section>

            <Section title={t('car.insurance')}>
              <Notice icon="shield-checkmark" title={t('car.insuranceTitle')} text={t('car.insuranceText')} />
            </Section>

            <Section title={t('car.location')}>
              <T variant="small" color={colors.inkSoft} style={{ marginBottom: 8 }}>{c.address || t('car.locationApprox')}</T>
              <CarMap cars={[]} center={{ lat: c.latitude, lng: c.longitude }} approx height={220} />
              {c.deliveryAvailable ? <Notice icon="navigate" text={t('car.deliveryInfo', { price: money(c.deliveryPrice), km: c.deliveryRadiusKm }) + (c.airportDelivery ? ` ${t('car.airport')}` : '')} /> : null}
            </Section>

            <Section title={t('car.reviews', { count: c.reviews.length })}>
              {c.reviews.length === 0 ? <T color={colors.inkSoft}>{t('car.noReviews')}</T> : null}
              {(allReviews ? c.reviews : c.reviews.slice(0, 3)).map((r: any) => (
                <View key={r.id} style={{ marginBottom: 14 }}>
                  <Row gap={10}>
                    <Avatar uri={r.author.avatarUrl} name={r.author.firstName} size={36} />
                    <View style={{ flex: 1 }}><T style={{ fontWeight: '700' }}>{r.author.firstName}</T><T variant="caption">{fmtDate(r.createdAt, true)}</T></View>
                    <Stars value={r.rating} count={undefined} />
                  </Row>
                  {r.comment ? <T variant="small" style={{ marginTop: 6 }}>{r.comment}</T> : null}
                  {r.reply ? <View style={st.reply}><T variant="caption" style={{ fontWeight: '700' }}>{t('review.ownerReply')}</T><T variant="small">{r.reply}</T></View> : null}
                </View>
              ))}
              {c.reviews.length > 3 && !allReviews ? <Button title={t('common.seeAll')} variant="ghost" small onPress={() => setAllReviews(true)} /> : null}
            </Section>
            <Divider />
            <Pressable onPress={() => router.push('/account/support')}><T variant="caption" center>{t('car.report')}</T></Pressable>
          </View>
        </View>
      </ScrollView>

      {!c.isOwner ? (
        <SafeAreaView edges={['bottom']} style={st.footer}>
          <Row style={{ width: '100%', maxWidth: 900, alignSelf: 'center', justifyContent: 'space-between' }}>
            <View>
              <T><T style={{ fontWeight: '800', fontSize: 20 }} color={colors.primaryDark}>{money(quote.data?.quote.pricePerDay ?? c.pricePerDay)}</T><T variant="caption"> / {t('common.day')}</T></T>
              {quote.data ? <T variant="caption">{t('car.totalFor', { count: days, price: money(quote.data.quote.totalPrice) })}</T> : null}
            </View>
            <Button title={c.instantBooking ? t('car.bookNow') : t('car.request')} icon={c.instantBooking ? 'flash' : 'paper-plane'} onPress={book} disabled={!!quoteError && quoteError !== 'PROFILE_NOT_VERIFIED'} />
          </Row>
        </SafeAreaView>
      ) : null}
      {datesOpen ? <DateRangePicker visible blocked={c.unavailable} value={{ start: s.start, end: s.end }} onClose={() => setDatesOpen(false)} onChange={(r) => set(r)} /> : null}
    </View>
  );
}

const st = StyleSheet.create({
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', padding: 12 },
  round: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.95)', alignItems: 'center', justifyContent: 'center' },
  dots: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.6)' },
  specs: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 18, marginBottom: 6 },
  spec: { width: '31%', flexGrow: 1, alignItems: 'center', gap: 6, paddingVertical: 12, borderRadius: radius.md, backgroundColor: colors.bgSoft },
  reply: { marginTop: 8, padding: 10, borderRadius: radius.sm, backgroundColor: colors.bgSoft },
  footer: { borderTopWidth: 1, borderTopColor: colors.border, padding: 12, paddingHorizontal: 16, backgroundColor: '#fff' },
});
