export const SUPPORTED_LANGUAGES = ['uk', 'en', 'cs'];
export const DEFAULT_LANGUAGE = 'uk';
export const LANGUAGE_STORAGE_KEY = 'worktrack-language';

export function normalizeLanguage(value) {
  return SUPPORTED_LANGUAGES.includes(value) ? value : DEFAULT_LANGUAGE;
}

export function readStoredLanguage() {
  try {
    return normalizeLanguage(localStorage.getItem(LANGUAGE_STORAGE_KEY));
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

export function saveStoredLanguage(language) {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, normalizeLanguage(language));
  } catch {
    // Ignore storage failures in private/incognito contexts.
  }
}
