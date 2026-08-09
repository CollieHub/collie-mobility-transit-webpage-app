const CACHE_NAME = 'collie-transit-static-v1.0.178-prod';
const MAP_CACHE_NAME = 'map-tiles-cache';

// Archivos estáticos mínimos que queremos cachear inmediatamente durante la instalación
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/assets/images/favicon.png'
];

// Instalar Service Worker y guardar los recursos mínimos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(PRECACHE_ASSETS).catch((err) => {
          console.warn('[SW] Error en pre-cacheo inicial:', err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

// Activar Service Worker y limpiar cachés viejos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== MAP_CACHE_NAME) {
            console.log('[SW] Borrando caché obsoleta:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Interceptar peticiones y decidir política de caché
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // 1. Ignorar peticiones de API dinámicas (tiempo real, telemetría y websockets)
  // Las llamadas a /transit/buses/live o /catalog/public/* nunca deben ser interceptadas de forma restrictiva
  if (url.pathname.includes('/transit/buses/live') || url.pathname.includes('/catalog/public/') || request.method !== 'GET') {
    return;
  }

  // 2. Política para mosaicos de mapas (CartoDB voyager tiles)
  // Dominios de CartoDB: basemaps.cartocdn.com o similar
  if (url.host.includes('basemaps.cartocdn.com') || url.pathname.includes('rastertiles')) {
    const cleanUrl = request.url.replace('@2x.png', '.png');
    event.respondWith(
      caches.open(MAP_CACHE_NAME).then((cache) => {
        return cache.match(cleanUrl).then((cachedResponse) => {
          if (cachedResponse) {
            // Estrategia Cache-First: Devolver del caché si ya está guardado
            return cachedResponse;
          }
          // Si no está, buscar en la red (usando la petición original) y guardar bajo la url limpia
          return fetch(request).then((networkResponse) => {
            if (networkResponse.status === 200) {
              cache.put(cleanUrl, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => {
            // Fallback silencioso si no hay conexión
            return new Response('Offline tile not available', { status: 503 });
          });
        });
      })
    );
    return;
  }

  // 3. Estrategia Network-First para documentos HTML (asegura actualización inmediata al abrir o refrescar)
  if (url.protocol.startsWith('http') && (url.pathname === '/' || url.pathname === '/index.html' || url.pathname.startsWith('/privacy'))) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse.status === 200) {
            const cacheResponse = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, cacheResponse));
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(request);
        })
    );
    return;
  }

  // 4. Estrategia Stale-While-Revalidate para recursos estáticos (JS, CSS, imágenes, fuentes)
  if (url.protocol.startsWith('http') && url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|woff2|ico)$/)) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          const fetchPromise = fetch(request).then((networkResponse) => {
            if (networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          }).catch((err) => {
            console.log('[SW] Fallo de red para recurso estático:', url.pathname, err);
          });
          return cachedResponse || fetchPromise;
        });
      })
    );
  }
});
