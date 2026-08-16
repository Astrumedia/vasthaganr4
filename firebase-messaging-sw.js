/* Firebase Cloud Messaging service worker for Västhaga Nr4. */
importScripts('https://www.gstatic.com/firebasejs/11.0.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.0.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyBQHkQql41jioZ1LbF8MdxBFoKmUifqWlo',
  authDomain: 'vasthaganr4.firebaseapp.com',
  projectId: 'vasthaganr4',
  storageBucket: 'vasthaganr4.firebasestorage.app',
  messagingSenderId: '547846391741',
  appId: '1:547846391741:web:048eb47b28d1027539f4d4'
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const data = payload?.data || {};

  const title = data.title || 'Västhaga Nr4';
  const body = data.body || 'Ny information finns på hemsidan.';
  const url = data.url || '/styrelseninformerar.html';

  self.registration.showNotification(title, {
    body,
    icon: '/logga.png',
    badge: '/logga.png',
    data: { url },
    tag: data.tag || 'vasthaga-update',
    renotify: true
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification?.data?.url || '/styrelseninformerar.html';
  const absoluteUrl = new URL(targetUrl, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          if ('navigate' in client) client.navigate(absoluteUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(absoluteUrl);
      return undefined;
    })
  );
});
