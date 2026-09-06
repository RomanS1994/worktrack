import { useEffect } from 'react';

import { getToken } from '../../features/auth/authStorage.js';
import { useI18n } from './useI18n.js';
import { saveStoredLanguage } from './languageStorage.js';

function resolveApiBaseUrl() {
  if (import.meta.env.DEV) {
    return import.meta.env.VITE_API_BASE_URL_TEST || import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
  }
  return import.meta.env.VITE_API_BASE_URL || '/api';
}

async function syncPushLanguage(language) {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
  const registration = await navigator.serviceWorker.getRegistration('/');
  const subscription = registration ? await registration.pushManager.getSubscription() : null;
  if (!subscription) return;

  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  const apiKey = import.meta.env.VITE_API_KEY;
  if (token) headers.Authorization = `Bearer ${token}`;
  if (apiKey) headers['X-API-KEY'] = apiKey;

  await fetch(`${resolveApiBaseUrl()}/notifications/push-subscription`, {
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify({ ...subscription.toJSON(), language }),
  });
}

export function I18nBootstrap() {
  const { language } = useI18n();

  useEffect(() => {
    document.documentElement.lang = language;
    saveStoredLanguage(language);
    void syncPushLanguage(language).catch(() => {
      // Language sync must never block or disturb the app session.
    });
  }, [language]);

  return null;
}
