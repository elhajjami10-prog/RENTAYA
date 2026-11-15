import React, { useState } from 'react';
import { Alert, Platform, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Button, Card, Loading, Notice, Row, Screen, Section, T } from '../../../components/ui';
import { PhotoPicker } from '../../../components/PhotoPicker';
import { api } from '../../../lib/api';
import { apiErrorMessage, money } from '../../../lib/format';
import { colors, radius } from '../../../lib/theme';

type Method = 'CMI' | 'WAFACASH' | 'CASHPLUS' | 'BANK_TRANSFER';
const METHODS: { m: Method; icon: string }[] = [
  { m: 'CMI', icon: 'card' }, { m: 'WAFACASH', icon: 'cash' }, { m: 'CASHPLUS', icon: 'wallet' }, { m: 'BANK_TRANSFER', icon: 'business' },
];

export default function Pay() {
  const { id, extensionId, chargeId, amount: amountParam } = useLocalSearchParams<{ id: string; extensionId?: string; chargeId?: string; amount?: string }>();
  const { t } = useTranslation();
  const [method, setMethod] = useState<Method>('CMI');
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState<{ paymentId: string; instructions: string; reference: string; amount: number } | null>(null);
  const [proof, setProof] = useState<string[]>([]);
  const b = useQuery({ queryKey: ['booking', id], queryFn: () => api(`/bookings/${id}`) });
  if (!b.data) return <Loading />;
  const amount = amountParam ? Number(amountParam) : b.data.totalPrice;
  const path = extensionId ? `/bookings/${id}/extensions/${extensionId}/pay` : chargeId ? `/bookings/${id}/charges/${chargeId}/pay` : `/bookings/${id}/pay`;

  const start = async () => {
    setBusy(true);
    try {
      const returnUrl = Platform.OS === 'web' ? `${window.location.origin}/payment-result` : Linking.createURL('payment-result');
      const r = await api(path, { body: { method, redirect: returnUrl } });
      if (r.status === 'PAID') return router.replace(`/booking/${id}`);
      if (r.redirectUrl) {
        if (Platform.OS === 'web') { window.location.href = r.redirectUrl; return; }
        const res = await WebBrowser.openAuthSessionAsync(r.redirectUrl, returnUrl);
        await b.refetch();
        if (res.type === 'success' && res.url.includes('status=ok')) router.replace({ pathname: '/payment-result', params: { status: 'ok', bookingId: id } });
        else Alert.alert(t('payment.notCompleted'));
      } else setManual(r);
    } catch (e) { Alert.alert(t('errors.title'), apiErrorMessage(e)); }
    finally { setBusy(false); }
  };

  const sendProof = async () => {
    if (!manual || !proof[0]) return;
    setBusy(true);
    try {
      await api(`/payments/${manual.paymentId}/proof`, { body: { proofUrl: proof[0] } });
      Alert.alert(t('payment.proofSent'), t('payment.awaitingValidationText'));
      router.replace(`/booking/${id}`);
    } catch (e) { Alert.alert(t('errors.title'), apiErrorMessage(e)); }
    finally { setBusy(false); }
  };

  if (manual) {
    return (
      <Screen footer={<Button title={t('payment.sendProof')} icon="cloud-upload" disabled={!proof.length} loading={busy} onPress={sendProof} />}>
        <Card>
          <T variant="label">{t('payment.amountToPay')}</T>
          <T variant="h1" color={colors.primaryDark}>{money(manual.amount)}</T>
          <Pressable onPress={() => Clipboard.setStringAsync(manual.reference)}>
            <Row gap={6} style={{ marginTop: 8 }}><T variant="small">{t('payment.reference')} : <T style={{ fontWeight: '800' }}>{manual.reference}</T></T><Ionicons name="copy-outline" size={16} color={colors.primary} /></Row>
          </Pressable>
        </Card>
        <View style={{ marginTop: 14 }}><Notice icon="information-circle" text={manual.instructions} /></View>
        <Section title={t('payment.receipt')}>
          <PhotoPicker value={proof} onChange={setProof} max={1} camera />
        </Section>
        <T variant="caption" style={{ marginTop: 12 }}>{t('payment.manualDelay')}</T>
      </Screen>
    );
  }

  return (
    <Screen footer={<Button title={t('payment.pay', { amount: money(amount) })} icon="lock-closed" loading={busy} onPress={start} />}>
      <Card>
        <T variant="label">{t('payment.amountToPay')}</T>
        <T variant="h1" color={colors.primaryDark}>{money(amount)}</T>
        <T variant="caption">{b.data.car.make} {b.data.car.model} · {b.data.reference}</T>
      </Card>
      <Section title={t('payment.method')}>
        <View style={{ gap: 10 }}>
          {METHODS.map(({ m, icon }) => (
            <Pressable key={m} onPress={() => setMethod(m)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.lg, borderWidth: 2, borderColor: method === m ? colors.primary : colors.border, backgroundColor: method === m ? colors.primarySoft : '#fff' }}>
              <Ionicons name={icon as never} size={24} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <T style={{ fontWeight: '700' }}>{t(`payment.methods.${m}`)}</T>
                <T variant="caption">{t(`payment.methodsHint.${m}`)}</T>
              </View>
              <Ionicons name={method === m ? 'radio-button-on' : 'radio-button-off'} size={22} color={colors.primary} />
            </Pressable>
          ))}
        </View>
      </Section>
      <View style={{ marginTop: 16 }}>
        <Notice icon="shield-checkmark" text={t('payment.secure')} />
      </View>
      {!extensionId && !chargeId && b.data.depositAmount ? <T variant="caption" style={{ marginTop: 12 }}>{t('payment.depositInfo', { amount: money(b.data.depositAmount) })}</T> : null}
    </Screen>
  );
}
