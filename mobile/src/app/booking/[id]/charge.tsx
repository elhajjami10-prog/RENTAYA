import React, { useState } from 'react';
import { Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, Chip, Field, Notice, Row, Screen, Section } from '../../../components/ui';
import { PhotoPicker } from '../../../components/PhotoPicker';
import { api } from '../../../lib/api';
import { apiErrorMessage } from '../../../lib/format';

const TYPES = ['FINE', 'TOLL', 'FUEL', 'EXTRA_KM', 'LATE_RETURN', 'CLEANING', 'DAMAGE', 'OTHER'];

/** Le propriétaire déclare des frais (amende, péage, carburant…). */
export default function AddCharge() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const [type, setType] = useState('FINE');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [proof, setProof] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await api(`/bookings/${id}/charges`, { body: { type, amount: Number(amount), description, proofUrls: proof } });
      router.back();
    } catch (e) { Alert.alert(t('errors.title'), apiErrorMessage(e)); }
    finally { setBusy(false); }
  };
  return (
    <Screen footer={<Button title={t('charges.submit')} disabled={!Number(amount) || description.length < 3} loading={busy} onPress={submit} />}>
      <Notice icon="information-circle" text={t('charges.intro')} />
      <Section title={t('charges.type')}>
        <Row gap={8} style={{ flexWrap: 'wrap' }}>{TYPES.map((x) => <Chip key={x} label={t(`enums.chargeType.${x}`)} selected={type === x} onPress={() => setType(x)} />)}</Row>
      </Section>
      <Section title={t('charges.details')}>
        <Field label={t('charges.amount')} keyboardType="numeric" value={amount} onChangeText={setAmount} />
        <Field label={t('charges.description')} multiline value={description} onChangeText={setDescription} />
      </Section>
      <Section title={t('charges.proof')}><PhotoPicker value={proof} onChange={setProof} max={10} camera /></Section>
    </Screen>
  );
}
