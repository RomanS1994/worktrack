import { useEffect } from 'react';

import { useI18n } from './useI18n.js';
import { saveStoredLanguage } from './languageStorage.js';

export function I18nBootstrap() {
  const { language } = useI18n();

  useEffect(() => {
    document.documentElement.lang = language;
    saveStoredLanguage(language);
  }, [language]);

  return null;
}
