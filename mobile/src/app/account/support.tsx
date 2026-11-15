import React, { useState } from 'react';
import { Alert, Linking, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Card, Field, ListItem, Row, Screen, Section, T } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { apiErrorMessage, fmtDate } from '../../lib/format';
import { colors } from '../../lib/theme';

export default function Support() {
  const { bookingId } = useLocalSearchParams<{ bookingId?: string }>();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const config = useQuery({ queryKey: ['config'], queryFn: () => api('/public/config') });
  const tickets = useQuery({ queryKey: ['tickets'], queryFn: () => api('/account/tickets'), enabled: !!user });
  const send = async () => {
    setBusy(true);
    try { await api('/account/tickets', { body: { subject, body, bookingId } }); setSubject(''); setBody(''); tickets.refetch(); Alert.alert(t('support.sent')); }
    catch (e) { Alert.alert(t('errors.title'), apiErrorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <Screen>
      <Card style={{ paddingVertical: 4 }}>
        <ListItem icon="call" title={t('support.call')} subtitle={config.data?.supportPhone} onPress={() => Linking.openURL(`tel:${config.data?.supportPhone?.replace(/\s/g, '')}`)} />
        <ListItem icon="logo-whatsapp" title="WhatsApp" subtitle={config.data?.supportPhone} onPress={() => Linking.openURL(`https://wa.me/${config.data?.supportPhone?.replace(/[^0-9]/g, '')}`)} />
        <ListItem icon="mail" title={t('support.email')} subtitle={config.data?.supportEmail} onPress={() => Linking.openURL(`mailto:${config.data?.supportEmail}`)} />
      </Card>
      {user ? <>
        <Section title={t('support.write')}>
          <Field label={t('support.subject')} value={subject} onChangeText={setSubject} />
          <Field label={t('support.message')} multiline value={body} onChangeText={setBody} />
          <Button title={t('support.send')} loading={busy} disabled={subject.length < 3 || body.length < 10} onPress={send} />
        </Section>
        {tickets.data?.length ? (
          <Section title={t('support.tickets')}>
            {tickets.data.map((x: any) => (
              <Card key={x.id} style={{ marginBottom: 8 }}>
                <Row style={{ justifyContent: 'space-between' }}><T style={{ fontWeight: '700', flex: 1 }}>{x.subject}</T><Badge label={t(`enums.ticketStatus.${x.status}`)} tone={x.status === 'CLOSED' ? 'muted' : 'warning'} /></Row>
                <T variant="caption">{fmtDate(x.createdAt, true)}</T>
                {x.reply ? <View style={{ marginTop: 8, padding: 10, backgroundColor: colors.bgSoft, borderRadius: 8 }}><T variant="small">{x.reply}</T></View> : null}
              </Card>
            ))}
          </Section>
        ) : null}
      </> : null}
    </Screen>
  );
}
