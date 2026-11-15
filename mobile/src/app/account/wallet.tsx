import React from 'react';
import { Pressable, Share, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { Button, Card, Loading, Row, Screen, Section, T } from '../../components/ui';
import { api } from '../../lib/api';
import { fmtDate, money } from '../../lib/format';
import { colors, gradient, radius } from '../../lib/theme';

export default function Wallet() {
  const { t } = useTranslation();
  const q = useQuery({ queryKey: ['wallet'], queryFn: () => api('/account/wallet') });
  if (!q.data) return <Loading />;
  const w = q.data;
  const shareText = t('wallet.shareText', { code: w.referralCode, amount: money(w.referralBonusReferee) });
  return (
    <Screen>
      <LinearGradient colors={[gradient[0], gradient[2]]} style={{ borderRadius: radius.xl, padding: 20 }}>
        <T color="rgba(255,255,255,0.85)">{t('wallet.credit')}</T>
        <T variant="h1" color="#fff">{money(w.balance)}</T>
        <T variant="caption" color="rgba(255,255,255,0.85)">{t('wallet.creditHint')}</T>
      </LinearGradient>
      <Section title={t('wallet.referTitle')}>
        <Card>
          <T>{t('wallet.referText', { referee: money(w.referralBonusReferee), referrer: money(w.referralBonusReferrer) })}</T>
          <Pressable onPress={() => Clipboard.setStringAsync(w.referralCode)} style={{ marginVertical: 14, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.primaryLight, borderRadius: radius.md, padding: 14, alignItems: 'center' }}>
            <T variant="h2" color={colors.primaryDark} style={{ letterSpacing: 3 }}>{w.referralCode}</T>
            <Row gap={4}><Ionicons name="copy-outline" size={14} color={colors.primary} /><T variant="caption" color={colors.primary}>{t('wallet.copy')}</T></Row>
          </Pressable>
          <Button title={t('wallet.share')} icon="share-social" onPress={() => Share.share({ message: shareText })} />
          <T variant="caption" center style={{ marginTop: 10 }}>{t('wallet.referrals', { count: w.referrals })}</T>
        </Card>
      </Section>
      <Section title={t('wallet.history')}>
        {w.transactions.length === 0 ? <T color={colors.inkSoft}>{t('wallet.noTx')}</T> : null}
        {w.transactions.map((x: any) => (
          <Row key={x.id} style={{ justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <View style={{ flex: 1 }}><T style={{ fontWeight: '600' }}>{x.note || t(`enums.walletTx.${x.type}`)}</T><T variant="caption">{fmtDate(x.createdAt, true)}</T></View>
            <T style={{ fontWeight: '800' }} color={x.amount > 0 ? colors.success : colors.ink}>{x.amount > 0 ? '+' : ''}{money(x.amount)}</T>
          </Row>
        ))}
      </Section>
    </Screen>
  );
}
