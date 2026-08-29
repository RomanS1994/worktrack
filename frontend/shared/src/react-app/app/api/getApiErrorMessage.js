import { getMessage } from '../i18n/messages.js';
import { readStoredLanguage } from '../i18n/languageStorage.js';

const ERROR_COPY = {
  uk: {
    fallback: 'Не вдалося виконати запит.', fetch: 'Не вдалося з’єднатися із сервером.', timeout: 'Час очікування відповіді сервера минув.', parsing: 'Сервер повернув некоректну відповідь.',
    'User with this email already exists': 'Користувач із таким e-mail уже існує.',
    'Business identifiers are already used': 'Ці реквізити компанії вже використовуються.',
    'Invalid plan': 'Вибрано некоректний тарифний план.', 'Name is required': 'Вкажіть ім’я.', 'Email is required': 'Вкажіть e-mail.',
    'Password must be at least 8 characters long': 'Пароль має містити щонайменше 8 символів.',
    'Phone number must include country code': 'Номер телефону має містити код країни.',
    'Invalid phone number': 'Некоректний номер телефону.', 'Phone number is already used': 'Цей номер телефону вже використовується.',
    'Driver phone is required': 'Вкажіть номер телефону.', 'Team limit exceeded': 'Досягнуто ліміту учасників команди.', 'Team driver limit exceeded': 'Досягнуто ліміту працівників.',
    'Company access is required': 'Доступ до компанії неактивний або відсутній.', 'Manager access is required': 'Для цієї дії потрібен доступ менеджера.', 'Employee access is required': 'Для цієї дії потрібен доступ працівника.',
    'Notification not found': 'Сповіщення не знайдено.',
    'Project has work history and cannot be deleted. Deactivate it instead.': 'Цей об’єкт уже має історію робочих годин, тому його не можна видалити. Деактивуйте його — історія залишиться збереженою.',
  },
  cs: {
    fallback: 'Požadavek se nepodařilo dokončit.', fetch: 'Nepodařilo se připojit k serveru.', timeout: 'Vypršel časový limit odpovědi serveru.', parsing: 'Server vrátil neplatnou odpověď.',
    'User with this email already exists': 'Uživatel s tímto e-mailem již existuje.',
    'Business identifiers are already used': 'Tyto firemní identifikační údaje se již používají.',
    'Invalid plan': 'Byl zvolen neplatný tarifní plán.', 'Name is required': 'Zadejte jméno.', 'Email is required': 'Zadejte e-mail.',
    'Password must be at least 8 characters long': 'Heslo musí mít alespoň 8 znaků.',
    'Phone number must include country code': 'Telefonní číslo musí obsahovat předvolbu země.',
    'Invalid phone number': 'Neplatné telefonní číslo.', 'Phone number is already used': 'Toto telefonní číslo se již používá.',
    'Driver phone is required': 'Zadejte telefonní číslo.', 'Team limit exceeded': 'Byl dosažen limit členů týmu.', 'Team driver limit exceeded': 'Byl dosažen limit zaměstnanců.',
    'Company access is required': 'Přístup k firmě není aktivní nebo není k dispozici.', 'Manager access is required': 'Pro tuto akci je vyžadován přístup manažera.', 'Employee access is required': 'Pro tuto akci je vyžadován přístup zaměstnance.',
    'Notification not found': 'Oznámení nebylo nalezeno.',
    'Project has work history and cannot be deleted. Deactivate it instead.': 'Tento projekt již obsahuje historii odpracovaných hodin, proto jej nelze odstranit. Deaktivujte jej — historie zůstane zachována.',
  },
  en: {
    fallback: 'Request failed.', fetch: 'Could not connect to the server.', timeout: 'The server response timed out.', parsing: 'The server returned an invalid response.',
    'Project has work history and cannot be deleted. Deactivate it instead.': 'This project already has work-hour history and cannot be deleted. Deactivate it instead so the history stays محفوظed.',
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
      if (Array.isArray(data.details) && data.details.length) return data.details.filter(Boolean).join(', ');
    }
    if (typeof error.error === 'string') return error.error;
  }
  return '';
}

function translatedFallback(language, fallbackKey) {
  const translated = getMessage(language, fallbackKey);
  if (translated && translated !== fallbackKey) return translated;
  return (ERROR_COPY[language] || ERROR_COPY.uk).fallback;
}

export function getApiErrorMessage(error, fallbackKey = 'common.failed') {
  const language = readStoredLanguage();
  const copy = ERROR_COPY[language] || ERROR_COPY.uk;
  const detail = readErrorText(error);

  if (detail) {
    if (copy[detail]) return copy[detail];
    if (language === 'en') return detail;
    return translatedFallback(language, fallbackKey);
  }

  if (error && typeof error === 'object') {
    if (error.status === 'FETCH_ERROR') return copy.fetch;
    if (error.status === 'TIMEOUT_ERROR') return copy.timeout;
    if (error.status === 'PARSING_ERROR') return copy.parsing;
  }

  return translatedFallback(language, fallbackKey);
}
