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
    let controller = null;
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
      if (event === 'reaction') {
        tags.push({ type: 'Notifications', id: 'CHAT_REACTIONS' });
      }
      if (event !== 'typing') dispatch(baseApi.util.invalidateTags(tags));
      window.dispatchEvent(new CustomEvent('worktrack:chat-live', { detail: { event, payload } }));
    };

    const stopConnection = () => {
      if (retryId) window.clearTimeout(retryId);
      retryId = null;
      controller?.abort();
      controller = null;
    };

    const start = async () => {
      if (stopped || document.visibilityState !== 'visible' || controller) return;
      controller = new AbortController();
      const activeController = controller;
      try {
        await connectChatStream({ signal: activeController.signal, onEvent: handleEvent });
      } catch {
        // Reconnect below unless this connection was intentionally aborted.
      } finally {
        if (controller === activeController) controller = null;
      }
      if (!stopped && !activeController.signal.aborted && document.visibilityState === 'visible') {
        retryId = window.setTimeout(start, 3000);
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        dispatch(baseApi.util.invalidateTags([
          { type: 'Notifications', id: 'CHAT_MESSAGES' },
          { type: 'Notifications', id: 'CHAT_SUMMARY' },
          { type: 'Notifications', id: 'CHAT_PRESENCE' },
          { type: 'Notifications', id: 'CHAT_READ_STATES' },
          { type: 'Notifications', id: 'CHAT_REACTIONS' },
        ]));
        void start();
      } else {
        stopConnection();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    void start();
    return () => {
      stopped = true;
      document.removeEventListener('visibilitychange', handleVisibility);
      stopConnection();
    };
  }, [dispatch, enabled]);

  return null;
}
