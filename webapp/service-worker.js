const CACHE_NAME = 'arabuthka-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/mediaSession.js',
  '/manifest.json'
];

// Установка Service Worker и кэширование файлов
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Кэширование файлов приложения');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.error('Ошибка кэширования:', error);
      })
  );
  self.skipWaiting(); // Активировать новый SW сразу
});

// Активация Service Worker и очистка старых кэшей
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Удаление старого кэша:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim(); // Взять под контроль все вкладки
});

// Обработка запросов: сеть с fallback на кэш
self.addEventListener('fetch', (event) => {
  // Не кэшируем API запросы и динамический контент
  if (event.request.url.includes('/api/') || 
      event.request.url.includes('/tracks/') ||
      event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Клонируем ответ перед кэшированием
        const responseToCache = response.clone();
        
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        
        return response;
      })
      .catch(() => {
        // Если сеть недоступна, используем кэш
        return caches.match(event.request);
      })
  );
});
