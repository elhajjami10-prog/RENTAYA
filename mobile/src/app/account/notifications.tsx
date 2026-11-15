import React, { useEffect } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Empty, Loading, T } from '../../components/ui';
import { api } from '../../lib/api';
import { timeAgo } from '../../lib/format';
import { colors } from '../../lib/theme';

export default function Notifications() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['notifications'], queryFn: () => api('/account/notifications') });
  useEffect(() => {
    if (q.data?.unread) api('/account/notifications/read', { body: {} }).then(() => qc.invalidateQueries({ queryKey: ['notifications'] }));
  }, [q.data?.unread, qc]);
  const open = (n: any) => {
    if (n.data?.bookingId) router.push(`/booking/${n.data.bookingId}`);
    else if (n.data?.conversationId) router.push(`/chat/${n.data.conversationId}`);
    else if (n.data?.carId) router.push(`/car/${n.data.carId}`);
  };
  return (
    <FlatList style={{ backgroundColor: '#fff' }} data={q.data?.items || []} keyExtractor={(n) => n.id}
      contentContainerStyle={{ maxWidth: 820, width: '100%', alignSelf: 'center' }}
      refreshing={q.isRefetching} onRefresh={() => q.refetch()}
      ListEmptyComponent={q.isLoading ? <Loading /> : <Empty icon="notifications-outline" title={t('notifications.empty')} />}
      renderItem={({ item: n }) => (
        <Pressable onPress={() => open(n)} style={{ flexDirection: 'row', gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: n.read ? '#fff' : colors.bgSoft }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={n.type.startsWith('MESSAGE') ? 'chatbubble' : n.type.startsWith('BOOKING') ? 'car-sport' : n.type.includes('PAY') ? 'card' : 'notifications'} size={19} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <T style={{ fontWeight: '700' }}>{n.title}</T>
            <T variant="small" color={colors.inkSoft}>{n.body}</T>
            <T variant="caption">{timeAgo(n.createdAt)}</T>
          </View>
        </Pressable>
      )} />
  );
}
