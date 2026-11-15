import React, { useState } from 'react';
import { Alert, FlatList, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Card, Empty, Loading, LoginPrompt, Row, Segmented, Stars, T } from '../../components/ui';
import { BookingRow } from '../../components/BookingRow';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { apiErrorMessage, money } from '../../lib/format';
import { colors, radius } from '../../lib/theme';

const CAR_TONE: Record<string, 'success' | 'warning' | 'danger' | 'muted'> = { ACTIVE: 'success', PENDING_REVIEW: 'warning', PAUSED: 'muted', REJECTED: 'danger', DRAFT: 'muted' };

export default function Garage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [tab, setTab] = useState<'requests' | 'bookings' | 'cars'>('cars');
  const cars = useQuery({ queryKey: ['myCars'], queryFn: () => api('/cars/mine/list'), enabled: !!user });
  const requests = useQuery({ queryKey: ['bookings', 'owner', 'requests'], queryFn: () => api('/bookings', { query: { role: 'owner', scope: 'requests' } }), enabled: !!user, refetchInterval: 30_000 });
  const bookings = useQuery({ queryKey: ['bookings', 'owner', 'upcoming'], queryFn: () => api('/bookings', { query: { role: 'owner', scope: 'upcoming' } }), enabled: !!user && tab === 'bookings' });
  if (!user) return <LoginPrompt title={t('garage.loginTitle')} text={t('garage.loginText')} />;

  const setStatus = async (id: string, status: string) => {
    try { await api(`/cars/${id}/status`, { body: { status } }); cars.refetch(); } catch (e) { Alert.alert(t('errors.title'), apiErrorMessage(e)); }
  };
  const nReq = requests.data?.length || 0;

  const header = (
    <View style={{ gap: 12, marginBottom: 4 }}>
      <Row>
        <Button title={t('garage.addCar')} icon="add-circle" style={{ flex: 1 }} onPress={() => router.push('/owner/car-form')} />
        <Button title={t('earnings.title')} icon="stats-chart" variant="secondary" style={{ flex: 1 }} onPress={() => router.push('/owner/earnings')} />
      </Row>
      <Segmented value={tab} onChange={setTab} options={[
        { value: 'cars', label: t('garage.cars') },
        { value: 'requests', label: nReq ? `${t('garage.requests')} (${nReq})` : t('garage.requests') },
        { value: 'bookings', label: t('garage.bookings') },
      ]} />
    </View>
  );

  const common = { contentContainerStyle: { padding: 16, gap: 12, maxWidth: 820, width: '100%' as const, alignSelf: 'center' as const }, ListHeaderComponent: header };

  if (tab === 'requests' || tab === 'bookings') {
    const q = tab === 'requests' ? requests : bookings;
    return (
      <FlatList style={{ backgroundColor: '#fff' }} {...common} data={q.data || []} keyExtractor={(b) => b.id}
        renderItem={({ item }) => <BookingRow b={item} owner />}
        refreshing={q.isRefetching} onRefresh={() => q.refetch()}
        ListEmptyComponent={q.isLoading ? <Loading /> : <Empty icon="file-tray-outline" title={tab === 'requests' ? t('garage.noRequests') : t('garage.noBookings')} />} />
    );
  }

  return (
    <FlatList style={{ backgroundColor: '#fff' }} {...common} data={cars.data || []} keyExtractor={(c) => c.id}
      refreshing={cars.isRefetching} onRefresh={() => cars.refetch()}
      ListEmptyComponent={cars.isLoading ? <Loading /> : <Empty icon="key-outline" title={t('garage.empty')} text={t('garage.emptyText')} action={t('garage.addCar')} onAction={() => router.push('/owner/car-form')} />}
      renderItem={({ item: c }) => (
        <Card>
          <Row gap={12} style={{ alignItems: 'flex-start' }}>
            <Image source={{ uri: c.photos[0]?.url }} style={{ width: 96, height: 72, borderRadius: radius.sm, backgroundColor: colors.primarySoft }} />
            <View style={{ flex: 1, gap: 4 }}>
              <T style={{ fontWeight: '800' }}>{c.make} {c.model} <T variant="caption">{c.year}</T></T>
              <Badge label={t(`enums.carStatus.${c.status}`)} tone={CAR_TONE[c.status] || 'muted'} />
              <Row gap={10}><T variant="caption">{money(c.pricePerDay)}/{t('common.day')}</T><Stars value={c.ratingAvg} count={c.ratingCount} size={12} /></Row>
            </View>
          </Row>
          {c.status === 'REJECTED' && c.rejectionReason ? <T variant="caption" color={colors.danger} style={{ marginTop: 8 }}>{c.rejectionReason}</T> : null}
          <Row style={{ marginTop: 12, flexWrap: 'wrap' }} gap={6}>
            <Button small variant="secondary" icon="eye-outline" title={t('garage.view')} onPress={() => router.push(`/car/${c.id}`)} />
            <Button small variant="secondary" icon="create-outline" title={t('common.edit')} onPress={() => router.push({ pathname: '/owner/car-form', params: { id: c.id } })} />
            <Button small variant="secondary" icon="calendar-outline" title={t('calendar.title')} onPress={() => router.push({ pathname: '/owner/calendar', params: { id: c.id } })} />
            <Button small variant="secondary" icon="document-outline" title={t('carDocs.short')} onPress={() => router.push({ pathname: '/owner/car-documents', params: { id: c.id } })} />
            {c.status === 'ACTIVE' ? <Button small variant="ghost" icon="pause" title={t('garage.pause')} onPress={() => setStatus(c.id, 'PAUSED')} /> : null}
            {c.status === 'PAUSED' ? <Button small variant="ghost" icon="play" title={t('garage.activate')} onPress={() => setStatus(c.id, 'ACTIVE')} /> : null}
          </Row>
        </Card>
      )} />
  );
}
