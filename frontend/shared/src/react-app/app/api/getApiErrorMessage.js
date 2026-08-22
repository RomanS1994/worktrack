import { getMessage } from '../i18n/messages.js';
import { readStoredLanguage } from '../i18n/languageStorage.js';

const TRANSLATED_BACKEND_ERRORS = {
  'User with this email already exists': 'auth.emailAlreadyExists',
  'Business identifiers are already used': 'auth.businessIdentifiersAlreadyUsed',
  'Invalid plan': 'auth.invalidPlan',
  'Name is required': 'auth.nameRequired',
  'Email is required': 'auth.emailRequired',
  'Password must be at least 8 characters long': 'auth.passwordTooShort',
  'Phone number must include country code': 'auth.phoneCountryCodeRequired',
  'Invalid phone number': 'auth.invalidPhoneNumber',
  'Phone number is already used': 'auth.phoneAlreadyUsed',
  'Driver phone is required': 'auth.phoneRequiredForOrders',
  'Team limit exceeded': 'settings.team.failed',
  'Team driver limit exceeded': 'settings.team.failed',
};

const LOCALIZED_BACKEND_ERRORS = {
  'Company access is required': {
    uk: 'Доступ до компанії неактивний або відсутній.',
    en: 'Company access is inactive or unavailable.',
    cs: 'Přístup ke společnosti není aktivní nebo není k dispozici.',
  },
  'Manager access is required': {
    uk: 'Для цієї дії потрібен активний доступ менеджера.',
    en: 'Active manager access is required for this action.',
    cs: 'Pro tuto akci je vyžadován aktivní přístup manažera.',
  },
  'Employee access is required': {
    uk: 'Для цієї дії потрібен активний доступ працівника.',
    en: 'Active employee access is required for this action.',
    cs: 'Pro tuto akci je vyžadován aktivní přístup zaměstnance.',
  },
};

function readErrorText(error) {
  if (!error) return '';
  if (typeof error === 'string') return error;

  if (typeof error === 'object') {
    const data = error.data;
    if (typeof data === 'string') return data;

    if (data && typeof data === 'object') {
      if (typeof data.error === 'string') return data.error;
      if (typeof data.message === 'string') return data.message;
      if (Array.isArray(data.details) && data.details.length) {
        return data.details.filter(Boolean).join(', ');
      }
    }

    if (typeof error.error === 'string') return error.error;
  }

  return '';
}

function getSafeMessage(language, key, fallbackKey = 'common.failed') {
  const translated = getMessage(language, key);
  if (translated && translated !== key) return translated;

  const fallback = getMessage(language, fallbackKey);
  return fallback && fallback !== fallbackKey ? fallback : 'Request failed.';
}

export function getApiErrorMessage(error, fallbackKey = 'common.failedToLoad') {
  const language = readStoredLanguage();
  const fallback = getSafeMessage(language, fallbackKey);
  const detail = readErrorText(error);

  if (detail) {
    const localized = LOCALIZED_BACKEND_ERRORS[detail];
    if (localized) return localized[language] || localized.en;

    const translatedKey = TRANSLATED_BACKEND_ERRORS[detail];
    if (translatedKey) return getSafeMessage(language, translatedKey);

    // Backend messages are currently authored in English. Keep the useful raw
    // detail for English users, but avoid leaking English into localized UI.
    return language === 'en' ? detail : fallback;
  }

  if (error && typeof error === 'object') {
    if (error.status === 'FETCH_ERROR') return getSafeMessage(language, 'common.failedToConnect');
    if (error.status === 'TIMEOUT_ERROR') return getSafeMessage(language, 'common.requestTimedOut');
    if (error.status === 'PARSING_ERROR') return getSafeMessage(language, 'common.invalidServerResponse');
  }

  return fallback;
}
