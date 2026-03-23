/**
 * Service Worker for Namaz Vakitleri App
 * Updates: Modified to Stale-While-Revalidate strategy.
 * This shows cached content immediately but updates in background.
 */
const CACHE_NAME = 'namaz-vakitleri-v3-local-icon';
const ASSETS_TO_CACHE = [
    './',
    './index.html',

    './index-EhThZ-WV.js',
    './manifest-CZT9gpFN.json',
    './icon.png',
    'https://cdn.tailwindcss.com',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
    // 'https://cdn-icons-png.flaticon.com/512/4358/4358667.png' // Removed external dependency
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            // Force update of assets immediately
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    // Activate immediately without waiting for existing clients to close
    self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            // Return cached response immediately if found
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                // Update cache with new version in background
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, networkResponse.clone());
                });
                return networkResponse;
            }).catch(() => {
                // If network fails and no cache, return match (which might be undefined, triggering error)
                // Ideally we could return a fallback page here
            });

            // If we have cached response, return it, but still trigger fetchPromise for next time
            return cachedResponse || fetchPromise;
        })
    );
});

self.addEventListener('activate', (event) => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    // Claim clients immediately so they are controlled by latest SW
    self.clients.claim();
});
