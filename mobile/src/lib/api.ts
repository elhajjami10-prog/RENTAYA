import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { secure } from './storage';
import { demoApi } from './demo/mock';

/** Mode démo : l'app fonctionne sans serveur, avec des données fictives. */
export const DEMO = process.env.EXPO_PUBLIC_DEMO === '1';

/** URL de l'API : EXPO_PUBLIC_API_URL, sinon l'IP du poste de dev (Expo Go sur téléphone). */
function resolveBase() {
  const env = process.env.EXPO_PUBLIC_API_URL;
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (env && !(env.includes('localhost') && Platform.OS !== 'web' && host)) return env.replace(/\/$/, '');
  if (Platform.OS !== 'web' && host) return `http://${host}:4000`;
  return env || 'http://localhost:4000';
}
export const API_URL = resolveBase();

let token: string | null = null;
export const setApiToken = (t: string | null) => { token = t; };
export const getApiToken = () => token;
export const TOKEN_KEY = 'rentaya.token';
export const loadToken = async () => (token = await secure.get(TOKEN_KEY));

export class ApiError extends Error {
  constructor(public status: number, public code: string, public details?: unknown) { super(code); }
}

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; query?: Record<string, unknown> } = {}): Promise<T> {
  if (DEMO) {
    try { return (await demoApi(opts.method || (opts.body ? 'POST' : 'GET'), path, opts.query as never, opts.body as never, token)) as T; }
    catch (e: any) { throw new ApiError(e.status || 500, e.code || 'SERVER_ERROR', e.details); }
  }
  const qs = opts.query
    ? '?' + Object.entries(opts.query).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')
    : '';
  const res = await fetch(`${API_URL}/api${path}${qs}`, {
    method: opts.method || (opts.body ? 'POST' : 'GET'),
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error || 'NETWORK_ERROR', data.message || data.details);
  return data as T;
}

/** Envoi de fichiers (photos de voiture, documents, état des lieux…). */
export async function uploadFiles(uris: { uri: string; mimeType?: string | null; fileName?: string | null }[]): Promise<string[]> {
  if (DEMO) return uris.map((u) => u.uri);
  const form = new FormData();
  for (const [i, f] of uris.entries()) {
    const type = f.mimeType || 'image/jpeg';
    const name = f.fileName || `photo-${Date.now()}-${i}.${type.split('/')[1] || 'jpg'}`;
    if (Platform.OS === 'web') {
      const blob = await (await fetch(f.uri)).blob();
      form.append('files', blob, name);
    } else {
      form.append('files', { uri: f.uri, name, type } as any);
    }
  }
  const res = await fetch(`${API_URL}/api/users/uploads`, { method: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {}, body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error || 'UPLOAD_FAILED');
  return data.urls;
}

/** URL authentifiée pour les documents HTML (contrat, facture). */
export const authedUrl = (path: string) => `${API_URL}/api${path}${path.includes('?') ? '&' : '?'}token=${encodeURIComponent(token || '')}`;
