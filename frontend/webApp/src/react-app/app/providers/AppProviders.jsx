import { useEffect } from 'react';

import { baseApi } from '@shared/app/api/baseApi.js';
import { AppProviders as SharedAppProviders } from '@shared/app/providers/AppProviders.jsx';
import { router } from '../../router.jsx';
import { store } from '../../store.js';

const LIVE_SYNC_INTERVAL_MS = 10000;
const LIVE_SYNC_TAGS = [
  { type: 'Notifications', id: 'LIST' },
  { type: 'WorkEntries', id: 'WEEK' },
];

function refreshLiveData() {
  store.dispatch(baseApi.util.invalidateTags(LIVE_SYNC_TAGS));
}

export function AppProviders() {
  useEffect(() => {
    function refreshWhenVisible() {
      if (document.visibilityState === 'visible') refreshLiveData();
    }

    refreshLiveData();
    const intervalId = window.setInterval(refreshWhenVisible, LIVE_SYNC_INTERVAL_MS);
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
