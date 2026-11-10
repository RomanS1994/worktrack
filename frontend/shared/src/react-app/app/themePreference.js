const THEME_STORAGE_PREFIX = 'worktrack-theme-preference:';
const THEME_OPTIONS = new Set(['light', 'dark', 'system']);

function getPreferenceKey(user) {
  const identity = user?.id ?? user?.email;
  return identity == null || identity === '' ? `${THEME_STORAGE_PREFIX}guest` : `${THEME_STORAGE_PREFIX}${identity}`;
}

export function normalizeThemePreference(value) {
  return THEME_OPTIONS.has(value) ? value : 'system';
}

export function readThemePreference(user) {
  try {
    return normalizeThemePreference(localStorage.getItem(getPreferenceKey(user)));
  } catch {
    return 'system';
  }
}

export function saveThemePreference(user, preference) {
  const normalized = normalizeThemePreference(preference);
  try {
    localStorage.setItem(getPreferenceKey(user), normalized);
  } catch {
    // Keep the in-memory theme working when browser storage is unavailable.
  }
  applyThemePreference(normalized);
  return normalized;
}

export function applyThemePreference(preference) {
  if (typeof document === 'undefined') return;

  const normalized = normalizeThemePreference(preference);
  const prefersDark = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  const resolvedTheme = normalized === 'system' ? (prefersDark ? 'dark' : 'light') : normalized;

  document.documentElement.dataset.theme = resolvedTheme;
  document.documentElement.dataset.themePreference = normalized;
  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.setAttribute('content', resolvedTheme === 'dark' ? '#101820' : '#16a34a');
  const appleStatusBarStyle = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
  if (appleStatusBarStyle) appleStatusBarStyle.setAttribute('content', resolvedTheme === 'dark' ? 'black' : 'default');
}
