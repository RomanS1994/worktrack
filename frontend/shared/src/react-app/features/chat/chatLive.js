import { getToken } from '../auth/authStorage.js';

function resolveApiBaseUrl() {
  if (import.meta.env.DEV) {
    return import.meta.env.VITE_API_BASE_URL_TEST || import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
  }
  return import.meta.env.VITE_API_BASE_URL || '/api';
}

function chatStreamUrl() {
  return `${resolveApiBaseUrl().replace(/\/$/, '')}/chat/stream`;
}

export async function connectChatStream({ signal, onEvent }) {
  const headers = { Accept: 'text/event-stream' };
  const apiKey = import.meta.env.VITE_API_KEY;
  const token = getToken();
  if (apiKey) headers['X-API-KEY'] = apiKey;
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(chatStreamUrl(), {
    method: 'GET',
    headers,
    credentials: 'include',
    cache: 'no-store',
    signal,
  });

  if (!response.ok || !response.body) {
    throw new Error(`Chat stream failed (${response.status})`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (!signal.aborted) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let boundary = buffer.indexOf('\n\n');
    while (boundary >= 0) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf('\n\n');
      if (!block || block.startsWith(':')) continue;
      let event = 'message';
      let data = '';
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        if (line.startsWith('data:')) data += line.slice(5).trim();
      }
      if (!data) continue;
      try {
        onEvent?.(event, JSON.parse(data));
      } catch {
        // Ignore malformed stream events and keep the connection alive.
      }
    }
  }
}
