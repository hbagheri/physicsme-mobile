/* =====================================================================
   Offline library — the promise is narrow and worth testing exactly:
   an article is on the phone because someone asked, and nothing else is.

   Run a static server on the repo root first, then:
       node test/offline.js
   BASE=https://physicsme.ir/webapp node test/offline.js

   Needs a secure context for Cache Storage, so http works only on
   127.0.0.1 — a LAN address will fail check 1 for that reason alone.
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
// Going offline is part of the test, and a browser logs every blocked
// request. Only the online stretches are held to "no errors"; check 4
// deliberately provokes one.
let offline = false;
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error' && !offline) consoleErrors.push(m.text()); });
page.on('pageerror', e => { if (!offline) consoleErrors.push('pageerror: ' + e.message); });

async function title(t) {
  await page.waitForFunction(
    x => (document.querySelector('#list-title')?.textContent || '').includes(x),
    t, { timeout: 20000 });
  await page.waitForTimeout(250);
}

await page.goto(BASE + '/index.html?desktop=1');
await page.waitForTimeout(500);
if (await page.isVisible('#onboard')) await page.click('#onb-skip');
await page.waitForTimeout(300);

/* ---- 1. the reader offers to save, and saving sticks ---- */
await page.locator('.orb').nth(0).click();
await page.waitForTimeout(600);
await page.locator('.orb').nth(0).click();          // ریاضی
await title('رشتهٔ ریاضی');
await page.locator('#s-list .row').nth(0).click();  // دهم
await title('دهم');
await page.locator('#s-list .row').nth(0).click();  // فصل ۱
await title('فصل ۱');
await page.locator('#s-list .row').nth(0).click();  // بندِ ۱
await page.waitForSelector('.savebtn', { timeout: 20000 });

const savedTitle = await page.textContent('#reader-title');
await page.click('.savebtn');
await page.waitForFunction(
  () => document.querySelector('.savebtn')?.classList.contains('is-on'),
  null, { timeout: 20000 });
const index = await page.evaluate(() => JSON.parse(localStorage.getItem('pm-saved-index') || '[]'));
check('1. save button stores one article in the index', index.length === 1,
      JSON.stringify(index));

/* ---- 2. only what was asked for is in the cache ----
   Everything else read on the way here — books, chapters, the article list,
   this very article's first fetch — must have left no copy behind. */
const cached = await page.evaluate(async () => {
  const keys = await caches.keys();
  const out = {};
  for (const k of keys) {
    const c = await caches.open(k);
    out[k] = (await c.keys()).map(r => r.url).filter(u => u.includes('/wp-json/'));
  }
  return out;
});
const apiEntries = Object.values(cached).flat();
check('2. only the saved article is cached from the API',
      apiEntries.length === 1 && apiEntries[0].includes('/articles/'),
      JSON.stringify(cached));

/* ---- 3. it survives offline, reached from the library ---- */
offline = true;
await ctx.setOffline(true);
await page.reload();
await page.waitForTimeout(900);
await page.click('#orb-account');
await page.waitForTimeout(400);
await page.locator('#account-body .prow').last().click();
await page.waitForTimeout(400);
const rowCount = await page.locator('.srow').count();
await page.locator('.srow-open').first().click();
await page.waitForSelector('#s-reader .para', { timeout: 20000 });
const readTitle = await page.textContent('#reader-title');
check('3. a saved article opens offline from the library',
      rowCount === 1 && readTitle === savedTitle,
      rowCount + ' rows, opened "' + readTitle + '"');

/* ---- 4. an article nobody saved does not open offline ---- */
const unsaved = await page.evaluate(async () => {
  try {
    const r = await fetch('https://physicsme.ir/wp-json/pm/v1/articles/hal-masael-fasl-1');
    return r ? 'status ' + r.status : 'null';
  } catch (e) { return 'threw'; }
});
check('4. an unsaved article is not available offline',
      unsaved === 'threw' || unsaved === 'null', unsaved);

/* ---- 5. back from a saved article returns to the library ---- */
await page.click('#s-reader [data-back]');
await page.waitForTimeout(500);
check('5. back returns to the library, not to the home circles',
      await page.getAttribute('.screen.is-on', 'id') === 's-saved');

/* ---- 6. removing it empties the library and the cache ---- */
await ctx.setOffline(false);
offline = false;
await page.locator('.srow-del').first().click();
await page.waitForTimeout(600);
const after = await page.evaluate(async () => ({
  index: JSON.parse(localStorage.getItem('pm-saved-index') || '[]').length,
  cache: await caches.open('pm-saved').then(c => c.keys()).then(k => k.length)
}));
check('6. removing an article clears both the index and the cache',
      after.index === 0 && after.cache === 0, JSON.stringify(after));

/* ---- 7. the cap is stated, not silently enforced ---- */
await page.evaluate(() => {
  const fake = Array.from({ length: 20 }, (_, i) => ({ slug: 'x' + i, title: 'x' + i, at: 1 }));
  localStorage.setItem('pm-saved-index', JSON.stringify(fake));
});
await page.goto(BASE + '/index.html?desktop=1');
await page.waitForTimeout(500);
await page.click('#orb-account');
await page.waitForTimeout(400);
await page.locator('#account-body .prow').last().click();
await page.waitForTimeout(400);
const note = (await page.textContent('.note')) || '';
check('7. the library states how full it is', /۲۰/.test(note) && /۲۰/.test(note), note.trim());

check('8. zero console errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));

await browser.close();
const failed = results.filter(r => !r.ok);
console.log('\n' + (results.length - failed.length) + '/' + results.length + ' passed');
process.exit(failed.length ? 1 : 0);
