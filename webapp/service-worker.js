// Версия кэша — при обновлении кода меняем это значение,
// чтобы Service Worker вычистил устаревший кэш у пользователей.
// Формат: arabuthka-v{мажор}.{минор}.{дата}
const CACHE_VERSION = '2.1.20260227';
const CACHE_NAME = `arabuthka-${CACHE_VERSION}`;

const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/mediaSession.js',
    '/config.js',
  '/utils.js',
  '/audioPlayer.js',
  '/playerUI.js',
  '/searchMusic.js',
  '/manifest.json'
];

// Установка Service Worker и кэширование файлов
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
  // Активировать новый SW сразу, не ждать закрытия вкладок
  self.skipWaiting();
});

// Активация — удаляем все кэши от предыдущих версий
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
  // Берём под контроль все открытые вкладки
  self.clients.claim();
});

// Обработка запросов: сеть с fallback на кэш
// API-запросы и запросы к другим доменам не кэшируем
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Не трогаем запросы к API (Railway), к другим доменам и не-GET запросы
  if (url.origin !== self.location.origin ||
      event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Проверяем что ответ валидный перед кэшированием
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
        // Сеть недоступна — отдаём из кэша
        return caches.match(event.request);
      })
  );
});
