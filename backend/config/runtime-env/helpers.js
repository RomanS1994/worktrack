import {
  EXACT_PLACEHOLDER_VALUES,
  PLACEHOLDER_FRAGMENTS,
} from './constants.js';

export function normalizeEnvValue(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function isPlaceholderLike(value) {
  const normalized = normalizeEnvValue(value);
  if (!normalized) {
    return true;
  }

  const lowerValue = normalized.toLowerCase();
  if (EXACT_PLACEHOLDER_VALUES.has(lowerValue)) {
    return true;
  }
  if (/^\$\{[^}]+\}$/.test(normalized) || /^\$\{\{[^}]+\}\}$/.test(normalized)) {
    return true;
  }

  return PLACEHOLDER_FRAGMENTS.some(fragment => lowerValue.includes(fragment));
}

export function isPlaceholderDatabaseUrl(value) {
  const normalized = normalizeEnvValue(value);
  if (!normalized) {
    return false;
  }

  try {
    const parsed = new URL(normalized);
    const parts = [
      decodeURIComponent(parsed.username),
      decodeURIComponent(parsed.password),
      parsed.hostname,
      parsed.pathname.replace(/^\//, ''),
    ];

    return parts.some(part => part && isPlaceholderLike(part));
  } catch {
    return false;
  }
}
