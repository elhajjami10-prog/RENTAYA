import React from 'react';
import { Linking, Platform, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Avatar, Badge, Card, ListItem, LoginPrompt, Notice, Row, Screen, Section, Stars, T } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { DEMO } from '../../lib/api';
import { money } from '../../lib/format';
import { colors } from '../../lib/theme';

export default function Profile() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  if (!user) return <LoginPrompt title={t('profile.loginTitle')} text={t('profile.loginText')} />;
  const v = user.verificationStatus;
  return (
    <Screen>
      <Card>
        <Row gap={14}>
          <Avatar uri={user.avatarUrl} name={user.firstName} size={68} />
          <View style={{ flex: 1, gap: 4 }}>
            <T variant="h2">{user.firstName} {user.lastName}</T>
            <Row gap={6} style={{ flexWrap: 'wrap' }}>
              <Badge label={t(`verification.status.${v}`)} tone={v === 'VERIFIED' ? 'success' : v === 'PENDING' ? 'warning' : v === 'REJECTED' ? 'danger' : 'muted'} icon={v === 'VERIFIED' ? 'checkmark-circle' : 'alert-circle'} />
              {user.isPro ? <Badge label="Pro" tone="primary" icon="briefcase" /> : null}
            </Row>
            <Stars value={user.ratingAvg} count={user.ratingCount} />
          </View>
        </Row>
        <ListItem icon="eye-outline" title={t('profile.viewPublic')} onPress={() => router.push(`/user/${user.id}`)} />
      </Card>

      {v !== 'VERIFIED' ? (
        <View style={{ marginTop: 14 }}>
          <Notice tone={v === 'REJECTED' ? 'danger' : 'warning'} icon="id-card" title={t('verification.title')}
            text={v === 'PENDING' ? t('verification.pendingText') : v === 'REJECTED' ? (user.verificationNote || t('verification.rejectedText')) : t('verification.needText')}
            action={v === 'PENDING' ? undefined : t('verification.start')} onAction={() => router.push('/account/verification')} />
        </View>
      ) : null}
      {!user.phoneVerified ? <View style={{ marginTop: 10 }}><Notice tone="warning" icon="call" text={t('phone.needText')} action={t('phone.verify')} onAction={() => router.push('/account/phone')} /></View> : null}

      <Section title={t('profile.account')}>
        <Card style={{ paddingVertical: 4 }}>
          <ListItem icon="person-outline" title={t('profile.edit')} onPress={() => router.push('/account/edit')} />
          <ListItem icon="id-card-outline" title={t('verification.title')} subtitle={t(`verification.status.${v}`)} onPress={() => router.push('/account/verification')} />
          <ListItem icon="call-outline" title={t('phone.title')} subtitle={user.phone || undefined} onPress={() => router.push('/account/phone')} />
          <ListItem icon="settings-outline" title={t('settings.title')} subtitle={t('settings.subtitle')} onPress={() => router.push('/account/settings')} />
        </Card>
      </Section>

      <Section title={t('profile.activity')}>
        <Card style={{ paddingVertical: 4 }}>
          <ListItem icon="heart-outline" title={t('favorites.title')} onPress={() => router.push('/account/favorites')} />
          <ListItem icon="gift-outline" title={t('wallet.title')} subtitle={t('wallet.balance', { amount: money(user.walletBalance) })} onPress={() => router.push('/account/wallet')} />
          <ListItem icon="receipt-outline" title={t('paymentsHistory.title')} onPress={() => router.push('/account/payments')} />
          <ListItem icon="notifications-outline" title={t('notifications.title')} onPress={() => router.push('/account/notifications')} />
        </Card>
      </Section>

      <Section title={t('profile.ownerSpace')}>
        <Card style={{ paddingVertical: 4 }}>
          <ListItem icon="key-outline" title={t('tabs.garage')} onPress={() => router.push('/garage')} />
          <ListItem icon="stats-chart-outline" title={t('earnings.title')} onPress={() => router.push('/owner/earnings')} />
          <ListItem icon="business-outline" title={t('bank.title')} subtitle={user.rib ? `•••• ${String(user.rib).replace(/\s/g, '').slice(-4)}` : t('bank.missing')} onPress={() => router.push('/account/bank')} />
        </Card>
      </Section>

      <Section title={t('profile.support')}>
        <Card style={{ paddingVertical: 4 }}>
          <ListItem icon="help-circle-outline" title={t('help.title')} onPress={() => router.push('/account/help')} />
          <ListItem icon="chatbox-ellipses-outline" title={t('support.title')} onPress={() => router.push('/account/support')} />
          <ListItem icon="document-text-outline" title={t('legal.title')} onPress={() => router.push('/account/legal')} />
          {user.role === 'ADMIN' ? <ListItem icon="speedometer-outline" title={t('profile.admin')} onPress={() => Linking.openURL(DEMO && process.env.EXPO_PUBLIC_ADMIN_URL ? process.env.EXPO_PUBLIC_ADMIN_URL : Platform.OS === 'web' ? `${window.location.protocol}//${window.location.hostname}:5173` : 'http://localhost:5173')} /> : null}
          <ListItem icon="log-out-outline" danger title={t('auth.logout')} onPress={logout} />
        </Card>
      </Section>
      <T variant="caption" center style={{ marginTop: 20 }} color={colors.muted}>Rentaya · v1.0.0</T>
    </Screen>
  );
}
