// Service Worker pour OptiTime PWA
const CACHE_NAME = 'optitime-v1';
const urlsToCache = [
  './',
  './index.html',
  './agenda.html',
  './pointeuse.html',
  './style.css',
  './script.js',
  './theme.js',
  './clock.js',
  './notification-sound.js',
  './manifest.json',
  './agenda.csv',
  './log.csv'
];

// Installation
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Cache ouvert');
        return cache.addAll(urlsToCache);
      })
  );
});

// Activation
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Suppression de l\'ancien cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch - Stratégie Cache First
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Retourner la réponse du cache si disponible
        if (response) {
          return response;
        }
        // Sinon, faire une requête réseau
        return fetch(event.request).then((response) => {
          // Vérifier si la réponse est valide
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          // Cloner la réponse
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });
          return response;
        });
      })
      .catch(() => {
        // En cas d'erreur, retourner une page offline si disponible
        if (event.request.destination === 'document') {
          return caches.match('./index.html') || caches.match('./agenda.html');
        }
      })
  );
});

