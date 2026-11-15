export const API_URL = (import.meta.env.VITE_API_URL || `${location.protocol}//${location.hostname}:4000`).replace(/\/$/, '');
/** Mode démo : le back-office fonctionne sans serveur, avec les données fictives de l'app. */
export const DEMO = import.meta.env.VITE_DEMO === '1';
const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string | null) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch { /* stockage indisponible */ } },
};
let token = store.get('rentaya.admin.token');
export const setToken = (t: string | null) => { token = t; store.set('rentaya.admin.token', t); };
export const getToken = () => token;

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; query?: Record<string, unknown> } = {}): Promise<T> {
  if (DEMO) {
    const { demoApi } = await import('../../mobile/src/lib/demo/mock');
    try { return (await demoApi(opts.method || (opts.body ? 'POST' : 'GET'), path, opts.query as never, opts.body as never, token)) as T; }
    catch (e: any) { throw new Error(e.code || 'Erreur'); }
  }
  const qs = opts.query ? '?' + new URLSearchParams(Object.entries(opts.query).filter(([, v]) => v !== undefined && v !== '' && v !== null).map(([k, v]) => [k, String(v)])) : '';
  const res = await fetch(`${API_URL}/api${path}${qs}`, {
    method: opts.method || (opts.body ? 'POST' : 'GET'),
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) { setToken(null); location.reload(); }
  if (!res.ok) throw new Error(data.message && data.message !== data.error ? `${data.error}: ${JSON.stringify(data.message)}` : data.error || 'Erreur');
  return data as T;
}

export const mad = (n?: number | null) => `${Math.round(n || 0).toLocaleString('fr-FR')} MAD`;
export const dt = (d?: string | null) => (d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
