import { useDispatch, useSelector } from 'react-redux';

import { selectLanguage, setLanguage as setLanguageAction } from './i18nSlice.js';
import { getMessage } from './messages.js';
import { normalizeLanguage } from './languageStorage.js';

function formatMessage(template, values = {}) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) => {
    const value = values[key];
    return value == null ? '' : String(value);
  });
}

export function useI18n() {
  const dispatch = useDispatch();
  const language = useSelector(selectLanguage);

  function setLanguage(nextLanguage) {
    dispatch(setLanguageAction(normalizeLanguage(nextLanguage)));
  }

  function t(key, values) {
    return formatMessage(getMessage(language, key), values);
  }

  return {
    language,
    setLanguage,
    t,
  };
}
