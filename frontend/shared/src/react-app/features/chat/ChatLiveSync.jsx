import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { baseApi } from '../../app/api/baseApi.js';
import { selectToken, selectUser } from '../auth/authSlice.js';
import { hasActiveCompanyAccess } from '../auth/authAccess.js';
import { connectChatStream } from './chatLive.js';

const CHAT_SYNC_TAGS = [
  { type: 'Notifications', id: 'CHAT_MESSAGES' },
  { type: 'Notifications', id: 'CHAT_SUMMARY' },
  { type: 'Notifications', id: 'CHAT_PRESENCE' },
  { type: 'Notifications', id: 'CHAT_READ_STATES' },
];

function emitConnectionState(state) {
  window.dispatchEvent(new CustomEvent('worktrack:chat-connection', { detail: { state } }));
}

export function ChatLiveSync() {
  const dispatch = useDispatch();
  const token = useSelector(selectToken);
  const user = useSelector(selectUser);
  const membershipId = user?.activeMembership?.id || '';
  const enabled = Boolean(token && user && hasActiveCompanyAccess(user));

  useEffect(() => {
    if (!enabled) return undefined;
    let controller = null;
    let retryId = null;
    let stopped = false;
    let connected = false;

    const syncAll = () => dispatch(baseApi.util.invalidateTags(CHAT_SYNC_TAGS));

    const handleEvent = (event, payload) => {
      const tags = [];
      const ownMessage = event === 'message' && payload?.authorMembershipId === membershipId;

      if ((event === 'message' && !ownMessage) || event === 'delete' || event === 'reaction') {
        tags.push({ type: 'Notifications', id: 'CHAT_MESSAGES' });
      }

      if ((event === 'message' && !ownMessage) || event === 'delete') {
        tags.push({ type: 'Notifications', id: 'CHAT_SUMMARY' });
      }

      if (event === 'read') {
        tags.push({ type: 'Notifications', id: 'CHAT_READ_STATES' });
      }

      if (event === 'presence') {
        tags.push({ type: 'Notifications', id: 'CHAT_PRESENCE' });
      }

      if (event === 'ready') {
        connected = true;
        emitConnectionState('connected');
        syncAll();
      }

      if (tags.length) dispatch(baseApi.util.invalidateTags(tags));
      window.dispatchEvent(new CustomEvent('worktrack:chat-live', { detail: { event, payload } }));
    };

    const stopConnection = () => {
      if (retryId) window.clearTimeout(retryId);
      retryId = null;
      controller?.abort();
      controller = null;
      connected = false;
    };

    const scheduleRetry = () => {
      if (stopped || document.visibilityState !== 'visible' || !navigator.onLine) return;
      emitConnectionState('reconnecting');
      retryId = window.setTimeout(() => {
        retryId = null;
        void start();
      }, 3000);
    };

    const start = async () => {
      if (stopped || document.visibilityState !== 'visible' || controller) return;
      if (!navigator.onLine) {
        emitConnectionState('offline');
        return;
      }

      emitConnectionState(connected ? 'reconnecting' : 'connecting');
      controller = new AbortController();
      const activeController = controller;
      try {
        await connectChatStream({ signal: activeController.signal, onEvent: handleEvent });
      } catch {
        // Reconnect below unless this connection was intentionally aborted.
      } finally {
        if (controller === activeController) controller = null;
      }

      if (!stopped && !activeController.signal.aborted) {
        connected = false;
        if (!navigator.onLine) emitConnectionState('offline');
        else scheduleRetry();
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        syncAll();
        void start();
      } else {
        stopConnection();
      }
    };

    const handleOnline = () => {
      emitConnectionState('connecting');
      syncAll();
      void start();
    };

    const handleOffline = () => {
      stopConnection();
      emitConnectionState('offline');
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    emitConnectionState(navigator.onLine ? 'connecting' : 'offline');
    void start();

    return () => {
      stopped = true;
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      stopConnection();
    };
  }, [dispatch, enabled, membershipId]);

  return null;
}
