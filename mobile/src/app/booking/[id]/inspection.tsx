import React, { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Button, Card, Field, Notice, Row, Screen, Section, Segmented, T } from '../../../components/ui';
import { PhotoPicker } from '../../../components/PhotoPicker';
import { SignaturePad } from '../../../components/SignaturePad';
import { api } from '../../../lib/api';
import { apiErrorMessage } from '../../../lib/format';
import { colors, radius } from '../../../lib/theme';

const ZONES = ['FRONT', 'REAR', 'LEFT', 'RIGHT', 'ROOF', 'WINDSHIELD', 'WHEELS', 'INTERIOR'];

/** État des lieux de départ / retour — à remplir ensemble, sur un seul téléphone. */
export default function Inspection() {
  const { id, type } = useLocalSearchParams<{ id: string; type: 'CHECK_IN' | 'CHECK_OUT' }>();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [photos, setPhotos] = useState<string[]>([]);
  const [odometer, setOdometer] = useState('');
  const [fuel, setFuel] = useState(8);
  const [clean, setClean] = useState('4');
  const [damages, setDamages] = useState<{ zone: string; description: string }[]>([]);
  const [zone, setZone] = useState(ZONES[0]);
  const [desc, setDesc] = useState('');
  const [notes, setNotes] = useState('');
  const [sigDriver, setSigDriver] = useState<string | null>(null);
  const [sigOwner, setSigOwner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const steps = [t('inspection.stepPhotos'), t('inspection.stepReadings'), t('inspection.stepDamages'), t('inspection.stepSign')];
  const canNext = [photos.length >= 4, !!odometer, true, !!sigDriver && !!sigOwner][step];

  const submit = async () => {
    setBusy(true);
    try {
      await api(`/bookings/${id}/inspections`, { body: {
        type, photos, odometerKm: Number(odometer), fuelLevel: fuel, cleanliness: Number(clean), damages, notes: notes || undefined,
        driverSignature: sigDriver, ownerSignature: sigOwner,
      } });
      await qc.invalidateQueries({ queryKey: ['booking', id] });
      Alert.alert(t('inspection.done'), type === 'CHECK_IN' ? t('inspection.doneIn') : t('inspection.doneOut'));
      router.back();
    } catch (e) { Alert.alert(t('errors.title'), apiErrorMessage(e)); }
    finally { setBusy(false); }
  };

  return (
    <Screen footer={
      <Row>
        {step > 0 ? <Button title={t('common.back')} variant="ghost" onPress={() => setStep(step - 1)} style={{ flex: 1 }} /> : null}
        {step < 3 ? <Button title={t('common.next')} disabled={!canNext} onPress={() => setStep(step + 1)} style={{ flex: 2 }} />
          : <Button title={t('inspection.submit')} icon="checkmark-done" disabled={!canNext} loading={busy} onPress={submit} style={{ flex: 2 }} />}
      </Row>
    }>
      <T variant="h2">{t(`inspection.${type}`)}</T>
      <Row gap={6} style={{ marginVertical: 12 }}>
        {steps.map((s, i) => <View key={s} style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: i <= step ? colors.primary : colors.border }} />)}
      </Row>
      <T variant="label">{t('common.step', { n: step + 1, total: 4 })} — {steps[step]}</T>

      {step === 0 ? (
        <View style={{ marginTop: 12, gap: 12 }}>
          <Notice icon="camera" text={t('inspection.photosHint')} />
          <PhotoPicker value={photos} onChange={setPhotos} min={4} max={30} camera />
        </View>
      ) : null}

      {step === 1 ? (
        <View style={{ marginTop: 12 }}>
          <Field label={t('inspection.odometer')} keyboardType="numeric" value={odometer} onChangeText={setOdometer} placeholder="52 340" right={<T variant="caption">km</T>} />
          <T variant="label" style={{ marginBottom: 8 }}>{t('inspection.fuel')} : {fuel}/8</T>
          <Row gap={4}>
            {Array.from({ length: 9 }, (_, i) => (
              <Pressable key={i} onPress={() => setFuel(i)} style={{ flex: 1, height: 38, borderRadius: 6, backgroundColor: i <= fuel && i > 0 ? colors.primary : colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                <T variant="caption" color={i <= fuel && i > 0 ? '#fff' : colors.inkSoft}>{i}</T>
              </Pressable>
            ))}
          </Row>
          <Row style={{ justifyContent: 'space-between', marginTop: 4 }}><T variant="caption">E</T><Ionicons name="water" size={14} color={colors.primary} /><T variant="caption">F</T></Row>
          <Section title={t('inspection.cleanliness')}>
            <Segmented value={clean} onChange={setClean} options={['1', '2', '3', '4', '5'].map((v) => ({ value: v, label: '★'.repeat(Number(v)) }))} />
          </Section>
        </View>
      ) : null}

      {step === 2 ? (
        <View style={{ marginTop: 12 }}>
          <T variant="small" color={colors.inkSoft}>{t('inspection.damagesHint')}</T>
          <Row gap={6} style={{ flexWrap: 'wrap', marginVertical: 10 }}>
            {ZONES.map((z) => (
              <Pressable key={z} onPress={() => setZone(z)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: zone === z ? colors.primary : colors.primarySoft }}>
                <T variant="small" color={zone === z ? '#fff' : colors.primaryDark}>{t(`inspection.zones.${z}`)}</T>
              </Pressable>
            ))}
          </Row>
          <Row>
            <Field style={{ flex: 1, marginBottom: 0 }} placeholder={t('inspection.damagePlaceholder')} value={desc} onChangeText={setDesc} />
            <Button title={t('common.add')} variant="secondary" onPress={() => { if (desc.trim()) { setDamages([...damages, { zone: t(`inspection.zones.${zone}`), description: desc.trim() }]); setDesc(''); } }} />
          </Row>
          <View style={{ marginTop: 12, gap: 8 }}>
            {damages.map((d, i) => (
              <Card key={i} style={{ flexDirection: 'row', alignItems: 'center', padding: 12 }}>
                <T style={{ flex: 1 }}><T style={{ fontWeight: '700' }}>{d.zone}</T> — {d.description}</T>
                <Pressable onPress={() => setDamages(damages.filter((_, j) => j !== i))}><Ionicons name="trash-outline" size={20} color={colors.danger} /></Pressable>
              </Card>
            ))}
            {!damages.length ? <T variant="caption">{t('inspection.noDamage')}</T> : null}
          </View>
          <Field label={t('inspection.notes')} multiline value={notes} onChangeText={setNotes} style={{ marginTop: 14 }} />
        </View>
      ) : null}

      {step === 3 ? (
        <View style={{ marginTop: 12 }}>
          <Card style={{ marginBottom: 14 }}>
            <T variant="small">{t('inspection.summary', { photos: photos.length, km: odometer, fuel, damages: damages.length })}</T>
          </Card>
          <Notice icon="create" text={t('inspection.signHint')} />
          <View style={{ height: 12 }} />
          <SignaturePad label={t('inspection.driverSignature')} onChange={setSigDriver} />
          <SignaturePad label={t('inspection.ownerSignature')} onChange={setSigOwner} />
        </View>
      ) : null}
    </Screen>
  );
}
