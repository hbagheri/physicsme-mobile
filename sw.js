/* =====================================================================
   Service worker — app-shell cache
   ---------------------------------------------------------------------
   iOS evicts a non-installed site's caches after roughly seven days of
   disuse, and caps storage around 50MB. So: cache the shell, never try
   to cache the whole library offline. Articles use network-first with a
   cache fallback, which is the honest trade for a reading app.
   ===================================================================== */

var VERSION = 'v8';
var SHELL = 'shell-' + VERSION;

// Articles the reader chose to keep. Written by the page, never by this
// worker — the app must not quietly fill a phone with everything that was
// scrolled past. Not versioned: a shell upgrade must not throw away a
// library someone built on purpose.
var SAVED = 'pm-saved';

var SHELL_FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './src/styles/tokens.css',
  './src/styles/app.css',
  './src/styles/chat.css',
  './src/js/i18n.js',
  './src/js/auth.js',
  './src/js/chat.js',
  './src/js/app.js',
  './vendor/fonts/fonts.css',
  './vendor/fonts/vazirmatn/Vazirmatn-Regular.woff2',
  './vendor/fonts/vazirmatn/Vazirmatn-Medium.woff2',
  './vendor/fonts/vazirmatn/Vazirmatn-SemiBold.woff2',
  './vendor/fonts/vazirmatn/Vazirmatn-Bold.woff2',
  './vendor/fonts/jetbrains-mono/JetBrainsMono-Regular.woff2',
  './vendor/marked/marked.min.js',
  './vendor/mathjax/tex-chtml.js'
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
        if (k !== SHELL && k !== SAVED) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);

  // Content API: network first, and offline fall back to the saved library
  // only. Nothing is written here — reading an article is not a request to
  // keep it, and a worker that cached every response would silently spend a
  // phone's storage and then evict the shell to keep going.
  //
  // This runs before the same-origin guard on purpose: inside the packaged
  // app the page is served from https://localhost and every article is
  // cross-origin, so a guard-first order would mean no offline reading.
  if (url.pathname.indexOf('/wp-json/') !== -1) {
    e.respondWith(
      fetch(req).catch(function () {
        return caches.open(SAVED).then(function (c) { return c.match(req); });
      })
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Pyodide is ~26MB. iOS caps a web app's storage near 50MB, so caching it
  // would evict the shell and the articles to hold a feature most sessions
  // never touch. It is served from disk in the packaged app anyway.
  if (url.pathname.indexOf('/vendor/pyodide/') !== -1) return;

  // MathJax pulls its font and extension chunks lazily; cache whatever it
  // actually asks for rather than guessing the list up front.
  if (url.pathname.indexOf('/vendor/mathjax/') !== -1) {
    e.respondWith(
      caches.match(req).then(function (hit) {
        return hit || fetch(req).then(function (res) {
          var copy = res.clone();
          caches.open(SHELL).then(function (c) { c.put(req, copy); });
          return res;
        });
      })
    );
    return;
  }

  // Navigations always end at the shell. caches.match is exact by default, so
  // "?desktop=1" — or any shared link that picked up a query — misses the
  // precached "./index.html" and falls through to a fetch that fails offline.
  // ignoreSearch covers the query case, the catch covers deep paths.
  if (req.mode === 'navigate') {
    e.respondWith(
      caches.match(req, { ignoreSearch: true }).then(function (hit) {
        return hit || fetch(req).catch(function () {
          return caches.match('./index.html');
        });
      })
    );
    return;
  }

  // Shell: cache first.
  e.respondWith(
    caches.match(req).then(function (hit) { return hit || fetch(req); })
  );
});
