import { messages } from './messages.js';
import { worktrackMessages } from './worktrackMessages.js';
import { pageMessages } from './worktrackPageMessages.js';
import { notificationMessages } from './notificationMessages.js';
import { authMessages } from './authMessages.js';
import { teamMessages } from './teamMessages.js';
import { navigationMessages } from './navigationMessages.js';

const SOURCES = [messages, worktrackMessages, pageMessages, notificationMessages, authMessages, teamMessages, navigationMessages];
const SUPPORTED_LANGUAGES = ['uk', 'cs', 'en'];

function resolvePath(object, key) {
  return String(key || '').split('.').reduce((value, part) => value?.[part], object);
}

function flattenKeys(object, prefix = '') {
  return Object.entries(object || {}).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value && typeof value === 'object' ? flattenKeys(value, path) : [path];
  });
}

function mergedDictionary(language) {
  return SOURCES.reduce((result, source) => ({ ...result, ...(source[language] || {}) }), {});
}

export function resolveMessage(language, key) {
  const normalizedLanguage = SUPPORTED_LANGUAGES.includes(language) ? language : 'uk';
  for (const source of SOURCES) {
    const localized = resolvePath(source[normalizedLanguage], key);
    if (typeof localized === 'string') return localized;
  }
  if (normalizedLanguage !== 'uk') {
    for (const source of SOURCES) {
      const fallback = resolvePath(source.uk, key);
      if (typeof fallback === 'string') return fallback;
    }
  }
  return key;
}

export function validateTranslationParity() {
  const baseKeys = flattenKeys(mergedDictionary('uk')).sort();
  return Object.fromEntries(['cs', 'en'].map(language => {
    const keys = flattenKeys(mergedDictionary(language)).sort();
    return [language, {
      missing: baseKeys.filter(key => !keys.includes(key)),
      extra: keys.filter(key => !baseKeys.includes(key)),
    }];
  }));
}

if (import.meta.env?.DEV) {
  const parity = validateTranslationParity();
  const invalid = Object.values(parity).some(result => result.missing.length || result.extra.length);
  if (invalid) console.warn('[i18n] Translation dictionaries are out of sync', parity);
}
