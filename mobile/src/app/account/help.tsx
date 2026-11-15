import React, { useState } from 'react';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Button, Card, Field, ListItem, Loading, Screen, Section } from '../../components/ui';
import { api } from '../../lib/api';
import { colors } from '../../lib/theme';

export default function Help() {
  const { t, i18n } = useTranslation();
  const [q, setQ] = useState('');
  const list = useQuery({ queryKey: ['help', i18n.language], queryFn: () => api('/public/help', { query: { locale: i18n.language } }) });
  if (!list.data) return <Loading />;
  const items = list.data.filter((a: any) => a.title.toLowerCase().includes(q.toLowerCase()));
  const cats = [...new Set(items.map((a: any) => a.category))] as string[];
  return (
    <Screen>
      <Field placeholder={t('help.search')} value={q} onChangeText={setQ} right={<Ionicons name="search" size={18} color={colors.muted} />} />
      {cats.map((c) => (
        <Section key={c} title={c} style={{ marginTop: 12 }}>
          <Card style={{ paddingVertical: 4 }}>
            {items.filter((a: any) => a.category === c).map((a: any) => <ListItem key={a.id} title={a.title} onPress={() => router.push({ pathname: '/account/article', params: { slug: a.slug } })} />)}
          </Card>
        </Section>
      ))}
      <Button title={t('support.title')} icon="chatbox-ellipses" variant="secondary" style={{ marginTop: 24 }} onPress={() => router.push('/account/support')} />
    </Screen>
  );
}
