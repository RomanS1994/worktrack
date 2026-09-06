const PUSH_PREFERENCES_CACHE = 'worktrack-push-preferences-v1';
const PUSH_PREFERENCES_KEY = '/__worktrack_push_preferences__';
const DEFAULT_PREFERENCES = {
  categories: { hours: true, finance: true, chat: true, team: true, system: true },
  quietHours: { enabled: false, start: '22:00', end: '07:00' },
};

function categoryForType(type = '') {
  if (type.startsWith('weekly_submission.')) return 'hours';
  if (type.startsWith('invoice.')) return 'finance';
  if (type === 'chat.message' || type.startsWith('chat.')) return 'chat';
  if (type.startsWith('team.') || type.startsWith('employee.') || type.startsWith('project.')) return 'team';
  return 'system';
}

function timeToMinutes(value, fallback) {
  const match = String(value || '').match(/^(\d{2}):(\d{2})$/);
  if (!match) return fallback;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return fallback;
  return hours * 60 + minutes;
}

function isWithinQuietHours(quietHours) {
  if (!quietHours?.enabled) return false;
  const now = new Date();
  const current = now.getHours() * 60 + now.getMinutes();
  const start = timeToMinutes(quietHours.start, 22 * 60);
  const end = timeToMinutes(quietHours.end, 7 * 60);
  if (start === end) return true;
  if (start < end) return current >= start && current < end;
  return current >= start || current < end;
}

async function readPushPreferences() {
  try {
    const cache = await caches.open(PUSH_PREFERENCES_CACHE);
    const response = await cache.match(PUSH_PREFERENCES_KEY);
    if (!response) return DEFAULT_PREFERENCES;
    const stored = await response.json();
    return {
      categories: { ...DEFAULT_PREFERENCES.categories, ...(stored?.categories || {}) },
      quietHours: { ...DEFAULT_PREFERENCES.quietHours, ...(stored?.quietHours || {}) },
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

self.addEventListener('message', event => {
  if (event.data?.type !== 'WORKTRACK_PUSH_PREFERENCES') return;
  event.waitUntil((async () => {
    const cache = await caches.open(PUSH_PREFERENCES_CACHE);
    await cache.put(PUSH_PREFERENCES_KEY, new Response(JSON.stringify(event.data.preferences || DEFAULT_PREFERENCES), {
      headers: { 'content-type': 'application/json' },
    }));
  })());
});

self.addEventListener('push', event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { message: event.data ? event.data.text() : '' };
  }

  event.waitUntil((async () => {
    const preferences = await readPushPreferences();
    const category = categoryForType(String(data.type || ''));
    if (preferences.categories?.[category] === false) return;
    if (isWithinQuietHours(preferences.quietHours)) return;

    const title = data.title || 'WorkTrack';
    const options = {
      body: data.message || data.body || '',
      icon: '/shared/assets/worktrack-icon-192.png',
      badge: '/shared/assets/worktrack-icon-192.png',
      tag: data.id || data.type || 'worktrack-notification',
      data: { href: data.href || '/' },
    };

    await self.registration.showNotification(title, options);
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification.data?.href || '/', self.location.origin).href;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(openClients => {
      for (const client of openClients) {
        if ('navigate' in client) client.navigate(target);
        if ('focus' in client) return client.focus();
      }
      return clients.openWindow ? clients.openWindow(target) : undefined;
    })
  );
});
