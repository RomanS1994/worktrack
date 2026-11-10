import { useEffect } from 'react';
import { useSelector } from 'react-redux';

import { selectUser } from '../features/auth/authSlice.js';
import { applyThemePreference, readThemePreference } from './themePreference.js';

export function ThemePreferenceBootstrap() {
  const user = useSelector(selectUser);
  const userIdentity = user?.id ?? user?.email ?? 'guest';

  useEffect(() => {
    const applyStoredTheme = () => applyThemePreference(readThemePreference(user));
    applyStoredTheme();

    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    media?.addEventListener?.('change', applyStoredTheme);
    return () => media?.removeEventListener?.('change', applyStoredTheme);
  }, [userIdentity]);

  return null;
}
