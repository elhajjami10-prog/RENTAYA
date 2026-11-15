import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Button, Field, Notice, Row, Screen, T } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { apiErrorMessage } from '../../lib/format';
import { colors } from '../../lib/theme';

export default function Register() {
  const { t } = useTranslation();
  const { register } = useAuth();
  const [f, setF] = useState({ firstName: '', lastName: '', email: '', phone: '', password: '', referralCode: '' });
  const [accept, setAccept] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const up = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });
  const submit = async () => {
    setBusy(true); setError(null);
    try {
      await register({ ...f, phone: f.phone || undefined, referralCode: f.referralCode || undefined });
      router.replace('/account/phone');
    } catch (e) { setError(apiErrorMessage(e)); }
    finally { setBusy(false); }
  };
  return (
    <Screen>
      <T variant="h2">{t('auth.joinTitle')}</T>
      <T color={colors.inkSoft} style={{ marginBottom: 16 }}>{t('auth.joinText')}</T>
      {error ? <View style={{ marginBottom: 12 }}><Notice tone="danger" icon="alert-circle" text={error} /></View> : null}
      <Row>
        <Field style={{ flex: 1 }} label={t('profile.firstName')} value={f.firstName} onChangeText={up('firstName')} autoComplete="given-name" />
        <Field style={{ flex: 1 }} label={t('profile.lastName')} value={f.lastName} onChangeText={up('lastName')} autoComplete="family-name" />
      </Row>
      <Field label={t('auth.email')} value={f.email} onChangeText={up('email')} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <Field label={t('auth.phone')} value={f.phone} onChangeText={up('phone')} keyboardType="phone-pad" placeholder="06 12 34 56 78" />
      <Field label={t('auth.password')} value={f.password} onChangeText={up('password')} secureTextEntry hint={t('auth.passwordHint')} />
      <Field label={t('auth.referral')} value={f.referralCode} onChangeText={up('referralCode')} autoCapitalize="characters" />
      <Pressable onPress={() => setAccept(!accept)} style={{ marginBottom: 14 }}>
        <Row gap={8}><Ionicons name={accept ? 'checkbox' : 'square-outline'} size={22} color={colors.primary} /><T variant="small" style={{ flex: 1 }}>{t('auth.acceptTerms')}</T></Row>
      </Pressable>
      <Button title={t('auth.createAccount')} disabled={!accept || f.password.length < 8 || !f.email || !f.firstName || !f.lastName} loading={busy} onPress={submit} />
      <Button title={t('auth.haveAccount')} variant="ghost" onPress={() => router.replace('/auth/login')} />
    </Screen>
  );
}
