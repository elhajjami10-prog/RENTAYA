import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Stockage sécurisé du jeton (Keychain / Keystore sur mobile, localStorage sur le web). */
export const secure = {
  async get(key: string) {
    if (Platform.OS === 'web') { try { return localStorage.getItem(key); } catch { return null; } }
    return SecureStore.getItemAsync(key);
  },
  async set(key: string, value: string | null) {
    if (Platform.OS === 'web') {
      try { value == null ? localStorage.removeItem(key) : localStorage.setItem(key, value); } catch { /* navigation privée */ }
      return;
    }
    if (value == null) await SecureStore.deleteItemAsync(key);
    else await SecureStore.setItemAsync(key, value);
  },
};

export const prefs = {
  get: (k: string) => AsyncStorage.getItem(k).catch(() => null),
  set: (k: string, v: string) => AsyncStorage.setItem(k, v).catch(() => {}),
};
