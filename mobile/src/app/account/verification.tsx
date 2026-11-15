import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Card, Field, Notice, Row, Screen, Section, Segmented, T } from '../../components/ui';
import { pickAndUpload } from '../../components/PhotoPicker';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { apiErrorMessage } from '../../lib/format';

/** Vérification du profil : pièce d'identité, permis, selfie. */
export default function Verification() {
  const { t } = useTranslation();
  const { user, refresh } = useAuth();
  const [idType, setIdType] = useState<'CIN' | 'PASSPORT'>(user?.documents?.some((d) => d.type === 'PASSPORT') ? 'PASSPORT' : 'CIN');
  const [info, setInfo] = useState({
    cinNumber: user?.cinNumber || '', licenseNumber: user?.licenseNumber || '',
    licenseIssueDate: user?.licenseIssueDate ? String(user.licenseIssueDate).slice(0, 10) : '', birthDate: user?.birthDate ? String(user.birthDate).slice(0, 10) : '',
  });
  const [busy, setBusy] = useState(false);
  if (!user) return null;
  const docs = user.documents || [];
  const doc = (type: string) => docs.find((d) => d.type === type);
  const needed = [...(idType === 'CIN' ? ['ID_FRONT', 'ID_BACK'] : ['PASSPORT']), 'LICENSE_FRONT', 'LICENSE_BACK', 'SELFIE'];
  const status = user.verificationStatus;
  const dateOk = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

  const upload = async (type: string) => {
    try {
      const [url] = await pickAndUpload({ camera: type === 'SELFIE' });
      if (!url) return;
      await api('/users/me/documents', { body: { type, url } });
      await refresh();
    } catch (e) { Alert.alert(t('errors.title'), apiErrorMessage(e)); }
  };
  const submit = async () => {
    setBusy(true);
    try {
      await api('/users/me', { method: 'PATCH', body: { cinNumber: info.cinNumber || null, licenseNumber: info.licenseNumber, licenseIssueDate: info.licenseIssueDate, birthDate: info.birthDate } });
      await api('/users/me/verification', { body: {} });
      await refresh();
      Alert.alert(t('verification.submitted'), t('verification.pendingText'));
      router.back();
    } catch (e) { Alert.alert(t('errors.title'), apiErrorMessage(e)); } finally { setBusy(false); }
  };
  const complete = needed.every((n) => doc(n)) && info.licenseNumber && dateOk(info.licenseIssueDate) && dateOk(info.birthDate);

  return (
    <Screen footer={status === 'VERIFIED' ? undefined : <Button title={t('verification.submit')} disabled={!complete || status === 'PENDING'} loading={busy} onPress={submit} />}>
      {status === 'VERIFIED' ? <Notice tone="success" icon="checkmark-circle" text={t('verification.verifiedText')} /> : null}
      {status === 'PENDING' ? <Notice tone="warning" icon="time" text={t('verification.pendingText')} /> : null}
      {status === 'REJECTED' ? <Notice tone="danger" icon="close-circle" text={user.verificationNote || t('verification.rejectedText')} /> : null}
      {status === 'NONE' ? <Notice icon="shield-checkmark" text={t('verification.intro')} /> : null}

      <Section title={t('verification.identity')}>
        <Segmented value={idType} onChange={setIdType} options={[{ value: 'CIN', label: t('verification.cin') }, { value: 'PASSPORT', label: t('verification.passport') }]} />
        {idType === 'CIN' ? <Field style={{ marginTop: 12 }} label={t('verification.cinNumber')} value={info.cinNumber} onChangeText={(v) => setInfo({ ...info, cinNumber: v.toUpperCase() })} placeholder="BE123456" /> : <View style={{ height: 12 }} />}
        <Field label={t('profile.birthDate')} value={info.birthDate} onChangeText={(v) => setInfo({ ...info, birthDate: v })} placeholder="1995-04-23" hint={t('dates.isoHint')} />
      </Section>
      <Section title={t('verification.license')}>
        <Field label={t('verification.licenseNumber')} value={info.licenseNumber} onChangeText={(v) => setInfo({ ...info, licenseNumber: v })} />
        <Field label={t('verification.licenseDate')} value={info.licenseIssueDate} onChangeText={(v) => setInfo({ ...info, licenseIssueDate: v })} placeholder="2015-06-01" hint={t('dates.isoHint')} />
      </Section>
      <Section title={t('verification.documents')}>
        {needed.map((type) => {
          const d = doc(type);
          return (
            <Card key={type} style={{ marginBottom: 10 }}>
              <Row gap={12}>
                {d ? <Image source={{ uri: d.url }} style={{ width: 72, height: 52, borderRadius: 6 }} /> : null}
                <View style={{ flex: 1, gap: 4 }}>
                  <T style={{ fontWeight: '700' }}>{t(`verification.docs.${type}`)}</T>
                  {d ? <Badge label={t(`verification.status.${d.status}`)} tone={d.status === 'VERIFIED' ? 'success' : d.status === 'REJECTED' ? 'danger' : 'warning'} /> : null}
                </View>
                {status !== 'VERIFIED' ? <Button small variant="secondary" icon={type === 'SELFIE' ? 'camera' : 'cloud-upload-outline'} title={d ? t('common.replace') : t('common.upload')} onPress={() => upload(type)} /> : null}
              </Row>
            </Card>
          );
        })}
        <T variant="caption">{t('verification.privacy')}</T>
      </Section>
    </Screen>
  );
}
