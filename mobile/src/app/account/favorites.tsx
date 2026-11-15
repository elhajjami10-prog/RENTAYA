import React from 'react';
import { FlatList } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Empty, Loading } from '../../components/ui';
import { CarCard } from '../../components/CarCard';
import { api } from '../../lib/api';

export default function Favorites() {
  const { t } = useTranslation();
  const q = useQuery({ queryKey: ['favorites'], queryFn: () => api('/account/favorites') });
  return (
    <FlatList style={{ backgroundColor: '#fff' }} data={q.data || []} keyExtractor={(c) => c.id}
      contentContainerStyle={{ padding: 16, gap: 14, maxWidth: 820, width: '100%', alignSelf: 'center' }}
      renderItem={({ item }) => <CarCard car={item} />} refreshing={q.isRefetching} onRefresh={() => q.refetch()}
      ListEmptyComponent={q.isLoading ? <Loading /> : <Empty icon="heart-outline" title={t('favorites.empty')} text={t('favorites.emptyText')} action={t('search.cta')} onAction={() => router.push('/')} />} />
  );
}
