import { useEffect } from 'react';

import { baseApi } from '@shared/app/api/baseApi.js';
import { AppProviders as SharedAppProviders } from '@shared/app/providers/AppProviders.jsx';
import { router } from '../../router.jsx';
import { store } from '../../store.js';

const BACKGROUND_SYNC_INTERVAL_MS = 60000;
const BACKGROUND_SYNC_TAGS = [
  { type: 'Notifications', id: 'LIST' },
];
const RESUME_SYNC_TAGS = [
  ...BACKGROUND_SYNC_TAGS,
  { type: 'WorkEntries', id: 'WEEK' },
];

function refreshTags(tags) {
  store.dispatch(baseApi.util.invalidateTags(tags));
}

export function AppProviders() {
  useEffect(() => {
    function refreshWhenVisible() {
      if (document.visibilityState === 'visible') refreshTags(RESUME_SYNC_TAGS);
    }

    function refreshBackgroundWhenVisible() {
      if (document.visibilityState === 'visible') refreshTags(BACKGROUND_SYNC_TAGS);
    }

    refreshTags(RESUME_SYNC_TAGS);
    const intervalId = window.setInterval(refreshBackgroundWhenVisible, BACKGROUND_SYNC_INTERVAL_MS);
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, []);

  return <SharedAppProviders router={router} store={store} />;
}
