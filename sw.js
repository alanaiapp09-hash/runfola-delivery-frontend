// Service Worker — Runfola Delivery PWA + Push
// Sube la versión del nombre de caché en cada despliegue para forzar la limpieza de cachés viejas.
const CACHE_VERSION = 'runfola-v6';
const CACHE_HTML = `${CACHE_VERSION}-html`;
const CACHE_ASSETS = `${CACHE_VERSION}-assets`;

const OFFLINE_URL = '/offline.html';
const PRECACHE = [OFFLINE_URL, '/icons/icon-192.png'];

// Nunca se cachea nada de estos destinos: backend (Railway), pagos (SumUp), websockets.
function esNoCacheable(url) {
  return (
    url.hostname.includes('railway.app') ||
    url.hostname.includes('sumup.com') ||
    url.protocol === 'ws:' ||
    url.protocol === 'wss:'
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_ASSETS).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((nombres) =>
      Promise.all(
        nombres
          .filter((n) => n.startsWith('runfola-') && n !== CACHE_HTML && n !== CACHE_ASSETS)
          .map((n) => caches.delete(n))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (esNoCacheable(url)) return; // deja pasar sin interceptar

  const esHtml = req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html');

  if (esHtml) {
    // Red primero: la carta y los precios siempre salen actualizados. Caché solo si no hay conexión.
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copia = res.clone();
          caches.open(CACHE_HTML).then((cache) => cache.put(req, copia));
          return res;
        })
        .catch(() =>
          caches.match(req).then((cacheado) => cacheado || caches.match(OFFLINE_URL))
        )
    );
    return;
  }

  // Imágenes, iconos, fuentes: caché con actualización en segundo plano (stale-while-revalidate).
  event.respondWith(
    caches.match(req).then((cacheado) => {
      const fetchPromise = fetch(req)
        .then((res) => {
          if (res.ok) caches.open(CACHE_ASSETS).then((cache) => cache.put(req, res.clone()));
          return res;
        })
        .catch(() => cacheado);
      return cacheado || fetchPromise;
    })
  );
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data;
  try { data = event.data.json(); } catch (e) { return; }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Runfola Pizzas', {
      body: data.body || '',
      icon: data.icon || 'https://delivery.runfolapizzas.com/icons/icon-192.png',
      badge: data.badge || 'https://delivery.runfolapizzas.com/icons/badge-96.png',
      image: data.image || undefined,
      tag: 'runfola-' + (data.orderId || 'promo'),
      renotify: true,
      data: { url: data.url || '/' }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((lista) => {
      for (const cliente of lista) {
        if (cliente.url === url && 'focus' in cliente) return cliente.focus();
      }
      return clients.openWindow(url);
    })
  );
});
