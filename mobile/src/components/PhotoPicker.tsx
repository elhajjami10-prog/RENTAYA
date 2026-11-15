import React, { useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { uploadFiles } from '../lib/api';
import { colors, radius } from '../lib/theme';
import { T } from './ui';

/** Sélection + envoi de photos (galerie ou appareil photo). */
export async function pickAndUpload(opts: { multiple?: boolean; camera?: boolean } = {}): Promise<string[]> {
  const perm = opts.camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted && Platform.OS !== 'web') { Alert.alert('Permission', 'Autorisez l\'accès dans les réglages.'); return []; }
  const res = opts.camera && Platform.OS !== 'web'
    ? await ImagePicker.launchCameraAsync({ quality: 0.6, mediaTypes: ['images'] })
    : await ImagePicker.launchImageLibraryAsync({ quality: 0.6, mediaTypes: ['images'], allowsMultipleSelection: !!opts.multiple, selectionLimit: opts.multiple ? 20 : 1 });
  if (res.canceled) return [];
  return uploadFiles(res.assets.map((a) => ({ uri: a.uri, mimeType: a.mimeType, fileName: a.fileName })));
}

export function PhotoPicker({ value, onChange, min = 0, max = 20, camera }: { value: string[]; onChange: (urls: string[]) => void; min?: number; max?: number; camera?: boolean }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const add = async (useCamera: boolean) => {
    setBusy(true);
    try { const urls = await pickAndUpload({ multiple: !useCamera, camera: useCamera }); onChange([...value, ...urls].slice(0, max)); }
    catch { Alert.alert(t('errors.title'), t('errors.UPLOAD_FAILED')); }
    finally { setBusy(false); }
  };
  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 4 }}>
        {value.map((u, i) => (
          <View key={u + i}>
            <Image source={{ uri: u }} style={s.thumb} contentFit="cover" />
            {i === 0 ? <View style={s.cover}><T variant="caption" color="#fff">{t('photos.cover')}</T></View> : null}
            <Pressable style={s.remove} onPress={() => onChange(value.filter((_, j) => j !== i))}><Ionicons name="close" size={14} color="#fff" /></Pressable>
          </View>
        ))}
        {value.length < max ? (
          <>
            {camera && Platform.OS !== 'web' ? (
              <Pressable style={s.add} onPress={() => add(true)} disabled={busy}>
                <Ionicons name="camera" size={26} color={colors.primary} /><T variant="caption" color={colors.primary}>{t('photos.camera')}</T>
              </Pressable>
            ) : null}
            <Pressable style={s.add} onPress={() => add(false)} disabled={busy}>
              {busy ? <ActivityIndicator color={colors.primary} /> : <><Ionicons name="images" size={26} color={colors.primary} /><T variant="caption" color={colors.primary}>{t('photos.add')}</T></>}
            </Pressable>
          </>
        ) : null}
      </ScrollView>
      {min ? <T variant="caption" style={{ marginTop: 4 }} color={value.length < min ? colors.warning : colors.success}>{t('photos.count', { count: value.length, min })}</T> : null}
    </View>
  );
}

const s = StyleSheet.create({
  thumb: { width: 104, height: 104, borderRadius: radius.md, backgroundColor: colors.primarySoft },
  add: { width: 104, height: 104, borderRadius: radius.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: colors.bgSoft },
  remove: { position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  cover: { position: 'absolute', bottom: 6, left: 6, backgroundColor: 'rgba(75,12,153,0.85)', paddingHorizontal: 6, borderRadius: 6 },
});
