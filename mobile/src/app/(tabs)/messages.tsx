import React from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Avatar, Empty, Loading, LoginPrompt, Row, T } from '../../components/ui';
import { StatusBadge } from '../../components/booking-ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { timeAgo } from '../../lib/format';
import { colors } from '../../lib/theme';

export default function Messages() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const q = useQuery({ queryKey: ['conversations'], queryFn: () => api('/conversations'), enabled: !!user, refetchInterval: 15_000 });
  if (!user) return <LoginPrompt title={t('messages.loginTitle')} text={t('messages.loginText')} />;
  return (
    <FlatList
      style={{ backgroundColor: '#fff' }}
      data={q.data || []}
      keyExtractor={(c) => c.id}
      contentContainerStyle={{ maxWidth: 820, width: '100%', alignSelf: 'center' }}
      renderItem={({ item: c }) => (
        <Pressable onPress={() => router.push(`/chat/${c.id}`)} style={({ pressed }) => [{ flexDirection: 'row', gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }, pressed && { backgroundColor: colors.bgSoft }]}>
          <Avatar uri={c.other.avatarUrl} name={c.other.firstName} size={52} />
          <View style={{ flex: 1, gap: 2 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <T style={{ fontWeight: c.unread ? '800' : '700' }}>{c.other.firstName} {c.other.lastName}</T>
              <T variant="caption">{c.lastMessage ? timeAgo(c.lastMessage.createdAt) : ''}</T>
            </Row>
            {c.car ? <T variant="caption">{c.car.make} {c.car.model}</T> : null}
            <Row style={{ justifyContent: 'space-between' }}>
              <T variant="small" numberOfLines={1} style={{ flex: 1, fontWeight: c.unread ? '700' : '400' }} color={c.unread ? colors.ink : colors.inkSoft}>{c.lastMessage?.body || t('messages.noMessage')}</T>
              {c.unread ? <View style={{ backgroundColor: colors.primary, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 }}><T variant="caption" color="#fff" style={{ fontWeight: '800' }}>{c.unread}</T></View> : null}
            </Row>
            {c.booking ? <StatusBadge status={c.booking.status} /> : null}
          </View>
        </Pressable>
      )}
      ListEmptyComponent={q.isLoading ? <Loading /> : <Empty icon="chatbubbles-outline" title={t('messages.empty')} text={t('messages.emptyText')} />}
      refreshing={q.isRefetching}
      onRefresh={() => q.refetch()}
    />
  );
}
