import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Badge, Row, Stars, T } from './ui';
import { colors, radius, shadow } from '../lib/theme';
import { money } from '../lib/format';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

export type CarSummary = {
  id: string; make: string; model: string; year: number; pricePerDay: number; photos: { url: string }[];
  ratingAvg: number; ratingCount: number; instantBooking: boolean; deliveryAvailable?: boolean; transmission: string; fuel: string;
  seats: number; city: string; district?: string | null; distanceKm?: number | null; isFavorite?: boolean;
  quote?: { days: number; rentalPrice: number; totalPrice: number } | null; owner?: { isPro?: boolean; firstName?: string };
};

export function FavoriteButton({ carId, initial, style }: { carId: string; initial?: boolean; style?: object }) {
  const [fav, setFav] = useState(!!initial);
  const { user } = useAuth();
  const toggle = async () => {
    if (!user) return router.push('/auth/login');
    setFav(!fav);
    try { await api(`/account/favorites/${carId}`, { method: fav ? 'DELETE' : 'PUT' }); } catch { setFav(fav); }
  };
  return (
    <Pressable onPress={toggle} hitSlop={8} style={[s.fav, style]}>
      <Ionicons name={fav ? 'heart' : 'heart-outline'} size={20} color={fav ? colors.danger : colors.ink} />
    </Pressable>
  );
}

export function CarCard({ car, compact }: { car: CarSummary; compact?: boolean }) {
  const { t } = useTranslation();
  return (
    <Pressable onPress={() => router.push(`/car/${car.id}`)} style={({ pressed }) => [s.card, compact && { width: 260 }, pressed && { opacity: 0.93 }]}>
      <View>
        <Image source={{ uri: car.photos[0]?.url }} style={[s.img, compact && { height: 140 }]} contentFit="cover" transition={150} />
        <FavoriteButton carId={car.id} initial={car.isFavorite} style={{ position: 'absolute', top: 10, end: 10 }} />
        <Row style={{ position: 'absolute', bottom: 10, start: 10 }} gap={6}>
          {car.instantBooking ? <Badge label={t('car.instant')} icon="flash" tone="primary" /> : null}
          {car.deliveryAvailable ? <Badge label={t('car.delivery')} icon="navigate" tone="muted" /> : null}
          {car.owner?.isPro ? <Badge label="Pro" tone="success" icon="briefcase" /> : null}
        </Row>
      </View>
      <View style={{ padding: 12, gap: 4 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T variant="h3" numberOfLines={1} style={{ flex: 1, fontSize: 16 }}>{car.make} {car.model} <T variant="caption">{car.year}</T></T>
          <Stars value={car.ratingAvg} count={car.ratingCount} />
        </Row>
        <Row gap={10}>
          <T variant="caption"><Ionicons name="location-outline" size={12} /> {car.district ? `${car.district}, ` : ''}{car.city}{car.distanceKm != null ? ` · ${car.distanceKm.toFixed(1)} km` : ''}</T>
        </Row>
        <Row gap={10}>
          <T variant="caption"><Ionicons name="cog-outline" size={12} /> {t(`enums.transmission.${car.transmission}`)}</T>
          <T variant="caption"><Ionicons name="water-outline" size={12} /> {t(`enums.fuel.${car.fuel}`)}</T>
          <T variant="caption"><Ionicons name="people-outline" size={12} /> {car.seats}</T>
        </Row>
        <Row style={{ justifyContent: 'space-between', marginTop: 4 }}>
          <T><T style={{ fontWeight: '800', fontSize: 17 }} color={colors.primaryDark}>{money(car.pricePerDay)}</T><T variant="caption"> / {t('common.day')}</T></T>
          {car.quote ? <T variant="caption">{t('car.totalFor', { count: car.quote.days, price: money(car.quote.rentalPrice) })}</T> : null}
        </Row>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, ...shadow },
  img: { width: '100%', height: 190, backgroundColor: colors.primarySoft },
  fav: { backgroundColor: 'rgba(255,255,255,0.95)', width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
