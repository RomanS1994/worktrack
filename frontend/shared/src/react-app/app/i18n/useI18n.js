import { useDispatch, useSelector } from 'react-redux';

import { selectLanguage, setLanguage as setLanguageAction } from './i18nSlice.js';
import { getMessage } from './messages.js';
import { normalizeLanguage } from './languageStorage.js';
import { getWorktrackMessage } from './worktrackMessages.js';
import { getPageMessage } from './worktrackPageMessages.js';

function formatMessage(template, values = {}) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) => {
    const value = values[key];
    return value == null ? '' : String(value);
  });
}

function resolveMessage(language, key) {
  const primary = getMessage(language, key);
  if (primary !== key) return primary;

  const worktrack = getWorktrackMessage(language, key);
  if (worktrack !== key) return worktrack;

  const page = getPageMessage(language, key);
  if (page !== key) return page;

  return key;
}

export function useI18n() {
  const dispatch = useDispatch();
  const language = useSelector(selectLanguage);

  function setLanguage(nextLanguage) {
    dispatch(setLanguageAction(normalizeLanguage(nextLanguage)));
  }

  function t(key, values) {
    return formatMessage(resolveMessage(language, key), values);
  }

  return {
    language,
    setLanguage,
    t,
  };
}
