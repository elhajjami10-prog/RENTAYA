export const API_URL = (import.meta.env.VITE_API_URL || `${location.protocol}//${location.hostname}:4000`).replace(/\/$/, '');
let token = localStorage.getItem('rentaya.admin.token');
export const setToken = (t: string | null) => { token = t; t ? localStorage.setItem('rentaya.admin.token', t) : localStorage.removeItem('rentaya.admin.token'); };
export const getToken = () => token;

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; query?: Record<string, unknown> } = {}): Promise<T> {
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
