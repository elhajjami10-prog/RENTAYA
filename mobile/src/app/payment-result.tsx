import React, { useEffect } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Button, Screen, T } from '../components/ui';
import { colors } from '../lib/theme';

export default function PaymentResult() {
  const { status, bookingId } = useLocalSearchParams<{ status: string; bookingId?: string }>();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const ok = status === 'ok';
  useEffect(() => { qc.invalidateQueries(); }, [qc]);
  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ alignItems: 'center', marginTop: 80, gap: 12 }}>
        <Ionicons name={ok ? 'checkmark-circle' : 'close-circle'} size={96} color={ok ? colors.success : colors.danger} />
        <T variant="h1" center>{ok ? t('payment.success') : t('payment.failed')}</T>
        <T center color={colors.inkSoft}>{ok ? t('payment.successText') : t('payment.failedText')}</T>
        <Button title={t('payment.seeBooking')} style={{ alignSelf: 'stretch', marginTop: 20 }} onPress={() => router.replace(bookingId ? `/booking/${bookingId}` : '/trips')} />
        <Button title={t('common.home')} variant="ghost" onPress={() => router.replace('/')} />
      </View>
    </Screen>
  );
}
