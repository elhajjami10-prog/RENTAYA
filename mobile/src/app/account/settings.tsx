import React, { useState } from 'react';
import { Alert, Platform, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, Card, Chip, Field, Row, Screen, Section, Toggle } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { LANGS, setLanguage, type Lang } from '../../lib/i18n';
import { apiErrorMessage } from '../../lib/format';

export default function Settings() {
  const { t, i18n } = useTranslation();
  const { user, refresh, logout } = useAuth();
  const [pw, setPw] = useState({ current: '', password: '' });
  const changeLang = async (l: Lang) => {
    const restart = await setLanguage(l);
    if (user) api('/users/me', { method: 'PATCH', body: { language: l } }).catch(() => {});
    if (restart) Alert.alert(t('settings.restartTitle'), t('settings.restartText'));
  };
  const pref = async (k: string, v: boolean) => { await api('/users/me', { method: 'PATCH', body: { [k]: v } }); refresh(); };
  const changePw = async () => {
    try { await api('/auth/change-password', { body: pw }); setPw({ current: '', password: '' }); Alert.alert(t('settings.passwordChanged')); }
    catch (e) { Alert.alert(t('errors.title'), apiErrorMessage(e)); }
  };
  const del = () => {
    const go = async () => {
      try { await api('/auth/me', { method: 'DELETE' }); await logout(); router.replace('/'); } catch (e) { Alert.alert(t('errors.title'), apiErrorMessage(e)); }
    };
    if (Platform.OS === 'web') { if (window.confirm(t('settings.deleteConfirm'))) go(); }
    else Alert.alert(t('settings.delete'), t('settings.deleteConfirm'), [{ text: t('common.cancel'), style: 'cancel' }, { text: t('settings.delete'), style: 'destructive', onPress: go }]);
  };
  return (
    <Screen>
      <Section title={t('settings.language')} style={{ marginTop: 0 }}>
        <Row gap={8}>{LANGS.map((l) => <Chip key={l.code} label={l.label} selected={i18n.language === l.code} onPress={() => changeLang(l.code)} />)}</Row>
      </Section>
      {user ? <>
        <Section title={t('settings.notifications')}>
          <Card style={{ paddingVertical: 4 }}>
            <Toggle label={t('settings.push')} value={!!user.notifyPush} onChange={(v) => pref('notifyPush', v)} />
            <Toggle label={t('settings.email')} value={!!user.notifyEmail} onChange={(v) => pref('notifyEmail', v)} />
            <Toggle label={t('settings.sms')} value={!!user.notifySms} onChange={(v) => pref('notifySms', v)} />
          </Card>
        </Section>
        <Section title={t('settings.password')}>
          <Field label={t('settings.currentPassword')} secureTextEntry value={pw.current} onChangeText={(v) => setPw({ ...pw, current: v })} />
          <Field label={t('auth.newPassword')} secureTextEntry value={pw.password} onChangeText={(v) => setPw({ ...pw, password: v })} hint={t('auth.passwordHint')} />
          <Button title={t('settings.changePassword')} variant="secondary" disabled={pw.password.length < 8 || !pw.current} onPress={changePw} />
        </Section>
        <View style={{ marginTop: 30 }}><Button title={t('settings.delete')} variant="ghost" onPress={del} /></View>
      </> : null}
    </Screen>
  );
}
