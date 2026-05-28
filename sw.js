'use strict';

// Bump this string whenever you push an update and want users to get the
// new version on their next (briefly-online) visit. The activate handler
// below deletes every cache whose name doesn't match.
const CACHE_NAME = 'rmp-studio-v4';

// Template files are only fetched on demand (when a user generates a document)
// so the runtime cache-first handler never gets a chance to cache them on
// first page load. Pre-caching them here guarantees they're available offline
// even if the user never generated that document type while online.
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './sw.js',
  // DOCX / XLSX / image templates
  './templates/RSR_TEMPLATE.docx',
  './templates/Road_Space_Request_Form_TEMPLATE.docx',
  './templates/Residential_Letter_Template (1).docx',
  './templates/TC_BoQ_JMCA_TEMPLATE.xlsx',
  './templates/RMP_Design_Master_Workbook.xlsx',
  './templates/signature.png',
  // Scheme sketch PDFs
  './templates/Ambleside Avenue.pdf',
  './templates/Derwent Avenue.pdf',
  './templates/Dunholm Road.pdf',
  './templates/Guthrie Terrace.pdf',
  './templates/Marryat Street.pdf',
  './templates/Saggar Street.pdf',
  './templates/Seagate.pdf',
  // PCI XML samples
  './assets/samples/pci_blank.xml',
  './assets/samples/pci_signed.xml',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

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
