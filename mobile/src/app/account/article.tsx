import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Loading, Screen, T } from '../../components/ui';
import { api } from '../../lib/api';

export default function Article() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { i18n } = useTranslation();
  const q = useQuery({ queryKey: ['article', slug, i18n.language], queryFn: () => api(`/public/help/${slug}`, { query: { locale: i18n.language } }) });
  if (!q.data) return <Loading />;
  return (
    <Screen>
      <T variant="caption">{q.data.category}</T>
      <T variant="h2" style={{ marginVertical: 10 }}>{q.data.title}</T>
      <T style={{ lineHeight: 24 }}>{q.data.body}</T>
    </Screen>
  );
}
