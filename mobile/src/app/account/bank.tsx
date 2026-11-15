import React, { useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, Field, Notice, Screen } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { apiErrorMessage } from '../../lib/format';

/** Coordonnées bancaires (RIB marocain, 24 chiffres) pour recevoir les versements. */
export default function Bank() {
  const { t } = useTranslation();
  const { user, refresh } = useAuth();
  const [f, setF] = useState({ bankHolder: user?.bankHolder || '', bankName: user?.bankName || '', rib: user?.rib || '' });
  const [busy, setBusy] = useState(false);
  const digits = f.rib.replace(/\s/g, '');
  const save = async () => {
    setBusy(true);
    try { await api('/users/me', { method: 'PATCH', body: f }); await refresh(); router.back(); } catch (e) { Alert.alert(t('errors.title'), apiErrorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <Screen footer={<Button title={t('common.save')} loading={busy} disabled={digits.length !== 24 || !f.bankHolder} onPress={save} />}>
      <Notice icon="lock-closed" text={t('bank.intro')} />
      <Field style={{ marginTop: 16 }} label={t('bank.holder')} value={f.bankHolder} onChangeText={(v) => setF({ ...f, bankHolder: v })} />
      <Field label={t('bank.name')} value={f.bankName} onChangeText={(v) => setF({ ...f, bankName: v })} placeholder="Attijariwafa bank, CIH, BMCE…" />
      <Field label="RIB" value={f.rib} onChangeText={(v) => setF({ ...f, rib: v })} keyboardType="number-pad" placeholder="000 000 0000000000000000 00" hint={t('bank.ribHint', { count: digits.length })} />
    </Screen>
  );
}
