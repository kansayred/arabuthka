// Service Worker — Арабутка v2.2.20260304
const CACHE_VERSION = '2.2.20260304';
const CACHE_NAME = `arabuthka-${CACHE_VERSION}`;

const urlsToCache = [
  '/', '/index.html',
  '/style.css', '/design-tokens.css', '/components.css',
  '/miniPlayer.css', '/onboarding.css', '/ui-extras.css', '/dialogs.css',
  '/app.js', '/app-ui.js', '/mediaSession.js', '/config.js',
  '/searchMusic.js', '/playlists.js', '/miniPlayer.js',
  '/gradients.js', '/onboarding.js', '/network.js',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  console.log(`[SW] Установка версии ${CACHE_VERSION}`);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Кэширование файлов приложения');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.error('[SW] Ошибка кэширования:', error);
      })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log(`[SW] Активация версии ${CACHE_VERSION}`);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[SW] Удаление устаревшего кэша:', name);
            return caches.delete(name);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Не кэшируем API-запросы, чужие домены и не-GET запросы
  if (url.origin !== self.location.origin || event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
