/* Push payloads never become trusted text or navigation URLs. No offline API cache. */
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    /* Generic notice remains safe. */
  }
  event.waitUntil(
    self.registration.showNotification('نارنج', {
      body: 'اعلان تازه‌ای دارید. برای بررسی، برنامه را باز کنید.',
      tag: 'restaurantos-inbox',
      renotify: false,
      silent: payload.silent !== false,
      data: { url: new URL('/?notifications=1', self.registration.scope).href },
    }),
  );
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL('/?notifications=1', self.registration.scope).href;
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(async (clients) => {
        for (const client of clients)
          if (new URL(client.url).origin === self.location.origin) {
            await client.navigate(target);
            return client.focus();
          }
        return self.clients.openWindow(target);
      }),
  );
});
