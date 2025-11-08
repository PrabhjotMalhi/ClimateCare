self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'ClimateCare AI';
  const options = {
    body: data.body || 'New alert',
    icon: data.icon || '/favicon.png',
    badge: '/favicon.png',
    data: data.data,
    requireInteraction: true,
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
});
