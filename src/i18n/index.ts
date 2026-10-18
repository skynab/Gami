import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en } from './en';
import { es } from './es';
import { fr } from './fr';
import { ja } from './ja';

/**
 * The interface's languages. The first visit picks the browser's language if Gami has it (English
 * otherwise); choosing one in the menu is remembered on this device.
 */
export const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'ja', name: '日本語' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
] as const;
export type Language = (typeof LANGUAGES)[number]['code'];

const STORAGE_KEY = 'gami.language';
const codes = LANGUAGES.map((l) => l.code) as string[];

function startingLanguage(): Language {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && codes.includes(saved)) return saved as Language;
  } catch {
    // Storage blocked: go by the browser.
  }
  const wanted = typeof navigator === 'undefined' ? [] : navigator.languages ?? [navigator.language];
  for (const tag of wanted) {
    const base = tag.toLowerCase().split('-')[0];
    if (codes.includes(base)) return base as Language;
  }
  return 'en';
}

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, ja: { translation: ja }, es: { translation: es }, fr: { translation: fr } },
  lng: startingLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});

const syncDocument = (lng: string) => {
  if (typeof document !== 'undefined') document.documentElement.lang = lng;
};
syncDocument(i18n.language);
i18n.on('languageChanged', syncDocument);

export function setLanguage(code: Language) {
  void i18n.changeLanguage(code);
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    // Storage blocked: it still applies for this visit.
  }
}

export default i18n;
