import React, { useState } from 'react';
import { FlatList, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Empty, Loading, LoginPrompt, Segmented } from '../../components/ui';
import { BookingRow } from '../../components/BookingRow';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';

export default function Trips() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [scope, setScope] = useState<'upcoming' | 'past'>('upcoming');
  const q = useQuery({ queryKey: ['bookings', 'driver', scope], queryFn: () => api('/bookings', { query: { role: 'driver', scope } }), enabled: !!user });
  if (!user) return <LoginPrompt title={t('trips.loginTitle')} text={t('trips.loginText')} />;
  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <FlatList
        data={q.data || []}
        keyExtractor={(b) => b.id}
        contentContainerStyle={{ padding: 16, gap: 12, maxWidth: 820, width: '100%', alignSelf: 'center' }}
        ListHeaderComponent={<Segmented value={scope} onChange={setScope} options={[{ value: 'upcoming', label: t('trips.upcoming') }, { value: 'past', label: t('trips.past') }]} />}
        renderItem={({ item }) => <BookingRow b={item} />}
        ListEmptyComponent={q.isLoading ? <Loading /> : <Empty icon="car-sport-outline" title={t('trips.empty')} text={t('trips.emptyText')} action={t('search.cta')} onAction={() => router.push('/')} />}
        refreshing={q.isRefetching}
        onRefresh={() => q.refetch()}
      />
    </View>
  );
}
