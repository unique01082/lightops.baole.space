import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import { applyDocumentLanguage } from './language';
import vi from './vi.json';

const savedLang = (() => {
  try {
    return localStorage.getItem('lightops-language');
  } catch {
    return null;
  }
})();

const browserLang =
  typeof navigator !== 'undefined' && navigator.language.startsWith('vi') ? 'vi' : 'en';

i18n.on('languageChanged', applyDocumentLanguage);

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    vi: { translation: vi },
  },
  lng: savedLang ?? browserLang,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

applyDocumentLanguage(i18n.language);

export default i18n;
