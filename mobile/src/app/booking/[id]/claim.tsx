import React, { useState } from 'react';
import { Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, Field, Notice, Screen, Section } from '../../../components/ui';
import { PhotoPicker } from '../../../components/PhotoPicker';
import { api } from '../../../lib/api';
import { apiErrorMessage } from '../../../lib/format';

export default function Claim() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const [description, setDescription] = useState('');
  const [estimate, setEstimate] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await api(`/bookings/${id}/claims`, { body: { description, photos, estimate: estimate ? Number(estimate) : undefined } });
      Alert.alert(t('claim.sent'), t('claim.sentText'));
      router.back();
    } catch (e) { Alert.alert(t('errors.title'), apiErrorMessage(e)); }
    finally { setBusy(false); }
  };
  return (
    <Screen footer={<Button title={t('claim.submit')} disabled={description.trim().length < 10} loading={busy} onPress={submit} />}>
      <Notice tone="warning" icon="warning" text={t('claim.intro')} />
      <Section title={t('claim.what')}>
        <Field multiline value={description} onChangeText={setDescription} placeholder={t('claim.placeholder')} />
        <Field label={t('claim.estimate')} keyboardType="numeric" value={estimate} onChangeText={setEstimate} />
      </Section>
      <Section title={t('claim.photos')}><PhotoPicker value={photos} onChange={setPhotos} camera /></Section>
    </Screen>
  );
}
