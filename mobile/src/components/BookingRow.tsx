import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Card, Row, T } from './ui';
import { StatusBadge } from './booking-ui';
import { fmtDateTime, money } from '../lib/format';
import { colors, radius } from '../lib/theme';

export function BookingRow({ b, owner }: { b: any; owner?: boolean }) {
  const { t } = useTranslation();
  return (
    <Card onPress={() => router.push(`/booking/${b.id}`)}>
      <Row gap={12} style={{ alignItems: 'flex-start' }}>
        <Image source={{ uri: b.car.photos?.[0]?.url }} style={{ width: 88, height: 66, borderRadius: radius.sm, backgroundColor: colors.primarySoft }} />
        <View style={{ flex: 1, gap: 3 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T style={{ fontWeight: '800', flex: 1 }} numberOfLines={1}>{b.car.make} {b.car.model}</T>
            <T style={{ fontWeight: '700' }} color={colors.primaryDark}>{money(owner ? b.ownerEarnings : b.totalPrice)}</T>
          </Row>
          <T variant="caption">{fmtDateTime(b.startAt)} → {fmtDateTime(b.endAt)}</T>
          <Row style={{ justifyContent: 'space-between' }}>
            <StatusBadge status={b.status} />
            <T variant="caption">{owner ? `${t('booking.driver')} : ${b.driver.firstName}` : b.car.city}</T>
          </Row>
        </View>
      </Row>
    </Card>
  );
}

