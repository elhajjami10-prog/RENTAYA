import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button, Field, Loading, Row, Screen, StarInput, T } from '../../../components/ui';
import { api } from '../../../lib/api';
import { apiErrorMessage } from '../../../lib/format';

export default function Review() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const b = useQuery({ queryKey: ['booking', id], queryFn: () => api(`/bookings/${id}`) });
  const [rating, setRating] = useState(5);
  const [sub, setSub] = useState<Record<string, number>>({});
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  if (!b.data) return <Loading />;
  const isOwner = b.data.viewerRole === 'owner';
  const criteria = isOwner ? ['punctuality', 'cleanliness', 'communication'] : ['cleanliness', 'accuracy', 'communication'];
  const name = isOwner ? b.data.driver.firstName : b.data.owner.firstName;

  const submit = async () => {
    setBusy(true);
    try {
      await api(`/bookings/${id}/review`, { body: { rating, ...sub, comment: comment.trim() || undefined } });
      await qc.invalidateQueries({ queryKey: ['booking', id] });
      Alert.alert(t('review.thanks'));
      router.back();
    } catch (e) { Alert.alert(t('errors.title'), apiErrorMessage(e)); }
    finally { setBusy(false); }
  };

  return (
    <Screen footer={<Button title={t('review.publish')} loading={busy} onPress={submit} />}>
      <T variant="h2">{t('review.howWasIt', { name })}</T>
      <View style={{ alignItems: 'center', marginVertical: 20 }}><StarInput value={rating} onChange={setRating} size={42} /></View>
      {criteria.map((c) => (
        <Row key={c} style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <T style={{ fontWeight: '600' }}>{t(`review.criteria.${c}`)}</T>
          <StarInput value={sub[c] || 0} onChange={(v) => setSub({ ...sub, [c]: v })} size={24} />
        </Row>
      ))}
      <Field label={t('review.comment')} multiline value={comment} onChangeText={setComment} placeholder={t('review.commentPlaceholder')} />
      <T variant="caption">{t('review.public')}</T>
    </Screen>
  );
}
