/* =====================================================================
   Ask a teacher → the answer comes back.

   Run a static server on the repo root first, then:
       node test/inbox.js
   Override the address with BASE=http://host:port node test/inbox.js

   Same split as test/auth.js. The server half talks to physicsme.ir for
   real, because a queue a stranger can write to is a queue that will be
   filled by strangers. The app half never posts anything to production —
   /ask and /questions are intercepted — so this runs as often as it likes
   without leaving rows behind for someone to answer.
   ===================================================================== */

import { chromium, devices } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const BASE = process.env.BASE || 'http://127.0.0.1:8788';
const API = 'https://physicsme.ir/wp-json/pm/v1';
const SHOTS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'screens');
fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail: detail || '' });
  console.log((ok ? '  ok   ' : '  FAIL ') + name + (ok || !detail ? '' : ' — ' + detail));
}

const nocache = () => '?cb=' + Math.random().toString(36).slice(2);

/* ---- 1-2. neither end of the queue is open ---- */
const askAnon = await fetch(API + '/ask' + nocache(), {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ question: 'automated probe, please ignore' })
});
check('1. asking without an account is refused', askAnon.status === 401,
      'HTTP ' + askAnon.status);

const listAnon = await fetch(API + '/questions' + nocache());
check('2. reading the queue without an account is refused', listAnon.status === 401,
      'HTTP ' + listAnon.status);

/* ---- the app ---- */
const browser = await chromium.launch();
// Without this the service worker answers the content GETs and route
// interception below never sees them.
const ctx = await browser.newContext({ ...devices['Pixel 7'], serviceWorkers: 'block' });
const page = await ctx.newPage();

const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });

// A credential the app believes in and the network never sees: every
// endpoint it would be sent to is intercepted below.
await ctx.addInitScript(() => {
  localStorage.setItem('pm-auth', 'dGVzdDp0ZXN0');
  localStorage.setItem('pm-onboarded', '1');
});

// The chat restores its history on boot and the fake credential cannot
// open it. Answered empty rather than left to 401 into the console.
await page.route('**/physicalme/v1/chat/sessions*', route =>
  route.fulfill({ status: 200, contentType: 'application/json', body: '{"sessions":[]}' })
);

let posted = null;
await page.route(API + '/ask*', route => {
  posted = JSON.parse(route.request().postData() || '{}');
  route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ ok: true, id: 7 })
  });
});

const seen = [];
await page.route(API + '/questions/*/seen*', route => {
  seen.push(route.request().url());
  route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
});

await page.route(API + '/questions*', route => {
  // The live route answers 202 on purpose — the edge caches 200 by URL
  // alone — so the fixture answers 202 too, or the test would not notice
  // the app treating 202 as a failure.
  route.fulfill({
    status: 202, contentType: 'application/json',
    body: JSON.stringify({ ok: true, items: [
      { id: 7, question: 'چرا بردار جابه‌جایی با مسافت فرق دارد؟', passage: 'پاراگرافِ نقل‌شده',
        answer: '', answered: false, article: 'بردارها', slug: 'ch03-vectors-fa',
        askedAt: '2026-09-23T09:00:00+03:30', answeredAt: null, unread: false },
      { id: 6, question: 'شتاب ثابت یعنی چه؟', passage: '',
        answer: 'یعنی در هر ثانیه همان‌قدر به سرعت اضافه می‌شود، نه بیشتر نه کمتر.',
        answered: true, article: 'حرکت', slug: 'ch02-motion-fa',
        askedAt: '2026-09-22T09:00:00+03:30', answeredAt: '2026-09-22T18:00:00+03:30', unread: true }
    ] })
  });
});

await page.goto(BASE + '/index.html?desktop=1');
await page.waitForTimeout(400);
if (await page.isVisible('#onboard')) await page.click('#onb-skip');
await page.waitForTimeout(300);

/* ---- 3. ؟ → «پرسش از استاد» opens a compose screen ---- */
async function intoRow(n) {
  const before = await page.locator('#s-list .row').first().textContent();
  await page.locator('#s-list .row').nth(n).click();
  await page.waitForFunction(prev => {
    const r = document.querySelector('#s-list .row');
    return !r || r.textContent !== prev;
  }, before, { timeout: 15000 });
}

await page.locator('.orb').nth(0).click();
await page.waitForTimeout(700);
await page.locator('.orb').nth(0).click();
await page.waitForSelector('#s-list .row', { timeout: 15000 });
await intoRow(0);
await intoRow(0);
await page.locator('#s-list .row').nth(0).click();
await page.waitForSelector('#s-reader .para', { timeout: 15000 });

await page.locator('.para .ask').nth(1).click();
await page.waitForTimeout(400);
await page.click('#opt-tutor');
await page.waitForTimeout(400);
check('3. ؟ → ask a teacher opens the compose screen',
      await page.getAttribute('.screen.is-on', 'id') === 's-ask');

/* ---- 4. the paragraph is quoted back, so the question has a subject ---- */
const quoted = (await page.textContent('#ask-body .qquote').catch(() => '')) || '';
check('4. the paragraph travels with the question', quoted.trim().length > 20,
      quoted.slice(0, 40));
await page.screenshot({ path: path.join(SHOTS, '23-ask.png') });

/* ---- 5. a two-word question is refused before it costs a round trip ---- */
await page.fill('#ask-text', 'چرا');
await page.click('#ask-send');
await page.waitForTimeout(200);
check('5. too short a question is refused locally',
      posted === null && ((await page.textContent('#ask-msg')) || '').trim().length > 0);

/* ---- 6. what actually goes on the wire ---- */
await page.fill('#ask-text', 'چرا اندازهٔ بردار برآیند از جمع اندازه‌ها کمتر است؟');
await page.click('#ask-send');
await page.waitForSelector('#ask-go', { timeout: 15000 });
check('6. the question, the passage and the slug are all sent',
      posted && posted.question.length > 10 && posted.passage.length > 20 && !!posted.article,
      JSON.stringify(posted || {}).slice(0, 120));
await page.screenshot({ path: path.join(SHOTS, '24-ask-sent.png') });

/* ---- 7-9. the inbox ---- */
await page.click('#ask-go');
await page.waitForSelector('#inbox-body .qcard', { timeout: 15000 });
const cards = await page.locator('#inbox-body .qcard').count();
check('7. both questions are listed', cards === 2, cards + ' cards');

const answer = (await page.textContent('#inbox-body .qa p').catch(() => '')) || '';
check('8. the answered one shows the teacher’s reply', answer.trim().length > 10,
      answer.slice(0, 40));
await page.screenshot({ path: path.join(SHOTS, '25-inbox.png') });

// The unread badge is what brought the reader here; it has to clear, or it
// says "new" forever.
await page.waitForTimeout(400);
check('9. an unread answer is marked seen', seen.length === 1 && seen[0].includes('/questions/6/seen'),
      seen.join(' '));

/* ---- 10. signing out takes the questions with it ---- */
await page.evaluate(() => { window.PMAuth.clear(); });
const afterOut = await page.evaluate(() => window.PMAuth.headers({}).Authorization);
check('10. signing out drops the credential', afterOut === undefined, String(afterOut));

check('11. zero console errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));

await browser.close();

const failed = results.filter(r => !r.ok);
console.log('\n' + (results.length - failed.length) + '/' + results.length + ' passed');
process.exit(failed.length ? 1 : 0);
