import React, { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Avatar, Button, Field, Row, Screen, Section, T, Toggle } from '../../components/ui';
import { pickAndUpload } from '../../components/PhotoPicker';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { apiErrorMessage, fmtDate } from '../../lib/format';
import { colors } from '../../lib/theme';

export default function EditProfile() {
  const { t } = useTranslation();
  const { user, refresh } = useAuth();
  const [f, setF] = useState({
    firstName: user?.firstName || '', lastName: user?.lastName || '', city: user?.city || '', address: user?.address || '', bio: user?.bio || '',
    avatarUrl: user?.avatarUrl || null, birthDate: user?.birthDate || null, isPro: !!user?.isPro, companyName: user?.companyName || '', companyIce: user?.companyIce || '',
  });
  const [dateOpen, setDateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { await api('/users/me', { method: 'PATCH', body: { ...f, companyName: f.companyName || null, companyIce: f.companyIce || null } }); await refresh(); router.back(); }
    catch (e) { Alert.alert(t('errors.title'), apiErrorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <Screen footer={<Button title={t('common.save')} loading={busy} onPress={save} />}>
      <Pressable onPress={async () => { const [u] = await pickAndUpload(); if (u) setF({ ...f, avatarUrl: u }); }} style={{ alignItems: 'center', marginBottom: 16 }}>
        <Avatar uri={f.avatarUrl} name={f.firstName} size={96} />
        <T color={colors.primary} style={{ fontWeight: '700', marginTop: 8 }}>{t('profile.changePhoto')}</T>
      </Pressable>
      <Row>
        <Field style={{ flex: 1 }} label={t('profile.firstName')} value={f.firstName} onChangeText={(v) => setF({ ...f, firstName: v })} />
        <Field style={{ flex: 1 }} label={t('profile.lastName')} value={f.lastName} onChangeText={(v) => setF({ ...f, lastName: v })} />
      </Row>
      <Pressable onPress={() => setDateOpen(true)}>
        <View pointerEvents="none"><Field label={t('profile.birthDate')} value={f.birthDate ? fmtDate(f.birthDate, true) : ''} placeholder={t('common.choose')} editable={false} /></View>
      </Pressable>
      <Field label={t('profile.city')} value={f.city} onChangeText={(v) => setF({ ...f, city: v })} />
      <Field label={t('profile.address')} value={f.address} onChangeText={(v) => setF({ ...f, address: v })} />
      <Field label={t('profile.bio')} multiline value={f.bio} onChangeText={(v) => setF({ ...f, bio: v })} placeholder={t('profile.bioPlaceholder')} />
      <Section title={t('profile.pro')}>
        <Toggle label={t('profile.isPro')} description={t('profile.isProHint')} value={f.isPro} onChange={(v) => setF({ ...f, isPro: v })} />
        {f.isPro ? <>
          <Field label={t('profile.companyName')} value={f.companyName} onChangeText={(v) => setF({ ...f, companyName: v })} />
          <Field label="ICE" value={f.companyIce} onChangeText={(v) => setF({ ...f, companyIce: v })} keyboardType="number-pad" />
        </> : null}
      </Section>
      {dateOpen ? <BirthPicker onClose={() => setDateOpen(false)} onPick={(d) => setF({ ...f, birthDate: d.toISOString() })} /> : null}
    </Screen>
  );
}

/** Saisie simple de la date de naissance (jour / mois / année). */
function BirthPicker({ onClose, onPick }: { onClose: () => void; onPick: (d: Date) => void }) {
  const { t } = useTranslation();
  const [d, setD] = useState({ day: '', month: '', year: '' });
  const date = new Date(Number(d.year), Number(d.month) - 1, Number(d.day), 12);
  const ok = d.year.length === 4 && !isNaN(date.getTime()) && date.getDate() === Number(d.day);
  return (
    <View style={{ marginTop: 10, padding: 14, borderRadius: 12, backgroundColor: colors.bgSoft }}>
      <Row>
        <Field style={{ flex: 1 }} label={t('dates.day')} keyboardType="number-pad" maxLength={2} value={d.day} onChangeText={(v) => setD({ ...d, day: v })} />
        <Field style={{ flex: 1 }} label={t('dates.month')} keyboardType="number-pad" maxLength={2} value={d.month} onChangeText={(v) => setD({ ...d, month: v })} />
        <Field style={{ flex: 1.4 }} label={t('dates.year')} keyboardType="number-pad" maxLength={4} value={d.year} onChangeText={(v) => setD({ ...d, year: v })} />
      </Row>
      <Row><Button small variant="ghost" title={t('common.cancel')} onPress={onClose} style={{ flex: 1 }} /><Button small title={t('common.confirm')} disabled={!ok} onPress={() => { onPick(date); onClose(); }} style={{ flex: 1 }} /></Row>
    </View>
  );
}
