import React from 'react';
import { Alert, Linking, Platform, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { useTranslation } from 'react-i18next';
import { Avatar, Badge, Button, Card, Divider, KV, ListItem, Loading, Notice, Row, Screen, Section, Stars, T } from '../../../components/ui';
import { PriceBreakdown, StatusBadge } from '../../../components/booking-ui';
import { api, authedUrl } from '../../../lib/api';
import { apiErrorMessage, fmtDateTime, money } from '../../../lib/format';
import { colors, radius } from '../../../lib/theme';

function confirm(title: string, message: string, onOk: () => void, okLabel = 'OK') {
  if (Platform.OS === 'web') { if (window.confirm(`${title}\n\n${message}`)) onOk(); return; }
  Alert.alert(title, message, [{ text: '✕', style: 'cancel' }, { text: okLabel, style: 'destructive', onPress: onOk }]);
}
function promptText(title: string, cb: (v?: string) => void) {
  if (Platform.OS === 'web') return cb(window.prompt(title) || undefined);
  if (Platform.OS === 'ios') return Alert.prompt(title, undefined, (v) => cb(v));
  cb();
}

export default function BookingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const q = useQuery({ queryKey: ['booking', id], queryFn: () => api(`/bookings/${id}`), refetchInterval: 30_000 });
  if (!q.data) return <Loading />;
  const b = q.data;
  const isOwner = b.viewerRole === 'owner';
  const other = isOwner ? b.driver : b.owner;
  const now = Date.now();
  const start = new Date(b.startAt).getTime();
  const pendingExt = b.extensions.find((e: any) => e.status === 'PENDING');
  const acceptedExt = b.extensions.find((e: any) => e.status === 'ACCEPTED');
  const awaitingPayment = b.payments.find((p: any) => p.type === 'BOOKING' && p.status === 'AWAITING_VALIDATION');
  const checkIn = b.inspections.find((i: any) => i.type === 'CHECK_IN');
  const checkOut = b.inspections.find((i: any) => i.type === 'CHECK_OUT');
  const reviewed = isOwner ? b.ownerReviewed : b.driverReviewed;

  const run = async (fn: () => Promise<unknown>) => {
    try { await fn(); await q.refetch(); } catch (e) { Alert.alert(t('errors.title'), apiErrorMessage(e)); }
  };
  const cancel = async () => {
    const p = await api(`/bookings/${id}/cancel-preview`);
    const msg = isOwner && b.status === 'CONFIRMED'
      ? t('booking.cancelOwnerWarning', { amount: money(p.penalty) })
      : b.status === 'CONFIRMED' ? t('booking.cancelRefund', { amount: money(p.refund) }) : t('booking.cancelConfirm');
    confirm(t('booking.cancel'), msg, () => run(() => api(`/bookings/${id}/cancel`, { body: {} })), t('booking.cancel'));
  };
  const openDoc = (path: string) => (Platform.OS === 'web' ? window.open(authedUrl(path), '_blank') : WebBrowser.openBrowserAsync(authedUrl(path)));

  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      <Card onPress={() => router.push(`/car/${b.car.id}`)}>
        <Row gap={12}>
          <Image source={{ uri: b.car.photos?.[0]?.url }} style={{ width: 96, height: 72, borderRadius: radius.sm, backgroundColor: colors.primarySoft }} />
          <View style={{ flex: 1, gap: 4 }}>
            <T variant="h3">{b.car.make} {b.car.model}</T>
            <StatusBadge status={b.status} />
            <T variant="caption">{t('booking.ref')} {b.reference}</T>
          </View>
        </Row>
        <Divider />
        <KV k={t('booking.start')} v={fmtDateTime(b.startAt)} />
        <KV k={t('booking.end')} v={fmtDateTime(b.endAt)} />
        {b.deliveryAddress ? <KV k={t('price.delivery')} v={b.deliveryAddress} /> : null}
      </Card>

      {/* --- Bandeau d'état et actions principales --- */}
      <View style={{ marginTop: 14, gap: 10 }}>
        {b.status === 'REQUESTED' && !isOwner ? <Notice icon="hourglass-outline" title={t('booking.requestSent')} text={t('booking.requestSentText', { date: fmtDateTime(b.requestExpiresAt) })} /> : null}
        {b.status === 'REQUESTED' && isOwner ? (
          <Card>
            <T variant="h3">{t('booking.newRequest')}</T>
            {b.message ? <T style={{ marginTop: 8, fontStyle: 'italic' }}>« {b.message} »</T> : null}
            <T variant="caption" style={{ marginTop: 8 }}>{t('booking.answerBefore', { date: fmtDateTime(b.requestExpiresAt) })}</T>
            <Row style={{ marginTop: 12 }}>
              <Button title={t('booking.decline')} variant="outline" style={{ flex: 1 }} onPress={() => promptText(t('booking.declineReason'), (reason) => run(() => api(`/bookings/${id}/decline`, { body: { reason } })))} />
              <Button title={t('booking.accept')} icon="checkmark" style={{ flex: 1 }} onPress={() => run(() => api(`/bookings/${id}/accept`, { body: {} }))} />
            </Row>
          </Card>
        ) : null}
        {b.status === 'PENDING_PAYMENT' && !isOwner ? (
          awaitingPayment
            ? <Notice icon="time" tone="warning" title={t('payment.awaitingValidation')} text={t('payment.awaitingValidationText')} />
            : <Notice tone="warning" icon="card" title={t('booking.payNow')} text={t('booking.payBefore', { date: fmtDateTime(b.paymentDueAt) })} action={t('payment.pay', { amount: money(b.totalPrice) })} onAction={() => router.push(`/booking/${id}/pay`)} />
        ) : null}
        {b.status === 'PENDING_PAYMENT' && isOwner ? <Notice icon="time" text={t('booking.waitingDriverPayment')} /> : null}
        {b.status === 'CONFIRMED' ? (
          <Notice tone="success" icon="checkmark-circle" title={t('booking.confirmedTitle')} text={isOwner ? t('booking.confirmedOwner') : t('booking.confirmedDriver')} />
        ) : null}
        {b.status === 'CONFIRMED' && now >= start - 2 * 3600_000 ? (
          <Button title={t('inspection.startCheckIn')} icon="clipboard-outline" onPress={() => router.push({ pathname: '/booking/[id]/inspection', params: { id, type: 'CHECK_IN' } })} />
        ) : null}
        {b.status === 'CONFIRMED' && now < start - 2 * 3600_000 ? <T variant="caption" center>{t('inspection.availableFrom', { date: fmtDateTime(new Date(start - 2 * 3600_000)) })}</T> : null}
        {b.status === 'IN_PROGRESS' ? (
          <>
            <Notice icon="car-sport" title={t('booking.inProgress')} text={t('booking.returnBy', { date: fmtDateTime(b.endAt) })} />
            <Button title={t('inspection.startCheckOut')} icon="flag-outline" onPress={() => router.push({ pathname: '/booking/[id]/inspection', params: { id, type: 'CHECK_OUT' } })} />
          </>
        ) : null}
        {b.status === 'COMPLETED' && !reviewed ? <Button title={t('review.leave')} icon="star" onPress={() => router.push(`/booking/${id}/review`)} /> : null}

        {/* Prolongations */}
        {pendingExt && isOwner ? (
          <Card>
            <T variant="h3">{t('extend.requestTitle')}</T>
            <T style={{ marginTop: 6 }}>{t('extend.requestText', { date: fmtDateTime(pendingExt.newEndAt), amount: money(pendingExt.extraPrice) })}</T>
            <Row style={{ marginTop: 12 }}>
              <Button title={t('booking.decline')} variant="outline" style={{ flex: 1 }} onPress={() => run(() => api(`/bookings/${id}/extensions/${pendingExt.id}/decline`, { body: {} }))} />
              <Button title={t('booking.accept')} style={{ flex: 1 }} onPress={() => run(() => api(`/bookings/${id}/extensions/${pendingExt.id}/accept`, { body: {} }))} />
            </Row>
          </Card>
        ) : null}
        {pendingExt && !isOwner ? <Notice icon="hourglass-outline" text={t('extend.pending', { date: fmtDateTime(pendingExt.newEndAt) })} /> : null}
        {acceptedExt && !isOwner ? <Notice tone="success" icon="checkmark" text={t('extend.accepted')} action={t('payment.pay', { amount: money(acceptedExt.extraPrice) })} onAction={() => router.push({ pathname: '/booking/[id]/pay', params: { id, extensionId: acceptedExt.id, amount: acceptedExt.extraPrice } })} /> : null}
      </View>

      {/* --- Interlocuteur --- */}
      <Section title={isOwner ? t('booking.driver') : t('booking.owner')}>
        <Card>
          <Row gap={12}>
            <Avatar uri={other.avatarUrl} name={other.firstName} size={52} />
            <View style={{ flex: 1 }}>
              <Row gap={6}><T variant="h3">{other.firstName} {other.lastName}</T>{other.verified ? <Badge label={t('profile.verified')} tone="success" icon="checkmark-circle" /> : null}</Row>
              <Stars value={other.ratingAvg} count={other.ratingCount} />
            </View>
          </Row>
          <Row style={{ marginTop: 12 }}>
            <Button title={t('tabs.messages')} icon="chatbubbles-outline" variant="secondary" small style={{ flex: 1 }} onPress={() => router.push(`/chat/${b.conversation?.id}`)} />
            {other.phone ? <Button title={t('booking.call')} icon="call-outline" variant="secondary" small style={{ flex: 1 }} onPress={() => Linking.openURL(`tel:${other.phone}`)} /> : null}
            <Button title={t('profile.public')} variant="ghost" small onPress={() => router.push(`/user/${other.id}`)} />
          </Row>
        </Card>
      </Section>

      {['CONFIRMED', 'IN_PROGRESS'].includes(b.status) && b.car.address ? (
        <Section title={t('booking.meetingPoint')}>
          <Card>
            <T style={{ fontWeight: '700' }}>{b.deliveryAddress || b.car.address}, {b.car.city}</T>
            {b.car.pickupInstructions ? <T variant="small" color={colors.inkSoft} style={{ marginTop: 6 }}>{b.car.pickupInstructions}</T> : null}
            {b.car.plate && !isOwner ? <KV k={t('carForm.plate')} v={b.car.plate} /> : null}
            <Button title={t('booking.directions')} icon="navigate" variant="ghost" small onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${b.car.latitude},${b.car.longitude}`)} />
          </Card>
        </Section>
      ) : null}

      {/* --- Prix --- */}
      <Section title={t('checkout.summary')}>
        <Card>
          <PriceBreakdown q={b} owner={isOwner} />
          {b.insurancePlan ? <T variant="caption" style={{ marginTop: 8 }}>{t('checkout.insurance')} : {b.insurancePlan.nameFr} — {t('checkout.franchise', { amount: money(b.insurancePlan.franchise) })}</T> : null}
          {!b.unlimitedKm ? <T variant="caption">{t('booking.kmIncluded', { km: b.kmIncluded, price: b.extraKmPrice })}</T> : <T variant="caption">{t('car.unlimitedKm')}</T>}
          {b.refundAmount ? <KV k={t('booking.refund')} v={money(b.refundAmount)} color={colors.success} /> : null}
        </Card>
      </Section>

      {/* --- États des lieux --- */}
      {checkIn || checkOut ? (
        <Section title={t('inspection.title')}>
          {[checkIn, checkOut].filter(Boolean).map((i: any) => (
            <Card key={i.id} style={{ marginBottom: 10 }}>
              <T style={{ fontWeight: '700' }}>{t(`inspection.${i.type}`)} — {fmtDateTime(i.createdAt)}</T>
              <KV k={t('inspection.odometer')} v={`${i.odometerKm} km`} />
              <KV k={t('inspection.fuel')} v={`${i.fuelLevel}/8`} />
              <Row gap={6} style={{ flexWrap: 'wrap', marginTop: 6 }}>
                {i.photos.slice(0, 8).map((u: string) => <Image key={u} source={{ uri: u }} style={{ width: 64, height: 48, borderRadius: 6 }} />)}
              </Row>
              {(i.damages as any[]).length ? <T variant="small" style={{ marginTop: 6 }}>{t('inspection.damages')}: {(i.damages as any[]).map((d) => `${d.zone} (${d.description})`).join(', ')}</T> : null}
            </Card>
          ))}
        </Section>
      ) : null}

      {/* --- Frais supplémentaires --- */}
      {b.charges.length ? (
        <Section title={t('charges.title')}>
          {b.charges.map((c: any) => (
            <Card key={c.id} style={{ marginBottom: 10 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <T style={{ fontWeight: '700', flex: 1 }}>{t(`enums.chargeType.${c.type}`)}</T>
                <T style={{ fontWeight: '800' }}>{money(c.amount)}</T>
              </Row>
              <T variant="small" color={colors.inkSoft}>{c.description}</T>
              <View style={{ marginTop: 6 }}><Badge label={t(`enums.chargeStatus.${c.status}`)} tone={c.status === 'PAID' ? 'success' : c.status === 'CONTESTED' ? 'danger' : 'warning'} /></View>
              {!isOwner && c.status === 'PENDING' ? (
                <Row style={{ marginTop: 10 }}>
                  <Button title={t('charges.contest')} variant="outline" small style={{ flex: 1 }} onPress={() => promptText(t('charges.contestReason'), (response) => run(() => api(`/bookings/${id}/charges/${c.id}/respond`, { body: { accept: false, response } })))} />
                  <Button title={t('charges.accept')} small style={{ flex: 1 }} onPress={() => run(() => api(`/bookings/${id}/charges/${c.id}/respond`, { body: { accept: true } }))} />
                </Row>
              ) : null}
              {!isOwner && c.status === 'ACCEPTED' ? <Button title={t('payment.pay', { amount: money(c.amount) })} small style={{ marginTop: 10 }} onPress={() => router.push({ pathname: '/booking/[id]/pay', params: { id, chargeId: c.id, amount: c.amount } })} /> : null}
            </Card>
          ))}
        </Section>
      ) : null}

      {/* --- Autres actions --- */}
      <Section title={t('booking.actions')}>
        <Card style={{ paddingVertical: 4 }}>
          {['CONFIRMED', 'IN_PROGRESS'].includes(b.status) && !isOwner ? <ListItem icon="time-outline" title={t('extend.title')} onPress={() => router.push(`/booking/${id}/extend`)} /> : null}
          {['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].includes(b.status) ? <ListItem icon="document-text-outline" title={t('booking.contract')} onPress={() => openDoc(`/bookings/${id}/contract`)} /> : null}
          {['CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED_BY_DRIVER', 'CANCELLED_BY_OWNER'].includes(b.status) ? <ListItem icon="receipt-outline" title={isOwner ? t('booking.statement') : t('booking.invoice')} onPress={() => openDoc(`/bookings/${id}/invoice`)} /> : null}
          {isOwner && ['IN_PROGRESS', 'COMPLETED'].includes(b.status) ? <ListItem icon="add-circle-outline" title={t('charges.add')} subtitle={t('charges.addHint')} onPress={() => router.push(`/booking/${id}/charge`)} /> : null}
          {['IN_PROGRESS', 'COMPLETED'].includes(b.status) ? <ListItem icon="warning-outline" title={t('claim.title')} subtitle={t('claim.hint')} onPress={() => router.push(`/booking/${id}/claim`)} /> : null}
          {b.status === 'IN_PROGRESS' ? <ListItem icon="call-outline" title={t('booking.assistance')} subtitle={t('booking.assistanceHint')} onPress={async () => { const c = await api('/public/config'); Linking.openURL(`tel:${c.supportPhone.replace(/\s/g, '')}`); }} /> : null}
          <ListItem icon="help-buoy-outline" title={t('support.title')} onPress={() => router.push({ pathname: '/account/support', params: { bookingId: id } })} />
          {['REQUESTED', 'PENDING_PAYMENT', 'CONFIRMED'].includes(b.status) ? <ListItem icon="close-circle-outline" danger title={b.status === 'REQUESTED' && !isOwner ? t('booking.cancelRequest') : t('booking.cancel')} onPress={cancel} /> : null}
        </Card>
      </Section>
      {b.claims.length ? (
        <Section title={t('claim.list')}>
          {b.claims.map((c: any) => <Notice key={c.id} icon="warning" tone="warning" title={t(`enums.claimStatus.${c.status}`)} text={c.resolution || c.description} />)}
        </Section>
      ) : null}
    </Screen>
  );
}
