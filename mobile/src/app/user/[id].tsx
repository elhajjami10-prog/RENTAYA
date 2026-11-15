import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Avatar, Badge, Card, Loading, Row, Screen, Section, Stars, T } from '../../components/ui';
import { CarCard } from '../../components/CarCard';
import { api } from '../../lib/api';
import { fmtDate, responseTime } from '../../lib/format';
import { colors } from '../../lib/theme';

export default function PublicProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const q = useQuery({ queryKey: ['user', id], queryFn: () => api(`/users/${id}`) });
  if (!q.data) return <Loading />;
  const u = q.data;
  return (
    <Screen>
      <View style={{ alignItems: 'center', gap: 6 }}>
        <Avatar uri={u.avatarUrl} name={u.firstName} size={96} />
        <T variant="h2">{u.isPro && u.companyName ? u.companyName : `${u.firstName} ${u.lastName}`}</T>
        <Row gap={6}>
          {u.verified ? <Badge label={t('profile.verified')} tone="success" icon="checkmark-circle" /> : null}
          {u.phoneVerified ? <Badge label={t('profile.phoneVerified')} tone="primary" icon="call" /> : null}
          {u.isPro ? <Badge label="Pro" tone="primary" icon="briefcase" /> : null}
        </Row>
        <Stars value={u.ratingAvg} count={u.ratingCount} size={16} />
        <T variant="caption">{t('profile.memberSince', { date: fmtDate(u.createdAt, true) })}{u.city ? ` · ${u.city}` : ''}</T>
        {u.cars.length ? <T variant="caption">{responseTime(u.responseTimeMin)} · {t('owner.responseRate', { rate: Math.round(u.responseRate) })}</T> : null}
      </View>
      {u.bio ? <Card style={{ marginTop: 16 }}><T>{u.bio}</T></Card> : null}
      {u.cars.length ? (
        <Section title={t('profile.cars', { count: u.cars.length })}>
          <View style={{ gap: 12 }}>{u.cars.map((c: any) => <CarCard key={c.id} car={{ ...c, owner: { isPro: u.isPro } }} />)}</View>
        </Section>
      ) : null}
      <Section title={t('car.reviews', { count: u.reviews.length })}>
        {u.reviews.length === 0 ? <T color={colors.inkSoft}>{t('car.noReviews')}</T> : null}
        {u.reviews.map((r: any) => (
          <View key={r.id} style={{ marginBottom: 14 }}>
            <Row gap={10}>
              <Avatar uri={r.author.avatarUrl} name={r.author.firstName} size={34} />
              <View style={{ flex: 1 }}><T style={{ fontWeight: '700' }}>{r.author.firstName}</T><T variant="caption">{fmtDate(r.createdAt, true)} · {t(`review.role.${r.role}`)}</T></View>
              <Row gap={2}><Ionicons name="star" size={14} color={colors.star} /><T variant="small" style={{ fontWeight: '700' }}>{r.rating}</T></Row>
            </Row>
            {r.comment ? <T variant="small" style={{ marginTop: 6 }}>{r.comment}</T> : null}
          </View>
        ))}
      </Section>
    </Screen>
  );
}
