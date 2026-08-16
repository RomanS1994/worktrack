const AUTH_SESSION_KEY = 'react-auth-session';
const DAILY_SESSION_REFRESH_MS = 24 * 60 * 60 * 1000;

// Безпечно читає збережену auth-сесію з localStorage.
function readSession() {
  try {
    if (typeof localStorage === 'undefined') return null;

    const rawValue = localStorage.getItem(AUTH_SESSION_KEY);
    if (!rawValue) return null;

    const parsedValue = JSON.parse(rawValue);
    if (!parsedValue || typeof parsedValue !== 'object') return null;

    return parsedValue;
  } catch {
    return null;
  }
}

// Повертає поточний access token для API-запитів.
export function getToken() {
  return readSession()?.token || '';
}

// Повертає збереженого користувача для bootstrap-а фронта.
export function getStoredUser() {
  return readSession()?.user || null;
}

// Повертає timestamp останньої успішної перевірки/видачі access token.
export function getSessionLastVerifiedAt() {
  const value = readSession()?.lastVerifiedAt || '';
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  return parsed.toISOString();
}

// Не робимо фоновий refresh частіше одного разу на добу.
export function shouldRefreshStoredSession() {
  const lastVerifiedAt = getSessionLastVerifiedAt();

  if (!lastVerifiedAt) {
    return true;
  }

  return Date.now() - new Date(lastVerifiedAt).getTime() >= DAILY_SESSION_REFRESH_MS;
}

// Зберігає токен і користувача локально після login або refresh.
export function saveSession(token, user, meta = {}) {
  try {
    if (typeof localStorage === 'undefined') return;

    const previousSession = readSession();
    const tokenChanged = previousSession?.token !== token;
    const lastVerifiedAt =
      meta.lastVerifiedAt ||
      (tokenChanged || !previousSession?.lastVerifiedAt
        ? new Date().toISOString()
        : previousSession.lastVerifiedAt);
    const accessTokenExpiresAt =
      meta.accessTokenExpiresAt ||
      (!tokenChanged ? previousSession?.accessTokenExpiresAt : '') ||
      '';

    localStorage.setItem(
      AUTH_SESSION_KEY,
      JSON.stringify({
        token,
        user,
        lastVerifiedAt,
        accessTokenExpiresAt,
      }),
    );
  } catch {
    // Ignore storage errors.
  }
}

// Повністю очищає локальну auth-сесію.
export function clearSession() {
  try {
    if (typeof localStorage === 'undefined') return;

    localStorage.removeItem(AUTH_SESSION_KEY);
  } catch {
    // Ignore storage errors.
  }
}
