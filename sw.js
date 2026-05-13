'use strict';

// Bump this string whenever you push an update and want users to get the
// new version on their next (briefly-online) visit. The activate handler
// below deletes every cache whose name doesn't match.
const CACHE_NAME = 'rmp-studio-v1';

// Cache-first with background population. Every GET response (local files
// AND cross-origin CDN scripts) is cached on first load, then served from
// cache on subsequent loads — including when the device is fully offline
// or after GitHub Pages has been made private/disabled.
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      cache.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          // Only cache successful, non-opaque responses so we don't
          // poison the cache with redirect or error pages.
          if (response && response.ok) {
            cache.put(event.request, response.clone());
          }
          return response;
        });
      })
    )
  );
});

// When a new SW version takes over, delete all caches from previous versions.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});
