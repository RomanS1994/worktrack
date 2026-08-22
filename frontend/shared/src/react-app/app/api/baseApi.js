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
let accessSyncRequestPromise = null;

function sleep(ms) {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

function isNetworkRefreshError(error) {
  return (
    error?.status === 'FETCH_ERROR' ||
    error?.status === 'TIMEOUT_ERROR' ||
    !error?.status
  );
}

function getBackendErrorMessage(error) {
  if (!error?.data || typeof error.data !== 'object') return '';
  return typeof error.data.error === 'string' ? error.data.error : '';
}

function isCompanyAccessError(error) {
  if (error?.status !== 403) return false;
  return new Set([
    'Company access is required',
    'Manager access is required',
    'Employee access is required',
  ]).has(getBackendErrorMessage(error));
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

function shouldSurfaceOfflineForRequest(api) {
  return api?.type === 'mutation';
}

function getSharedRefreshRequest(runRefreshFlow) {
  if (!refreshRequestPromise) {
    refreshRequestPromise = runRefreshFlow().finally(() => {
      refreshRequestPromise = null;
    });
  }

  return refreshRequestPromise;
}

function getSharedAccessSyncRequest(runSyncFlow) {
  if (!accessSyncRequestPromise) {
    accessSyncRequestPromise = runSyncFlow().finally(() => {
      accessSyncRequestPromise = null;
    });
  }

  return accessSyncRequestPromise;
}

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

function applySyncedUser(api, syncResult) {
  const nextUser = syncResult?.data?.user || null;
  const currentToken = api.getState?.()?.auth?.token || getToken();

  if (!currentToken || !nextUser) {
    return false;
  }

  saveSession(currentToken, nextUser);
  api.dispatch(setSession({ token: currentToken, user: nextUser }));
  return true;
}

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
  refetchOnFocus: true,
  refetchOnReconnect: true,
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

    async function refreshSession() {
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

    async function syncCurrentUser() {
      return getSharedAccessSyncRequest(async () => {
        const syncResult = await baseQuery('/me', api, extraOptions);
        return applySyncedUser(api, syncResult);
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
    } else if (isCompanyAccessError(result.error) && getRequestUrl(args) !== '/me') {
      const synced = await syncCurrentUser();
      if (synced) {
        result = await baseQuery(args, api, extraOptions);
      }
    }

    return result;
  },
  tagTypes: [
    'Me',
    'Employees',
    'Projects',
    'Company',
    'WorkEntries',
    'WeeklySubmissions',
    'Notifications',
    'AuditLogs',
  ],
  endpoints: () => ({}),
});
