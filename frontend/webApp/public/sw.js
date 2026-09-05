self.addEventListener('push', event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { message: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'WorkTrack';
  const options = {
    body: data.message || data.body || '',
    icon: '/shared/assets/worktrack-icon-192.png',
    badge: '/shared/assets/worktrack-icon-192.png',
    tag: data.id || data.type || 'worktrack-notification',
    data: { href: data.href || '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
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
