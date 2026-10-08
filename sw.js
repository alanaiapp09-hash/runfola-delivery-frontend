// Service Worker — Runfola Delivery Push
self.addEventListener('push', event => {
  if(!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body:  data.body,
      icon:  'https://i.imgur.com/J3rvA7x.png',
      badge: 'https://i.imgur.com/J3rvA7x.png',
      tag:   'runfola-' + (data.orderId || 'order'),
      renotify: true,
      data: { orderId: data.orderId }
    })
  );
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type:'window', includeUncontrolled:true }).then(list => {
      if(list.length){ list[0].focus(); return; }
      return clients.openWindow('/');
    })
  );
});
