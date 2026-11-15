import i18n from './i18n';

const loc = () => (i18n.language === 'ar' ? 'ar-MA' : i18n.language === 'en' ? 'en-GB' : 'fr-FR');

export const money = (n: number | null | undefined) => {
  const v = Math.round(Number(n || 0));
  const s = v.toLocaleString(i18n.language === 'ar' ? 'fr-FR' : loc());
  return i18n.language === 'ar' ? `${s} درهم` : `${s} MAD`;
};

const TZ = 'Africa/Casablanca';
export const fmtDate = (d: string | Date, withYear = false) =>
  new Date(d).toLocaleDateString(loc(), { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}), timeZone: TZ });
export const fmtDateTime = (d: string | Date) =>
  new Date(d).toLocaleString(loc(), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: TZ });
export const fmtTime = (d: string | Date) => new Date(d).toLocaleTimeString(loc(), { hour: '2-digit', minute: '2-digit', timeZone: TZ });
export const fmtRange = (a: string | Date, b: string | Date) => `${fmtDateTime(a)} → ${fmtDateTime(b)}`;

export const timeAgo = (d: string | Date) => {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  const t = i18n.t.bind(i18n);
  if (s < 60) return t('time.now');
  if (s < 3600) return t('time.minutes', { count: Math.floor(s / 60) });
  if (s < 86400) return t('time.hours', { count: Math.floor(s / 3600) });
  if (s < 86400 * 7) return t('time.days', { count: Math.floor(s / 86400) });
  return fmtDate(d, true);
};

export const responseTime = (min: number) => {
  const t = i18n.t.bind(i18n);
  if (min <= 60) return t('owner.respondsWithinHour');
  if (min <= 24 * 60) return t('owner.respondsWithinHours', { count: Math.ceil(min / 60) });
  return t('owner.respondsWithinDay');
};

export const apiErrorMessage = (e: unknown) => {
  const code = (e as { code?: string })?.code || 'NETWORK_ERROR';
  const key = `errors.${code}`;
  return i18n.exists(key) ? i18n.t(key) : i18n.t('errors.generic');
};
