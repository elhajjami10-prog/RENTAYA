import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { I18nManager, Platform } from 'react-native';
import { getLocales } from 'expo-localization';
import fr from '../locales/fr';
import ar from '../locales/ar';
import en from '../locales/en';
import { prefs } from './storage';

export const LANGS = [
  { code: 'fr', label: 'Français' },
  { code: 'ar', label: 'العربية' },
  { code: 'en', label: 'English' },
] as const;
export type Lang = (typeof LANGS)[number]['code'];

const device = getLocales()[0]?.languageCode;
const initial: Lang = device === 'ar' || device === 'en' ? device : 'fr';

i18n.use(initReactI18next).init({
  resources: { fr: { translation: fr }, ar: { translation: ar }, en: { translation: en } },
  lng: initial,
  fallbackLng: 'fr',
  interpolation: { escapeValue: false },
  returnNull: false,
});

function applyDirection(lang: string) {
  const rtl = lang === 'ar';
  if (Platform.OS === 'web') {
    if (typeof document !== 'undefined') {
      document.documentElement.dir = rtl ? 'rtl' : 'ltr';
      document.documentElement.lang = lang;
    }
    return false;
  }
  I18nManager.allowRTL(true);
  if (I18nManager.isRTL !== rtl) {
    I18nManager.forceRTL(rtl);
    return true; // redémarrage nécessaire sur mobile
  }
  return false;
}

export async function loadLanguage() {
  const saved = (await prefs.get('rentaya.lang')) as Lang | null;
  const lang = saved || initial;
  await i18n.changeLanguage(lang);
  applyDirection(lang);
}

/** Change la langue ; renvoie true si l'app doit être redémarrée (changement de sens RTL sur mobile). */
export async function setLanguage(lang: Lang) {
  await prefs.set('rentaya.lang', lang);
  await i18n.changeLanguage(lang);
  return applyDirection(lang);
}

export const isRTL = () => i18n.language === 'ar';
export default i18n;
