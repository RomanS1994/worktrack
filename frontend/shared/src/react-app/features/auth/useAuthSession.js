import { useEffect } from 'react';
import { useDispatch } from 'react-redux';

import { useRefreshSessionMutation } from './authApi.js';
import {
  clearSession as clearStoredSession,
  getStoredUser,
  getToken,
  saveSession,
  shouldRefreshStoredSession,
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

// Відновлює сесію з локального сховища без запиту до бекенда.
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

    const restoredFromStorage = restoreStoredSession(dispatch);

    if (restoredFromStorage && !shouldRefreshStoredSession()) {
      dispatch(setSessionInitialized());
      return () => {
        isActive = false;
      };
    }

    if (!sessionBootstrapPromise) {
      sessionBootstrapPromise = refreshSession()
        .unwrap()
        .finally(() => {
          sessionBootstrapPromise = null;
        });
    }

    sessionBootstrapPromise
      .then(response => {
        if (!isActive) {
          return;
        }

        applyRefreshedSession(dispatch, response);
        dispatch(setSessionInitialized());
      })
      .catch(error => {
        if (!isActive) {
          return;
        }

        if (error?.status === 401) {
          if (restoredFromStorage) {
            handleExpiredStoredSession(dispatch);
          } else {
            dispatch(setSessionInitialized());
          }
          return;
        }

        handleSessionBootstrapFailure(dispatch, restoredFromStorage);
      });

    return () => {
      isActive = false;
    };
  }, [dispatch, refreshSession]);
}
