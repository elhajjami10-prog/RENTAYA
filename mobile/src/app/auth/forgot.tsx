import React, { useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, Field, Notice, Screen } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { apiErrorMessage } from '../../lib/format';

export default function Forgot() {
  const { t } = useTranslation();
  const { setSession } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try { await api('/auth/forgot-password', { body: { email } }); setSent(true); } catch (e) { Alert.alert(t('errors.title'), apiErrorMessage(e)); } finally { setBusy(false); }
  };
  const reset = async () => {
    setBusy(true);
    try { const r = await api('/auth/reset-password', { body: { email, code, password } }); await setSession(r.token); router.replace('/'); }
    catch (e) { Alert.alert(t('errors.title'), apiErrorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <Screen>
      <Notice icon="mail" text={sent ? t('auth.codeSent') : t('auth.forgotText')} />
      <Field style={{ marginTop: 16 }} label={t('auth.email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" editable={!sent} />
      {sent ? <>
        <Field label={t('auth.code')} value={code} onChangeText={setCode} keyboardType="number-pad" />
        <Field label={t('auth.newPassword')} value={password} onChangeText={setPassword} secureTextEntry hint={t('auth.passwordHint')} />
        <Button title={t('auth.resetPassword')} loading={busy} disabled={code.length < 6 || password.length < 8} onPress={reset} />
      </> : <Button title={t('auth.sendCode')} loading={busy} disabled={!email} onPress={send} />}
    </Screen>
  );
}
