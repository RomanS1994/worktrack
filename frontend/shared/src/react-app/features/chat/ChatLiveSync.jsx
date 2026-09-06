import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { baseApi } from '../../app/api/baseApi.js';
import { selectToken, selectUser } from '../auth/authSlice.js';
import { hasActiveCompanyAccess } from '../auth/authAccess.js';
import { connectChatStream } from './chatLive.js';

export function ChatLiveSync() {
  const dispatch = useDispatch();
  const token = useSelector(selectToken);
  const user = useSelector(selectUser);
  const enabled = Boolean(token && user && hasActiveCompanyAccess(user));

  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController();
    let retryId = null;
    let stopped = false;

    const handleEvent = (event, payload) => {
      const tags = [
        { type: 'Notifications', id: 'CHAT_MESSAGES' },
        { type: 'Notifications', id: 'CHAT_SUMMARY' },
      ];
      if (event === 'presence' || event === 'ready') {
        tags.push({ type: 'Notifications', id: 'CHAT_PRESENCE' });
      }
      if (event === 'read') {
        tags.push({ type: 'Notifications', id: 'CHAT_READ_STATES' });
      }
      if (event !== 'typing') dispatch(baseApi.util.invalidateTags(tags));
      window.dispatchEvent(new CustomEvent('worktrack:chat-live', { detail: { event, payload } }));
    };

    const start = async () => {
      try {
        await connectChatStream({ signal: controller.signal, onEvent: handleEvent });
      } catch {
        if (!stopped && !controller.signal.aborted) retryId = window.setTimeout(start, 3000);
      }
    };

    start();
    return () => {
      stopped = true;
      if (retryId) window.clearTimeout(retryId);
      controller.abort();
    };
  }, [dispatch, enabled]);

  return null;
}
