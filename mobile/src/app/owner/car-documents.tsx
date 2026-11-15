import React from 'react';
import { Alert, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Card, Loading, Notice, Row, Screen, T } from '../../components/ui';
import { pickAndUpload } from '../../components/PhotoPicker';
import { api } from '../../lib/api';
import { apiErrorMessage } from '../../lib/format';

const TYPES = ['CAR_REGISTRATION', 'CAR_INSURANCE', 'CAR_INSPECTION'] as const;

export default function CarDocuments() {
  const { id, created } = useLocalSearchParams<{ id: string; created?: string }>();
  const { t } = useTranslation();
  const q = useQuery({ queryKey: ['carDocs', id], queryFn: () => api(`/cars/${id}/documents`) });
  if (!q.data) return <Loading />;
  const upload = async (type: string) => {
    try {
      const [url] = await pickAndUpload({ camera: false });
      if (!url) return;
      await api(`/cars/${id}/documents`, { body: { type, url } });
      q.refetch();
    } catch (e) { Alert.alert(t('errors.title'), apiErrorMessage(e)); }
  };
  return (
    <Screen footer={created ? <Button title={t('common.finish')} onPress={() => router.replace('/garage')} /> : undefined}>
      {created ? <View style={{ marginBottom: 14 }}><Notice tone="success" icon="checkmark-circle" title={t('carForm.submitted')} text={t('carDocs.afterCreate')} /></View> : null}
      <T color="#6B5B86" style={{ marginBottom: 14 }}>{t('carDocs.intro')}</T>
      {TYPES.map((type) => {
        const doc = q.data.find((d: any) => d.type === type);
        return (
          <Card key={type} style={{ marginBottom: 12 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <T style={{ fontWeight: '700', flex: 1 }}>{t(`carDocs.${type}`)}</T>
              {doc ? <Badge label={t(`verification.status.${doc.status}`)} tone={doc.status === 'VERIFIED' ? 'success' : 'warning'} /> : <Badge label={t('carDocs.missing')} tone="muted" />}
            </Row>
            {doc ? <Image source={{ uri: doc.url }} style={{ width: '100%', height: 140, borderRadius: 8, marginTop: 10 }} contentFit="cover" /> : null}
            <Button small variant="secondary" icon="cloud-upload-outline" title={doc ? t('common.replace') : t('common.upload')} style={{ marginTop: 10 }} onPress={() => upload(type)} />
          </Card>
        );
      })}
    </Screen>
  );
}
