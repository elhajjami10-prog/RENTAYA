import React, { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, View } from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Field, ListItem, Row, T } from './ui';
import { CITIES } from '../lib/search';
import { colors } from '../lib/theme';

export type Place = { city?: string; label: string; lat?: number; lng?: number };

export function CityPicker({ visible, onClose, onPick }: { visible: boolean; onClose: () => void; onPick: (p: Place) => void }) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const list = CITIES.filter((c) => norm(c.name).includes(norm(q)));
  const nearMe = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return Alert.alert(t('search.locationDenied'));
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      onPick({ label: t('search.nearMe'), lat: pos.coords.latitude, lng: pos.coords.longitude });
      onClose();
    } catch { Alert.alert(t('search.locationDenied')); }
  };
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
        <Row style={{ justifyContent: 'space-between', padding: 16 }}>
          <T variant="h2">{t('search.where')}</T>
          <Pressable onPress={onClose} hitSlop={10}><Ionicons name="close" size={26} color={colors.ink} /></Pressable>
        </Row>
        <View style={{ paddingHorizontal: 16 }}>
          <Field autoFocus placeholder={t('search.cityPlaceholder')} value={q} onChangeText={setQ} right={<Ionicons name="search" size={18} color={colors.muted} />} />
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16 }} keyboardShouldPersistTaps="handled">
          <ListItem icon="navigate" title={t('search.nearMe')} subtitle={t('search.nearMeHint')} onPress={nearMe} />
          {list.map((c) => (
            <ListItem key={c.name} icon="location-outline" title={c.name} onPress={() => { onPick({ city: c.name, label: c.name }); onClose(); }} />
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
