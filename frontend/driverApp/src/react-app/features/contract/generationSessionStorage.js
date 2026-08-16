const GENERATION_SESSION_KEY = 'pdf-app-generation-session';

export function loadGenerationSession() {
  try {
    if (typeof sessionStorage === 'undefined') return null;

    const rawValue = sessionStorage.getItem(GENERATION_SESSION_KEY);
    if (!rawValue) return null;

    const parsedValue = JSON.parse(rawValue);
    if (!parsedValue || typeof parsedValue !== 'object') return null;

    return parsedValue;
  } catch {
    return null;
  }
}

export function saveGenerationSession(session) {
  try {
    if (typeof sessionStorage === 'undefined') return;

    sessionStorage.setItem(GENERATION_SESSION_KEY, JSON.stringify(session));
  } catch {
    // Ignore storage errors.
  }
}

export function clearGenerationSession() {
  try {
    if (typeof sessionStorage === 'undefined') return;

    sessionStorage.removeItem(GENERATION_SESSION_KEY);
  } catch {
    // Ignore storage errors.
  }
}
