import { createSlice } from '@reduxjs/toolkit';

import { getStoredUser, getToken } from './authStorage.js';

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: getStoredUser(),
    token: getToken(),
    initialized: false,
    sessionError: '',
    sessionErrorType: '',
  },
  reducers: {
    setSession(state, action) {
      state.token = action.payload.token || '';
      state.user = action.payload.user || null;
      state.initialized = true;
      state.sessionError = '';
      state.sessionErrorType = '';
    },
    clearSession(state) {
      state.token = '';
      state.user = null;
      state.initialized = true;
      state.sessionError = '';
      state.sessionErrorType = '';
    },
    setSessionInitialized(state) {
      state.initialized = true;
    },
    setSessionError(state, action) {
      if (typeof action.payload === 'string') {
        state.sessionError = action.payload;
        state.sessionErrorType = '';
        return;
      }

      state.sessionError = action.payload?.message || '';
      state.sessionErrorType = action.payload?.type || '';
    },
    clearSessionError(state) {
      state.sessionError = '';
      state.sessionErrorType = '';
    },
  },
});

export const {
  setSession,
  clearSession,
  setSessionInitialized,
  setSessionError,
  clearSessionError,
} = authSlice.actions;

export const selectUser = state => state.auth.user;
export const selectToken = state => state.auth.token;
export const selectSessionInitialized = state => state.auth.initialized;
export const selectSessionError = state => state.auth.sessionError;
export const selectSessionErrorType = state => state.auth.sessionErrorType;

export default authSlice.reducer;
