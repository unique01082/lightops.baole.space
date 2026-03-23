import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './en.json'
import vi from './vi.json'

const savedLang = (() => {
  try {
    return localStorage.getItem('lightops-landing-language')
  } catch {
    return null
  }
})()

const browserLang =
  typeof navigator !== 'undefined' && navigator.language.startsWith('vi')
    ? 'vi'
    : 'en'

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    vi: { translation: vi },
  },
  lng: savedLang ?? browserLang,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

export default i18n
