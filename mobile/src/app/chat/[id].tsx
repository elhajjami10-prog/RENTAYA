import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Loading, Notice, Row, T } from '../../components/ui';
import { StatusBadge } from '../../components/booking-ui';
import { pickAndUpload } from '../../components/PhotoPicker';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { fmtTime, fmtDate } from '../../lib/format';
import { colors, radius } from '../../lib/theme';

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const nav = useNavigation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const list = useRef<FlatList>(null);
  const q = useQuery({ queryKey: ['chat', id], queryFn: () => api(`/conversations/${id}`), refetchInterval: 5000 });
  useLayoutEffect(() => { if (q.data) nav.setOptions({ title: `${q.data.other.firstName} ${q.data.other.lastName}` }); }, [q.data, nav]);
  useEffect(() => { qc.invalidateQueries({ queryKey: ['unread'] }); }, [q.data?.messages.length, qc]);

  const send = async (body: string, imageUrl?: string) => {
    if (!body.trim() && !imageUrl) return;
    setSending(true);
    try { await api(`/conversations/${id}`, { body: { body, imageUrl } }); setText(''); await q.refetch(); }
    finally { setSending(false); }
  };
  const sendPhoto = async () => { const [u] = await pickAndUpload(); if (u) send('', u); };

  if (!q.data) return <Loading />;
  const c = q.data;
  const confirmed = c.booking && ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].includes(c.booking.status);
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#fff' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      {c.car ? (
        <Pressable onPress={() => router.push(c.booking ? `/booking/${c.booking.id}` : `/car/${c.car.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          {c.car.photo ? <Image source={{ uri: c.car.photo }} style={{ width: 52, height: 38, borderRadius: 6 }} /> : null}
          <View style={{ flex: 1 }}>
            <T style={{ fontWeight: '700' }}>{c.car.make} {c.car.model}</T>
            {c.booking ? <T variant="caption">{fmtDate(c.booking.startAt)} → {fmtDate(c.booking.endAt)}</T> : null}
          </View>
          {c.booking ? <StatusBadge status={c.booking.status} /> : null}
        </Pressable>
      ) : null}
      <FlatList
        ref={list}
        data={c.messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 12, gap: 6, maxWidth: 820, width: '100%', alignSelf: 'center' }}
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
        ListHeaderComponent={!confirmed ? <View style={{ marginBottom: 10 }}><Notice icon="lock-closed" text={t('messages.safety')} /></View> : null}
        renderItem={({ item: m }) => {
          if (m.system) return <T variant="caption" center style={{ marginVertical: 8, paddingHorizontal: 20 }}>{m.body}</T>;
          const mine = m.senderId === user?.id;
          return (
            <View style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
              <View style={{ backgroundColor: mine ? colors.primary : colors.bgSoft, borderRadius: radius.lg, borderBottomRightRadius: mine ? 4 : radius.lg, borderBottomLeftRadius: mine ? radius.lg : 4, padding: m.imageUrl ? 4 : 12 }}>
                {m.imageUrl ? <Image source={{ uri: m.imageUrl }} style={{ width: 220, height: 160, borderRadius: radius.md }} /> : null}
                {m.body ? <T color={mine ? '#fff' : colors.ink} style={m.imageUrl ? { padding: 8 } : undefined}>{m.body}</T> : null}
              </View>
              <T variant="caption" style={{ alignSelf: mine ? 'flex-end' : 'flex-start', marginTop: 2 }}>{fmtTime(m.createdAt)}{mine && m.readAt ? ' · ✓✓' : ''}</T>
            </View>
          );
        }}
      />
      <SafeAreaView edges={['bottom']} style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
        <Row style={{ padding: 10, maxWidth: 820, width: '100%', alignSelf: 'center' }}>
          <Pressable onPress={sendPhoto} hitSlop={8}><Ionicons name="image-outline" size={26} color={colors.primary} /></Pressable>
          <TextInput
            value={text} onChangeText={setText} placeholder={t('messages.placeholder')} placeholderTextColor={colors.muted} multiline
            style={{ flex: 1, maxHeight: 110, minHeight: 42, borderRadius: 21, backgroundColor: colors.bgSoft, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11, fontSize: 15, color: colors.ink }}
            onSubmitEditing={() => send(text)}
          />
          <Pressable disabled={sending || !text.trim()} onPress={() => send(text)} style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: text.trim() ? colors.primary : colors.border, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="send" size={18} color="#fff" />
          </Pressable>
        </Row>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
