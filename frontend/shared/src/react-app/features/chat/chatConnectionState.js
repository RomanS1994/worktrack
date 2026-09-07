let currentState = typeof navigator !== 'undefined' && navigator.onLine ? 'connecting' : 'offline';

export function getChatConnectionState() {
  return currentState;
}

export function setChatConnectionState(state) {
  if (!state || state === currentState) return;
  currentState = state;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('worktrack:chat-connection', { detail: { state } }));
  }
}
