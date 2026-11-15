import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { api, loadToken, setApiToken, TOKEN_KEY } from './api';
import { secure } from './storage';
import i18n, { setLanguage, type Lang } from './i18n';

export type Me = Record<string, any> & {
  id: string; email: string; firstName: string; lastName: string; role: 'USER' | 'ADMIN';
  verificationStatus: 'NONE' | 'PENDING' | 'VERIFIED' | 'REJECTED'; phoneVerified: boolean; walletBalance: number;
  documents?: { type: string; url: string; status: string }[];
};

interface AuthCtx {
  user: Me | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (body: Record<string, unknown>) => Promise<void>;
  setSession: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

async function registerPush() {
  if (Platform.OS === 'web') return;
  try {
    const Device = await import('expo-device');
    const Notifications = await import('expo-notifications');
    if (!Device.isDevice) return;
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return;
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    await api('/auth/push-token', { body: { token } });
  } catch { /* projet EAS non configuré : notifications push désactivées */ }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try { setUser(await api<Me>('/auth/me')); } catch (e: any) { if (e?.status === 401) { setApiToken(null); await secure.set(TOKEN_KEY, null); setUser(null); } }
  }, []);

  useEffect(() => {
    (async () => {
      if (await loadToken()) await refresh();
      setReady(true);
    })();
  }, [refresh]);

  const setSession = async (token: string) => {
    setApiToken(token);
    await secure.set(TOKEN_KEY, token);
    const me = await api<Me>('/auth/me');
    setUser(me);
    if (me.language && me.language !== i18n.language) await setLanguage(me.language as Lang);
    registerPush();
  };

  const value: AuthCtx = {
    user, ready, refresh, setSession,
    login: async (email, password) => setSession((await api('/auth/login', { body: { email, password } })).token),
    register: async (body) => setSession((await api('/auth/register', { body: { ...body, language: i18n.language } })).token),
    logout: async () => {
      try { await api('/auth/push-token', { body: { token: null } }); } catch { /* hors ligne */ }
      setApiToken(null); await secure.set(TOKEN_KEY, null); setUser(null);
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('AuthProvider manquant');
  return c;
};
