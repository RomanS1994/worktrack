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
  const normalized = normalizeLanguage(language);
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, normalized);
  } catch {
    // Ignore storage failures in private/incognito contexts.
  }
  try {
    document.cookie = `${LANGUAGE_STORAGE_KEY}=${normalized}; Path=/; Max-Age=31536000; SameSite=Lax`;
  } catch {
    // Cookie sync is best effort only.
  }
}
