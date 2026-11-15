import React, { useCallback, useEffect, useState } from 'react';
import { api } from './api';

export function useLoad<T = any>(path: string, query?: Record<string, unknown>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const key = path + JSON.stringify(query || {});
  const reload = useCallback(() => {
    api<T>(path, { query }).then(setData).catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => { reload(); }, [reload]);
  return { data, error, reload };
}

export async function act(fn: () => Promise<unknown>, done?: () => void, confirmMsg?: string) {
  if (confirmMsg && !confirm(confirmMsg)) return;
  try { await fn(); done?.(); } catch (e) { alert((e as Error).message); }
}

const TONES: Record<string, string> = {
  ACTIVE: 'ok', VERIFIED: 'ok', PAID: 'ok', CONFIRMED: 'ok', COMPLETED: 'muted', RESOLVED: 'ok', REFUNDED: 'ok', CLOSED: 'muted', ACCEPTED: 'ok',
  PENDING: 'warn', PENDING_REVIEW: 'warn', AWAITING_VALIDATION: 'warn', REQUESTED: 'warn', PENDING_PAYMENT: 'warn', OPEN: 'warn', UNDER_REVIEW: 'warn', PROCESSING: 'warn', CONTESTED: 'bad',
  REJECTED: 'bad', FAILED: 'bad', DECLINED: 'bad', CANCELLED_BY_DRIVER: 'bad', CANCELLED_BY_OWNER: 'bad', CANCELLED_BY_ADMIN: 'bad', IN_PROGRESS: 'info',
};
export const Badge = ({ v }: { v?: string | boolean | null }) => <span className={`badge ${TONES[String(v)] || 'muted'}`}>{String(v ?? '—')}</span>;

export function Table<T>({ rows, cols, onRow }: { rows: T[]; cols: [string, (r: T) => React.ReactNode][]; onRow?: (r: T) => void }) {
  return (
    <div className="tableWrap">
      <table>
        <thead><tr>{cols.map(([h]) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => <tr key={i} onClick={() => onRow?.(r)} className={onRow ? 'click' : ''}>{cols.map(([h, f]) => <td key={h}>{f(r)}</td>)}</tr>)}
          {!rows.length ? <tr><td colSpan={cols.length} className="empty">Aucun élément</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modalHead"><h2>{title}</h2><button className="ghost" onClick={onClose}>✕</button></div>
        <div className="modalBody">{children}</div>
      </div>
    </div>
  );
}

export function Filters({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: string[]; placeholder?: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder || 'Tous'}</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

export const KV = ({ k, v }: { k: string; v: React.ReactNode }) => <div className="kv"><span>{k}</span><b>{v}</b></div>;
export const Img = ({ src }: { src: string }) => <a href={src} target="_blank" rel="noreferrer"><img className="thumb" src={src} alt="" /></a>;
