export function applyDocumentLanguage(language: string) {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = language.startsWith('vi') ? 'vi' : 'en';
  }
}
