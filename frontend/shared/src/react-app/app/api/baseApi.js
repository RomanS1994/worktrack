import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

import {
  clearSession as clearStoredSession,
  saveSession,
} from '../../features/auth/authStorage.js';
import {
  clearSession as clearAuthSession,
  clearSessionError,
  setSession,
  setSessionError,
} from '../../features/auth/authSlice.js';
import { getToken } from '../../features/auth/authStorage.js';
import { getMessage } from '../i18n/messages.js';
import { readStoredLanguage } from '../i18n/languageStorage.js';

function resolveBaseUrl() {
  if (import.meta.env.DEV) {
    return (
      import.meta.env.VITE_API_BASE_URL_TEST ||
      import.meta.env.VITE_API_BASE_URL ||
      'http://localhost:3001/api'
    );
  }

  return import.meta.env.VITE_API_BASE_URL || '/api';
}

let refreshWarningShownSinceSuccess = false;
let refreshRequestPromise = null;

// Дає коротку паузу перед повторною спробою refresh-запиту.
function sleep(ms) {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

// Відрізняє мережеві refresh-помилки від server-side відповіді.
function isNetworkRefreshError(error) {
  return (
    error?.status === 'FETCH_ERROR' ||
    error?.status === 'TIMEOUT_ERROR' ||
    !error?.status
  );
}

function shouldShowRefreshWarning() {
  return !refreshWarningShownSinceSuccess;
}

function markRefreshWarningShown() {
  refreshWarningShownSinceSuccess = true;
}

function resetRefreshWarningState() {
  refreshWarningShownSinceSuccess = false;
}

// Показує попередження тільки для явних user-actions, а не для фонових query/refetch.
function shouldSurfaceOfflineForRequest(api) {
  return api?.type === 'mutation';
}

// Виконує refresh у режимі single-flight, щоб паралельні 401 не ротили сесію одночасно.
function getSharedRefreshRequest(runRefreshFlow) {
  if (!refreshRequestPromise) {
    refreshRequestPromise = runRefreshFlow().finally(() => {
      refreshRequestPromise = null;
    });
  }

  return refreshRequestPromise;
}

// Оновлює локальну сесію після вдалого refresh.
function applySuccessfulRefresh(api, refreshResult) {
  const nextToken = refreshResult?.data?.token || '';
  const nextUser = refreshResult?.data?.user || null;

  if (!nextToken || !nextUser) {
    return false;
  }

  saveSession(nextToken, nextUser, {
    accessTokenExpiresAt: refreshResult?.data?.accessTokenExpiresAt || '',
    lastVerifiedAt: new Date().toISOString(),
  });
  resetRefreshWarningState();
  api.dispatch(setSession({ token: nextToken, user: nextUser }));
  api.dispatch(clearSessionError());
  return true;
}

// Справжній 401 на refresh означає, що refresh-cookie вже недійсний.
function expireSessionAfterRefreshRejected(api, t) {
  clearStoredSession();
  api.dispatch(clearAuthSession());
  api.dispatch(
    setSessionError({
      type: 'expired',
      message: t('auth.sessionExpiredSignIn'),
    }),
  );
}

function warnAboutRefreshFailure(api, t, type) {
  if (!shouldSurfaceOfflineForRequest(api) || !shouldShowRefreshWarning()) {
    return;
  }

  markRefreshWarningShown();
  api.dispatch(
    setSessionError({
      type,
      message:
        type === 'offline'
          ? t('auth.connectionLostKeepSession')
          : t('auth.sessionCheckFailedKeepSession'),
    }),
  );
}

export const baseApi = createApi({
  reducerPath: 'baseApi',
  baseQuery: async (args, api, extraOptions) => {
    const baseQuery = fetchBaseQuery({
      baseUrl: resolveBaseUrl(),
      credentials: 'include',
      prepareHeaders(headers) {
        const apiKey = import.meta.env.VITE_API_KEY;
        const sessionToken = api.getState?.()?.auth?.token || getToken();

        if (apiKey) {
          headers.set('X-API-KEY', apiKey);
        }

        if (sessionToken) {
          headers.set('Authorization', `Bearer ${sessionToken}`);
        }

        return headers;
      },
    });

    function getRequestUrl(requestArgs) {
      if (typeof requestArgs === 'string') {
        return requestArgs;
      }

      return requestArgs?.url || '';
    }

    function isAuthEndpoint(requestArgs) {
      return getRequestUrl(requestArgs).startsWith('/auth/');
    }

    function t(key) {
      return getMessage(readStoredLanguage(), key);
    }

    // Пробує оновити сесію й повертає структурований результат для поточного запиту.
    async function refreshSession() {
      // Виконує один refresh-запит без побічних ефектів.
      async function runRefreshRequest() {
        return baseQuery(
          {
            url: '/auth/refresh',
            method: 'POST',
          },
          api,
          extraOptions,
        );
      }

      return getSharedRefreshRequest(async () => {
        let refreshResult = await runRefreshRequest();

        if (applySuccessfulRefresh(api, refreshResult)) {
          return { ok: true, reason: '' };
        }

        const refreshError = refreshResult.error;
        if (refreshError?.status === 401) {
          expireSessionAfterRefreshRejected(api, t);
          return { ok: false, reason: 'expired' };
        }

        if (isNetworkRefreshError(refreshError)) {
          await sleep(350);
          refreshResult = await runRefreshRequest();

          if (applySuccessfulRefresh(api, refreshResult)) {
            return { ok: true, reason: '' };
          }
        }

        const finalRefreshError = refreshResult.error;
        if (finalRefreshError?.status === 401) {
          expireSessionAfterRefreshRejected(api, t);
          return { ok: false, reason: 'expired' };
        }

        if (!finalRefreshError) {
          return { ok: false, reason: 'server' };
        }

        return {
          ok: false,
          reason: isNetworkRefreshError(finalRefreshError) ? 'offline' : 'server',
        };
      });
    }

    let result = await baseQuery(args, api, extraOptions);

    if (!result.error) {
      resetRefreshWarningState();
    }

    if (result.error?.status === 401 && !isAuthEndpoint(args)) {
      const refreshed = await refreshSession();

      if (refreshed?.ok) {
        result = await baseQuery(args, api, extraOptions);

        if (!result.error) {
          resetRefreshWarningState();
        }
      } else if (refreshed?.reason === 'offline') {
        warnAboutRefreshFailure(api, t, 'offline');
      } else if (refreshed?.reason === 'server') {
        warnAboutRefreshFailure(api, t, 'server');
      }
    }

    return result;
  },
  tagTypes: [
    'Me',
    'Employees',
    'WorkEntries',
    'WeeklySubmissions',
    'AuditLogs',
  ],
  endpoints: () => ({}),
});
