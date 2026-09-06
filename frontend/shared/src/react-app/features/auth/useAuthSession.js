import { useEffect } from 'react';
import { useDispatch } from 'react-redux';

import { useRefreshSessionMutation } from './authApi.js';
import {
  clearSession as clearStoredSession,
  getStoredUser,
  getToken,
  saveSession,
} from './authStorage.js';
import {
  clearSession as clearAuthSession,
  setSession,
  setSessionError,
  setSessionInitialized,
} from './authSlice.js';
import { getMessage } from '../../app/i18n/messages.js';
import { readStoredLanguage } from '../../app/i18n/languageStorage.js';

let sessionBootstrapPromise = null;

// Відновлює сесію з локального сховища до завершення перевірки на сервері.
function restoreStoredSession(dispatch) {
  const token = getToken();
  const user = getStoredUser();

  if (!token || !user) {
    return false;
  }

  dispatch(setSession({ token, user }));
  return true;
}

// Застосовує оновлену сесію після успішного refresh-запиту.
function applyRefreshedSession(dispatch, response) {
  const nextToken = response?.token || '';
  const nextUser = response?.user || null;

  if (!nextToken || !nextUser) {
    return false;
  }

  saveSession(nextToken, nextUser, {
    accessTokenExpiresAt: response?.accessTokenExpiresAt || '',
    lastVerifiedAt: new Date().toISOString(),
  });
  dispatch(setSession({ token: nextToken, user: nextUser }));
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

// Завершує bootstrap сесії з неблокуючою server-помилкою без примусового logout.
function handleSessionBootstrapFailure(dispatch, restoredFromStorage) {
  if (restoredFromStorage) {
    dispatch(
      setSessionError({
        type: 'server',
        message: t('auth.sessionCheckFailedKeepSession'),
      }),
    );
    dispatch(setSessionInitialized());
    return;
  }

  dispatch(setSessionInitialized());
}

function handleExpiredStoredSession(dispatch) {
  clearStoredSession();
  dispatch(clearAuthSession());
  dispatch(
    setSessionError({
      type: 'expired',
      message: t('auth.sessionExpiredSignIn'),
    }),
  );
}

export function useAuthSession() {
  const dispatch = useDispatch();
  const [refreshSession] = useRefreshSessionMutation();

  useEffect(() => {
    let isActive = true;
    let hasSession = restoreStoredSession(dispatch);
    let lastForegroundSyncAt = 0;

    const syncSession = ({ initialize = false } = {}) => {
      requestSessionRefresh(refreshSession)
        .then(response => {
          if (!isActive) return;

          hasSession = applyRefreshedSession(dispatch, response) || hasSession;
          if (initialize) dispatch(setSessionInitialized());
        })
        .catch(error => {
          if (!isActive) return;

          if (error?.status === 401) {
            if (hasSession) {
              handleExpiredStoredSession(dispatch);
            } else if (initialize) {
              dispatch(setSessionInitialized());
            }
            return;
          }

          if (initialize) {
            handleSessionBootstrapFailure(dispatch, hasSession);
          }
        });
    };

    // Завжди звіряємо користувача з сервером при запуску застосунку.
    // Це важливо для змін ролі/доступу, зроблених іншим менеджером.
    syncSession({ initialize: true });

    const syncOnForeground = () => {
      if (!hasSession || document.visibilityState === 'hidden') return;

      const now = Date.now();
      if (now - lastForegroundSyncAt < 2000) return;
      lastForegroundSyncAt = now;
      syncSession();
    };

    window.addEventListener('focus', syncOnForeground);
    document.addEventListener('visibilitychange', syncOnForeground);

    return () => {
      isActive = false;
      window.removeEventListener('focus', syncOnForeground);
      document.removeEventListener('visibilitychange', syncOnForeground);
    };
  }, [dispatch, refreshSession]);
}
