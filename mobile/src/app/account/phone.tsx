import React, { useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, Field, Notice, Screen } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { apiErrorMessage } from '../../lib/format';

export default function Phone() {
  const { t } = useTranslation();
  const { user, refresh } = useAuth();
  const [phone, setPhone] = useState(user?.phone || '');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try { await api('/auth/phone/send-otp', { body: { phone } }); setSent(true); } catch (e) { Alert.alert(t('errors.title'), apiErrorMessage(e)); } finally { setBusy(false); }
  };
  const verify = async () => {
    setBusy(true);
    try { await api('/auth/phone/verify', { body: { code } }); await refresh(); Alert.alert(t('phone.verified')); router.canGoBack() ? router.back() : router.replace('/'); }
    catch (e) { Alert.alert(t('errors.title'), apiErrorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <Screen>
      {user?.phoneVerified && !sent ? <Notice tone="success" icon="checkmark-circle" text={t('phone.isVerified', { phone: user.phone })} /> : <Notice icon="call" text={t('phone.intro')} />}
      <Field style={{ marginTop: 16 }} label={t('auth.phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="06 12 34 56 78" editable={!sent} />
      {sent ? <>
        <Field label={t('auth.code')} value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} hint={t('phone.codeHint')} />
        <Button title={t('phone.verify')} loading={busy} disabled={code.length < 6} onPress={verify} />
        <Button title={t('phone.resend')} variant="ghost" onPress={send} />
      </> : <Button title={t('auth.sendCode')} loading={busy} disabled={phone.length < 9} onPress={send} />}
      {!sent ? <Button title={t('common.later')} variant="ghost" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} /> : null}
    </Screen>
  );
}
