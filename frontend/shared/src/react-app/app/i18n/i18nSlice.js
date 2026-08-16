import { createSlice } from '@reduxjs/toolkit';

import { DEFAULT_LANGUAGE, normalizeLanguage, readStoredLanguage } from './languageStorage.js';

const i18nSlice = createSlice({
  name: 'i18n',
  initialState: {
    language: readStoredLanguage() || DEFAULT_LANGUAGE,
  },
  reducers: {
    setLanguage(state, action) {
      state.language = normalizeLanguage(action.payload);
    },
  },
});

export const { setLanguage } = i18nSlice.actions;

export const selectLanguage = state => state.i18n.language;

export default i18nSlice.reducer;
