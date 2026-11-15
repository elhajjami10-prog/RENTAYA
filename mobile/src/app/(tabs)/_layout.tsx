import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { colors } from '../../lib/theme';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';

export default function TabsLayout() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const unread = useQuery({ queryKey: ['unread'], queryFn: () => api('/conversations/unread-count'), enabled: !!user, refetchInterval: 20_000 });
  const icon = (name: React.ComponentProps<typeof Ionicons>['name']) => ({ color, focused }: { color: string; focused: boolean }) =>
    <Ionicons name={(focused ? name : `${name}-outline`) as never} size={24} color={color} />;
  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.muted,
      headerTitleStyle: { fontWeight: '800', color: colors.ink }, headerShadowVisible: false,
      tabBarStyle: { borderTopColor: colors.border }, tabBarLabelStyle: { fontWeight: '600', fontSize: 11 },
    }}>
      <Tabs.Screen name="index" options={{ title: t('tabs.search'), headerShown: false, tabBarIcon: icon('search') }} />
      <Tabs.Screen name="trips" options={{ title: t('tabs.trips'), tabBarIcon: icon('car-sport') }} />
      <Tabs.Screen name="messages" options={{ title: t('tabs.messages'), tabBarIcon: icon('chatbubbles'), tabBarBadge: unread.data?.count || undefined }} />
      <Tabs.Screen name="garage" options={{ title: t('tabs.garage'), tabBarIcon: icon('key') }} />
      <Tabs.Screen name="profile" options={{ title: t('tabs.profile'), tabBarIcon: icon('person-circle') }} />
    </Tabs>
  );
}
