import { getToken, saveSession } from '@shared/features/auth/authStorage.js';

function resolveApiBaseUrl() {
  if (import.meta.env.DEV) {
    return (
      import.meta.env.VITE_API_BASE_URL_TEST ||
      import.meta.env.VITE_API_BASE_URL ||
      'http://localhost:3001/api'
    );
  }

  return import.meta.env.VITE_API_BASE_URL || '/api';
}

function buildApiUrl(path) {
  return `${resolveApiBaseUrl().replace(/\/$/, '')}/${String(path).replace(/^\//, '')}`;
}

function buildHeaders(token = getToken()) {
  const headers = {
    'Content-Type': 'application/json',
  };
  const apiKey = import.meta.env.VITE_API_KEY;

  if (apiKey) {
    headers['X-API-KEY'] = apiKey;
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

function parseDownloadFileName(response, fallback) {
  const disposition = response.headers.get('Content-Disposition') || '';
  const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);

  if (utfMatch) {
    try {
      return decodeURIComponent(utfMatch[1]);
    } catch {
      return utfMatch[1];
    }
  }

  const asciiMatch = disposition.match(/filename="([^"]+)"/i);

  return asciiMatch?.[1] || fallback;
}

async function refreshSession() {
  const response = await fetch(buildApiUrl('/auth/refresh'), {
    credentials: 'include',
    headers: buildHeaders(''),
    method: 'POST',
  });

  if (!response.ok) {
    return '';
  }

  const payload = await response.json();
  const token = payload?.token || '';
  const user = payload?.user || null;

  if (!token || !user) {
    return '';
  }

  saveSession(token, user, {
    accessTokenExpiresAt: payload.accessTokenExpiresAt || '',
    lastVerifiedAt: new Date().toISOString(),
  });

  return token;
}

async function requestTaxReport({ language, month, token, type }) {
  return fetch(buildApiUrl('/tax-reports/download'), {
    body: JSON.stringify({
      language,
      month,
      type,
    }),
    credentials: 'include',
    headers: buildHeaders(token),
    method: 'POST',
  });
}

export async function downloadTaxReportFile({ language, month, type }) {
  const fallbackFileName = `tax-report-${month || 'month'}`;
  let response = await requestTaxReport({
    language,
    month,
    token: getToken(),
    type,
  });

  if (response.status === 401) {
    const refreshedToken = await refreshSession();

    if (refreshedToken) {
      response = await requestTaxReport({
        language,
        month,
        token: refreshedToken,
        type,
      });
    }
  }

  if (!response.ok) {
    throw new Error('Failed to download tax report');
  }

  return {
    blob: await response.blob(),
    fileName: parseDownloadFileName(response, fallbackFileName),
  };
}
