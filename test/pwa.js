/* =====================================================================
   PWA install checks — the things that decide whether "Add to Home
   Screen" produces a real app rather than a bookmark.

   Run a static server on the repo root first, then:
       node test/pwa.js
   ===================================================================== */

import { chromium, devices } from 'playwright';

const BASE = process.env.BASE || 'http://127.0.0.1:8788';
const results = [];

function check(name, ok, detail) {
  results.push({ name, ok: !!ok });
  console.log((ok ? '  ok   ' : '  FAIL ') + name + (ok || !detail ? '' : ' — ' + detail));
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 14'] });
const page = await ctx.newPage();

await page.goto(BASE + '/index.html?desktop=1');
if (await page.isVisible('#onboard')) await page.click('#onb-skip');

/* ---- 1. manifest is linked, parses, and has what iOS/Android need ---- */
const mfUrl = await page.getAttribute('link[rel=manifest]', 'href');
const mf = await page.evaluate(u => fetch(u).then(r => r.json()), mfUrl);
const need192 = mf.icons.some(i => i.sizes === '192x192');
const need512 = mf.icons.some(i => i.sizes === '512x512' && i.purpose === 'any');
const maskable = mf.icons.some(i => i.purpose === 'maskable');
check('1. manifest: standalone, scope, 192 + 512 + maskable icons',
      mf.display === 'standalone' && mf.scope && need192 && need512 && maskable,
      'display=' + mf.display + ' 192=' + need192 + ' 512=' + need512 + ' maskable=' + maskable);

/* ---- 2. every declared icon actually resolves ---- */
const iconUrls = mf.icons.map(i => i.src)
  .concat([await page.getAttribute('link[rel="apple-touch-icon"]', 'href')]);
const codes = await page.evaluate(
  us => Promise.all(us.map(u => fetch(u).then(r => r.status).catch(() => 0))), iconUrls);
check('2. every icon in the manifest and apple-touch-icon resolves',
      codes.every(c => c === 200), iconUrls.map((u, i) => u + '=' + codes[i]).join(' '));

/* ---- 3. the iOS meta tags iOS actually reads ---- */
const meta = await page.evaluate(() => ({
  capable: document.querySelector('meta[name="apple-mobile-web-app-capable"]')?.content,
  title: document.querySelector('meta[name="apple-mobile-web-app-title"]')?.content,
  bar: document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')?.content,
  fit: document.querySelector('meta[name=viewport]')?.content.includes('viewport-fit=cover'),
}));
check('3. apple-mobile-web-app meta tags + viewport-fit=cover',
      meta.capable === 'yes' && !!meta.title && !!meta.bar && meta.fit,
      JSON.stringify(meta));

/* ---- 4. the Add-to-Home-Screen tip appears on iPhone, not when installed ---- */
await page.waitForTimeout(2800);
const tipShown = await page.isVisible('#ios-tip');
await page.click('#ios-tip-close');
await page.waitForTimeout(200);
const tipDismissed = !(await page.isVisible('#ios-tip'));
// a second visit must not nag again
const p2 = await ctx.newPage();
await p2.goto(BASE + '/index.html?desktop=1');
await p2.waitForTimeout(2900);
const tipStaysGone = !(await p2.isVisible('#ios-tip'));
await p2.close();
check('4. install tip shows once on iPhone, then stays dismissed',
      tipShown && tipDismissed && tipStaysGone,
      'shown=' + tipShown + ' dismissed=' + tipDismissed + ' stayedGone=' + tipStaysGone);

/* ---- 5. service worker reaches "activated" ---- */
const swState = await page.evaluate(() =>
  navigator.serviceWorker.ready.then(r => r.active && r.active.state)
    .catch(e => 'error: ' + e.message));
check('5. service worker activates', swState === 'activated', String(swState));

/* ---- 6. the whole shell is in the cache, not just index.html ---- */
// The app can be served from the root or from a subpath (physicsme.ir/app/),
// so the expected paths are resolved against the document rather than assumed
// to start at "/".
const missing = await page.evaluate(() =>
  caches.keys()
    .then(ks => Promise.all(ks.map(k => caches.open(k).then(c => c.keys()))))
    .then(lists => {
      const have = new Set([].concat(...lists).map(r => new URL(r.url).pathname));
      return ['index.html', 'src/js/app.js', 'src/js/chat.js', 'src/js/i18n.js',
              'src/styles/tokens.css', 'src/styles/app.css', 'src/styles/chat.css',
              'vendor/marked/marked.min.js', 'manifest.webmanifest']
        .map(p => new URL(p, location.href).pathname)
        .filter(p => !have.has(p));
    }));
check('6. app shell is precached', missing.length === 0, 'missing ' + missing.join(', '));

/* ---- 7. Pyodide is deliberately NOT in the cache (iOS 50MB cap) ---- */
const pyCached = await page.evaluate(() =>
  caches.keys()
    .then(ks => Promise.all(ks.map(k => caches.open(k).then(c => c.keys()))))
    .then(ls => [].concat(...ls).some(r => r.url.includes('/vendor/pyodide/'))));
check('7. Pyodide stays out of the cache', !pyCached);

/* ---- 8. cold boot with the network cut ---- */
const off = await browser.newContext({ ...devices['iPhone 14'], offline: false });
const offPage = await off.newPage();
await offPage.goto(BASE + '/index.html?desktop=1');
await offPage.evaluate(() => navigator.serviceWorker.ready);
await offPage.waitForTimeout(600);
await off.setOffline(true);
await offPage.reload();
await offPage.waitForTimeout(900);
if (await offPage.isVisible('#onboard')) await offPage.click('#onb-skip');
await offPage.waitForTimeout(400);
const orbsOffline = await offPage.locator('.orb').count();
const fontOffline = await offPage.evaluate(() =>
  getComputedStyle(document.body).fontFamily.toLowerCase().includes('vazirmatn'));
check('8. reloads offline with the circles and the Persian font',
      orbsOffline === 4 && fontOffline,
      orbsOffline + ' circles, vazirmatn=' + fontOffline);
await offPage.screenshot({ path: 'test/screens/17-offline.png' });
await off.close();

await browser.close();
const failed = results.filter(r => !r.ok);
console.log('\n' + (results.length - failed.length) + '/' + results.length + ' passed');
process.exit(failed.length ? 1 : 0);
