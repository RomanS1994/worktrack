import { useEffect } from 'react';
import { useDispatch } from 'react-redux';

import { useLazyGetMeQuery, useRefreshSessionMutation } from './authApi.js';
import {
  getStoredUser,
  getToken,
  saveSession,
} from './authStorage.js';
import {
  setSession,
  setSessionError,
  setSessionInitialized,
} from './authSlice.js';
import { getMessage } from '../../app/i18n/messages.js';
import { readStoredLanguage } from '../../app/i18n/languageStorage.js';

let sessionBootstrapPromise = null;

function restoreStoredSession(dispatch) {
  const token = getToken();
  const user = getStoredUser();

  if (!token || !user) return false;

  dispatch(setSession({ token, user }));
  return true;
}

function applyRefreshedSession(dispatch, response) {
  const nextToken = response?.token || '';
  const nextUser = response?.user || null;

  if (!nextToken || !nextUser) return false;

  saveSession(nextToken, nextUser, {
    accessTokenExpiresAt: response?.accessTokenExpiresAt || '',
    lastVerifiedAt: new Date().toISOString(),
  });
  dispatch(setSession({ token: nextToken, user: nextUser }));
  dispatch(setSessionError({ type: '', message: '' }));
  return true;
}

function applyCurrentUser(dispatch, response) {
  const token = getToken();
  const nextUser = response?.user || null;

  if (!token || !nextUser) return false;

  saveSession(token, nextUser);
  dispatch(setSession({ token, user: nextUser }));
  dispatch(setSessionError({ type: '', message: '' }));
  return true;
}

function requestSessionRefresh(refreshSession) {
  if (!sessionBootstrapPromise) {
    sessionBootstrapPromise = refreshSession()
      .unwrap()
      .finally(() => {
        sessionBootstrapPromise = null;
      });
  }

  return sessionBootstrapPromise;
}

function t(key) {
  return getMessage(readStoredLanguage(), key);
}

function handleSessionBootstrapFailure(dispatch, restoredFromStorage) {
  if (restoredFromStorage) {
    dispatch(
      setSessionError({
        type: 'server',
        message: t('auth.sessionCheckFailedKeepSession'),
      }),
    );
  }

  dispatch(setSessionInitialized());
}

export function useAuthSession() {
  const dispatch = useDispatch();
  const [refreshSession] = useRefreshSessionMutation();
  const [getMe] = useLazyGetMeQuery();

  useEffect(() => {
    let isActive = true;
    const hasStoredSession = restoreStoredSession(dispatch);
    let lastForegroundSyncAt = 0;

    const syncCurrentUser = ({ initialize = false } = {}) => {
      getMe(undefined, false)
        .unwrap()
        .then(response => {
          if (!isActive) return;
          applyCurrentUser(dispatch, response);
          if (initialize) dispatch(setSessionInitialized());
        })
        .catch(() => {
          if (!isActive) return;
          if (initialize) handleSessionBootstrapFailure(dispatch, true);
        });
    };

    if (hasStoredSession) {
      syncCurrentUser({ initialize: true });
    } else {
      requestSessionRefresh(refreshSession)
        .then(response => {
          if (!isActive) return;
          applyRefreshedSession(dispatch, response);
          dispatch(setSessionInitialized());
        })
        .catch(() => {
          if (!isActive) return;
          dispatch(setSessionInitialized());
        });
    }

    const syncOnForeground = () => {
      if (!getToken() || document.visibilityState === 'hidden') return;

      const now = Date.now();
      if (now - lastForegroundSyncAt < 2000) return;
      lastForegroundSyncAt = now;
      syncCurrentUser();
    };

    window.addEventListener('focus', syncOnForeground);
    document.addEventListener('visibilitychange', syncOnForeground);

    return () => {
      isActive = false;
      window.removeEventListener('focus', syncOnForeground);
      document.removeEventListener('visibilitychange', syncOnForeground);
    };
  }, [dispatch, getMe, refreshSession]);
}
