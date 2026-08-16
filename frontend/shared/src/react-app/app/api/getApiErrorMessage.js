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

function readErrorText(error) {
  if (!error) {
    return '';
  }

  if (typeof error === 'string') {
    return error;
  }

  if (typeof error === 'object') {
    const data = error.data;
    if (typeof data === 'string') {
      return data;
    }

    if (data && typeof data === 'object') {
      if (typeof data.error === 'string') {
        return data.error;
      }

      if (typeof data.message === 'string') {
        return data.message;
      }

      if (Array.isArray(data.details) && data.details.length) {
        return data.details.filter(Boolean).join(', ');
      }
    }

    if (typeof error.error === 'string') {
      return error.error;
    }
  }

  return '';
}

export function getApiErrorMessage(error, fallbackKey = 'common.failedToLoad') {
  const language = readStoredLanguage();
  const fallback = getMessage(language, fallbackKey);
  const detail = readErrorText(error);

  if (detail) {
    const translatedKey = TRANSLATED_BACKEND_ERRORS[detail];
    return translatedKey ? getMessage(language, translatedKey) : detail;
  }

  if (error && typeof error === 'object') {
    if (error.status === 'FETCH_ERROR') {
      return getMessage(language, 'common.failedToConnect');
    }

    if (error.status === 'TIMEOUT_ERROR') {
      return getMessage(language, 'common.requestTimedOut');
    }

    if (error.status === 'PARSING_ERROR') {
      return getMessage(language, 'common.invalidServerResponse');
    }
  }

  return fallback;
}
