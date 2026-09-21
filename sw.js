/* =====================================================================
   Service worker — app-shell cache
   ---------------------------------------------------------------------
   iOS evicts a non-installed site's caches after roughly seven days of
   disuse, and caps storage around 50MB. So: cache the shell, never try
   to cache the whole library offline. Articles use network-first with a
   cache fallback, which is the honest trade for a reading app.
   ===================================================================== */

var VERSION = 'v1';
var SHELL = 'shell-' + VERSION;
var DATA  = 'data-' + VERSION;

var SHELL_FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './src/styles/tokens.css',
  './src/styles/app.css',
  './src/js/app.js'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(SHELL).then(function (c) { return c.addAll(SHELL_FILES); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== SHELL && k !== DATA) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);

  // Never cache cross-origin (fonts come from Google's own CDN cache).
  if (url.origin !== self.location.origin) return;

  // Content API: network first, fall back to what we have.
  if (url.pathname.indexOf('/wp-json/') !== -1) {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(DATA).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () { return caches.match(req); })
    );
    return;
  }

  // Shell: cache first.
  e.respondWith(
    caches.match(req).then(function (hit) { return hit || fetch(req); })
  );
});
