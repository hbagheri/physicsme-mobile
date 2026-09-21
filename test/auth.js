/* =====================================================================
   Membership gate + sign-up.

   Run a static server on the repo root first, then:
       node test/auth.js
   Override the address with BASE=http://host:port node test/auth.js

   Two halves, and they are deliberately different in kind.

   The server half talks to physicsme.ir directly with fetch, because a gate
   that only exists in the app is a curl away from being no gate at all —
   checking it through the UI would prove the wrong thing.

   The app half never reaches the network for the locked article: the 402 is
   injected with route interception. The gate is off on the live site until
   the app that knows how to sign up is on phones, and a test that waits for
   production to change is a test that does not run today.
   ===================================================================== */

import { chromium, devices } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const BASE = process.env.BASE || 'http://127.0.0.1:8788';
const API = 'https://physicsme.ir/wp-json/pm/v1';
const SHOTS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'screens');
fs.mkdirSync(SHOTS, { recursive: true });

// Chapter 1 of دهم ریاضی is the free one; `fasl-1` is unique to that book,
// so nothing else is unlocked by accident.
const FREE_ARTICLE = 'physics-danesh-bonyadi';
const PAID_ARTICLE = 'halat-haye-madde';

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail: detail || '' });
  console.log((ok ? '  ok   ' : '  FAIL ') + name + (ok || !detail ? '' : ' — ' + detail));
}

const nocache = () => '?cb=' + Math.random().toString(36).slice(2);

/* ---- 1. the free chapter answers a signed-out reader ---- */
const freeRes = await fetch(API + '/articles/' + FREE_ARTICLE + nocache());
check('1. the free chapter opens without an account', freeRes.status === 200,
      'HTTP ' + freeRes.status);

/* ---- 2. the gate, whichever side of the switch it is on ----
   `pm_gate_enabled` is off until the app ships, so this reports which mode
   the server is in rather than pretending there is only one. */
const paidRes = await fetch(API + '/articles/' + PAID_ARTICLE + nocache());
const gateOn = paidRes.status === 402;
if (gateOn) {
  const body = await paidRes.json().catch(() => ({}));
  check('2. a chapter behind the gate answers 402 membership_required',
        body.error && body.error.code === 'membership_required',
        JSON.stringify(body).slice(0, 120));
} else {
  check('2. gate is off on the server (pm_gate_enabled = 0)', paidRes.status === 200,
        'HTTP ' + paidRes.status + ' — expected 200 while the gate is off');
}

/* ---- 3. lists stay open on purpose ----
   Someone who cannot see what is behind the gate has no reason to walk
   through it, so titles are never gated — only the teaching is. */
const listRes = await fetch(API + '/chapters/fasl-2/articles' + nocache());
check('3. chapter lists stay readable without an account', listRes.status === 200,
      'HTTP ' + listRes.status);

/* ---- 4. the sign-up surface is alive and honest about itself ---- */
const meRes = await fetch(API + '/auth/me' + nocache());
const me = await meRes.json().catch(() => ({}));
check('4. /auth/me reports member:false and the usable methods',
      meRes.status === 200 && me.member === false && me.methods &&
      typeof me.methods.telegram === 'boolean' && typeof me.methods.email === 'boolean',
      JSON.stringify(me).slice(0, 160));

/* ---- 5. Telegram start hands back a deep link, not an account ---- */
let tgToken = '';
if (me.methods && me.methods.telegram) {
  const tgRes = await fetch(API + '/auth/tg/start', { method: 'POST' });
  const tg = await tgRes.json().catch(() => ({}));
  tgToken = tg.token || '';
  // The code is read off this screen and typed into Telegram, so the shape
  // matters: six characters, no 0/O and no 1/I/L.
  check('5. /auth/tg/start returns a t.me deep link, a bot name and a typeable code',
        tgRes.status === 200 && /^https:\/\/t\.me\/.+\?start=/.test(tg.deep_link || '') &&
        !!tg.bot && /^[2-9A-HJKMNP-Z]{6}$/.test(tgToken) && tg.code === tgToken,
        JSON.stringify(tg).slice(0, 160));
} else {
  check('5. /auth/tg/start returns a t.me deep link', false, 'Telegram method reported unavailable');
}

/* ---- 6. polling an unused token stays pending ----
   The credential must not exist before the bot has seen the /start. */
if (tgToken) {
  const pollRes = await fetch(API + '/auth/tg/poll?token=' + tgToken + '&cb=' + Math.random());
  const poll = await pollRes.json().catch(() => ({}));
  check('6. polling before the bot replies yields pending, no credential',
        poll.status === 'pending' && !poll.credential, JSON.stringify(poll).slice(0, 120));
} else {
  check('6. polling before the bot replies yields pending', false, 'no token to poll');
}

/* ---- 7. a junk token is refused rather than guessed at ---- */
const badRes = await fetch(API + '/auth/tg/poll?token=nonsense');
check('7. a malformed token is rejected with 400', badRes.status === 400,
      'HTTP ' + badRes.status);

/* ---- the app half ---- */

const browser = await chromium.launch();
// The service worker is switched off for this run. A request it handles is
// made from its own context and route interception never sees it, so the
// injected 402 below would silently go to the live server instead. The
// offline suite is where the worker itself is tested.
const ctx = await browser.newContext({ ...devices['iPhone 14'], serviceWorkers: 'block' });
const page = await ctx.newPage();

// Chromium logs every non-2xx response as a console error, and this run
// injects a 402 on purpose. That one line is the subject of the test, not a
// symptom — anything else still counts.
const consoleErrors = [];
page.on('console', m => {
  if (m.type() === 'error' && !/402/.test(m.text())) consoleErrors.push(m.text());
});
page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message));

// The gate is off on the live site, so the 402 is injected. What is under
// test here is the app's reaction, not the server's decision.
await page.route(new RegExp('/pm/v1/articles/' + PAID_ARTICLE), route =>
  route.fulfill({
    status: 402,
    contentType: 'application/json',
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ error: { code: 'membership_required', message: 'ثبت‌نام لازم است' } })
  })
);

await page.goto(BASE + '/index.html?desktop=1');
await page.waitForTimeout(400);
if (await page.isVisible('#onboard')) await page.click('#onb-skip');
await page.waitForTimeout(300);

/* ---- 8. every request carries a device id, signed in or not ----
   Inside the webview the guest cookie is third-party and gets dropped, so
   without this header the free AI allowance is no allowance at all. */
const deviceId = await page.evaluate(() => window.PMAuth.deviceId());
check('8. a UUIDv4 device id is minted and kept',
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(deviceId),
      deviceId);

const chatDevice = await page.evaluate(() => window.PMAuth.headers({})['X-PM-Device']);
check('9. chat requests send X-PM-Device', chatDevice === deviceId, chatDevice);

// …and content GETs do not, because a custom header on a cross-origin GET
// costs a preflight round trip per screen and only the chat quota reads it.
const contentDevice = await page.evaluate(() => window.PMAuth.contentHeaders({})['X-PM-Device']);
check('10. content GETs stay preflight-free', contentDevice === undefined, String(contentDevice));

/* ---- 11. a gated article shows the sign-up card, not the error screen ---- */
await page.locator('.orb').nth(0).click();
await page.waitForTimeout(700);
await page.locator('.orb').nth(0).click();          // رشتهٔ ریاضی
await page.waitForSelector('#s-list .row', { timeout: 15000 });

async function intoRow(n) {
  const before = await page.locator('#s-list .row').first().textContent();
  await page.locator('#s-list .row').nth(n).click();
  await page.waitForFunction(prev => {
    const r = document.querySelector('#s-list .row');
    return !r || r.textContent !== prev;
  }, before, { timeout: 15000 });
}

await intoRow(0);   // دهم ریاضی
await intoRow(1);   // فصل ۲ — the chapter the gate closes
await page.locator('#s-list .row').nth(0).click();
await page.waitForSelector('#s-reader .locked', { timeout: 15000 });

check('11. a gated article shows the sign-up card',
      await page.isVisible('#locked-join'), 'no join button on the reader');
await page.screenshot({ path: path.join(SHOTS, '21-locked.png') });

/* ---- 12. the card leads to the sign-up screen ---- */
await page.click('#locked-join');
await page.waitForSelector('#auth-tg, #auth-em, #auth-state .card', { timeout: 15000 });
check('12. the card opens the sign-up screen',
      await page.getAttribute('.screen.is-on', 'id') === 's-auth');
await page.screenshot({ path: path.join(SHOTS, '22-gate-signup.png') });

/* ---- 13. no credential means no Authorization header ---- */
const anonHeader = await page.evaluate(() => window.PMAuth.contentHeaders({}).Authorization);
check('13. a signed-out app sends no Authorization', anonHeader === undefined, String(anonHeader));

/* ---- 14. a credential is used once it exists ---- */
const withCred = await page.evaluate(() => {
  window.PMAuth.setCredential('dGVzdDp0ZXN0');
  const h = window.PMAuth.contentHeaders({}).Authorization;
  window.PMAuth.clear();
  return h;
});
check('14. a stored credential goes out as Basic auth', withCred === 'Basic dGVzdDp0ZXN0', withCred);

check('15. zero console errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));

await browser.close();

const failed = results.filter(r => !r.ok);
console.log('\n' + (results.length - failed.length) + '/' + results.length + ' passed' +
            (gateOn ? '' : ' · server gate is OFF (pm_gate_enabled = 0)'));
process.exit(failed.length ? 1 : 0);
