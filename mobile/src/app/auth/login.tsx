import React, { useState } from 'react';
import { router } from 'expo-router';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Button, Field, Notice, Screen, T } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { DEMO } from '../../lib/api';
import { apiErrorMessage } from '../../lib/format';

export default function Login() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true); setError(null);
    try { await login(email, password); router.canGoBack() ? router.back() : router.replace('/'); }
    catch (e) { setError(apiErrorMessage(e)); }
    finally { setBusy(false); }
  };
  return (
    <Screen>
      <View style={{ alignItems: 'center', marginVertical: 20 }}>
        <Image source={require('../../../assets/logo-full.png')} style={{ width: 180, height: 180 }} contentFit="contain" />
      </View>
      <T variant="h2" style={{ marginBottom: 16 }}>{t('auth.welcomeBack')}</T>
      {DEMO ? <View style={{ marginBottom: 12 }}><Notice icon="flask" text={t('demo.accounts')} action={t('demo.useDriver')} onAction={() => { setEmail('salma@rentaya.ma'); setPassword('demo'); }} /></View> : null}
      {error ? <View style={{ marginBottom: 12 }}><Notice tone="danger" icon="alert-circle" text={error} /></View> : null}
      <Field label={t('auth.email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <Field label={t('auth.password')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" onSubmitEditing={submit} />
      <Button title={t('auth.login')} loading={busy} onPress={submit} />
      <Button title={t('auth.forgot')} variant="ghost" onPress={() => router.push('/auth/forgot')} />
      <Button title={t('auth.noAccount')} variant="outline" onPress={() => router.replace('/auth/register')} style={{ marginTop: 8 }} />
    </Screen>
  );
}
