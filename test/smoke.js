/* =====================================================================
   Smoke test — the ten things that must not break.

   Run a static server on the repo root first, then:
       node test/smoke.js
   Override the address with BASE=http://host:port node test/smoke.js

   The whole run happens in one page context on an iPhone 14 viewport, so
   check 10 (no console errors anywhere) covers every path above it.
   ===================================================================== */

import { chromium, devices } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const BASE = process.env.BASE || 'http://127.0.0.1:8788';
const SHOTS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'screens');
fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
let page;

function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail: detail || '' });
  console.log((ok ? '  ok   ' : '  FAIL ') + name + (ok || !detail ? '' : ' — ' + detail));
}

async function shot(name) {
  await page.screenshot({ path: path.join(SHOTS, name + '.png') });
}

// body must never scroll sideways — the single most common RTL regression
async function noHScroll(where) {
  const bad = await page.evaluate(() => document.body.scrollWidth > window.innerWidth + 1);
  if (bad) hScrollFailures.push(where);
}
const hScrollFailures = [];

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 14'] });
page = await ctx.newPage();

const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message));

/* ---- 1. home shows four circles ---- */
await page.goto(BASE + '/index.html?desktop=1');
await page.waitForTimeout(400);
// onboarding covers the home screen on a first run; skip past it
if (await page.isVisible('#onboard')) await page.click('#onb-skip');
await page.waitForTimeout(400);
check('1. home shows four circles', await page.locator('.orb').count() === 4);
await noHScroll('home');
await shot('01-home');

/* ---- 2. school → riazi → book → chapter → article ----
   Every step below this one is a live request to physicsme.ir, so the waits
   are generous: a cold edge miss is slower than anything the fixtures did. */

/* The list is replaced in place, so waiting for `.row` to exist proves
   nothing — the previous level's rows are still on screen while the fetch
   is in flight. Waiting for the first row's *text* to change is the only
   signal that the next level has actually arrived. */
async function intoRow(n) {
  const before = await page.locator('#s-list .row').first().textContent();
  await page.locator('#s-list .row').nth(n).click();
  await page.waitForFunction(
    prev => {
      const r = document.querySelector('#s-list .row');
      return !r || r.textContent !== prev;
    },
    before,
    { timeout: 15000 }
  );
}

await page.locator('.orb').nth(0).click();
await page.waitForTimeout(700);
await page.locator('.orb').nth(0).click();          // رشتهٔ ریاضی
await page.waitForSelector('#s-list .row', { timeout: 15000 });
const bookCount = await page.locator('#s-list .row').count();
await intoRow(0);                                   // دهم ریاضی
const chapters = await page.locator('#s-list .row').count();
await intoRow(0);                                   // فصل ۱
const sections = await page.locator('#s-list .row').count();
await page.locator('#s-list .row').nth(0).click();  // مقالهٔ ۱
await page.waitForSelector('#s-reader .para', { timeout: 15000 });
const onReader = await page.getAttribute('.screen.is-on', 'id');
check('2. school → riazi → book → chapter → article',
      onReader === 's-reader' && bookCount > 0 && chapters > 0 && sections > 0,
      'landed on ' + onReader);
await noHScroll('reader');
await shot('02-reader');

/* ---- 3. ؟ → sheet → ask the assistant → chat opens with a draft ---- */
await page.locator('.para .ask').nth(1).click();
await page.waitForTimeout(400);
const sheetOpen = await page.isVisible('#sheet');
await shot('03-sheet');
await page.click('#opt-ai');
await page.waitForTimeout(600);
const draft = (await page.textContent('#chat-draft')) || '';
check('3. ؟ → sheet → assistant, chat opens with a draft',
      sheetOpen && await page.getAttribute('.screen.is-on', 'id') === 's-chat' && draft.trim().length > 0,
      'draft="' + draft.trim().slice(0, 30) + '"');
await noHScroll('chat');
await shot('04-chat-draft');

/* ---- 4. send → stream → source badge + rating buttons ---- */
await page.fill('#chat-composer', 'قانون دوم نیوتن را ساده توضیح بده');
await page.click('#chat-send');
await page.waitForSelector('.srcbadge', { timeout: 30000 });
await page.waitForTimeout(400);
const rateButtons = await page.locator('.msg-acts .act').count();
const rateEnabled = await page.locator('.msg-acts .act:not([disabled])').count();
check('4. stream ends with a source badge and live rating buttons',
      await page.locator('.srcbadge').count() > 0 && rateButtons >= 3 && rateEnabled >= 3,
      rateButtons + ' buttons, ' + rateEnabled + ' enabled');
await noHScroll('chat after answer');
await shot('05-answer');

/* ---- 5. stop mid-stream → «متوقف شد» chip ----
   Ask for something long: against a live model a short answer can finish
   before the click lands, and then there is no mid-stream left to stop. */
await page.fill('#chat-composer', 'تاریخچهٔ کاملِ مکانیک کلاسیک را مفصل و طولانی بنویس');
await page.click('#chat-send');
await page.waitForSelector('#chat-stop:not([hidden])', { timeout: 20000 });
await page.click('#chat-stop', { timeout: 20000 });
await page.waitForTimeout(400);
check('5. stop mid-stream shows the stopped chip', await page.locator('.stopped').count() > 0);
await shot('06-stopped');

/* ---- 6. drawer → inline rename → delete with confirm bar ---- */
await page.click('#chat-menu');
await page.waitForTimeout(500);
await shot('07-drawer');
const before = await page.locator('.chat-item').count();
await page.locator('.chat-item').first().hover();
await page.locator('.chat-item [data-act="rename"]').first().click();
await page.waitForTimeout(300);
const renaming = await page.locator('.rename-input').count() > 0;
if (renaming) {
  await page.fill('.rename-input', 'نام آزمایشی');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
}
const renamed = (await page.textContent('.chat-item')) || '';
await page.locator('.chat-item [data-act="del"]').first().click();
await page.waitForTimeout(300);
const confirmBar = await page.locator('.delbar').count() > 0;
await shot('08-delete-confirm');
if (confirmBar) await page.click('.del-yes');
await page.waitForTimeout(400);
// The count does not drop: deleting the open conversation immediately opens
// a fresh one. What must be true is that this title is gone from the list.
const stillThere = await page.locator('.chat-item', { hasText: 'نام آزمایشی' }).count();
check('6. drawer rename + delete behind a confirm bar',
      renaming && renamed.includes('نام آزمایشی') && confirmBar && stillThere === 0,
      'renamed=' + renaming + ' confirmBar=' + confirmBar + ' leftover=' + stillThere +
      ' (' + before + ' conversations before)');
// The scrim sits under an 84%-wide drawer, so its centre is not clickable.
await page.click('#drawer-close');
await page.waitForTimeout(400);

/* ---- 7. code block → اجرا → RAM warning ---- */
await page.fill('#chat-composer', 'کد پایتون پرتابه با نمودار بنویس');
await page.click('#chat-send');
await page.waitForSelector('.codebtn.run', { timeout: 40000 });
await page.waitForTimeout(400);
await page.click('.codebtn.run');
await page.waitForTimeout(600);
const warn = await page.locator('.py-warn').count() > 0;
check('7. Run on a code block warns about memory first', warn);
await shot('09-python-warning');
if (await page.isVisible('.py-cancel')) await page.click('.py-cancel');
await page.waitForTimeout(300);

/* ---- 8. desktop guard ---- */
const deskCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const deskPage = await deskCtx.newPage();
await deskPage.goto(BASE + '/index.html?desktop=1');
await deskPage.waitForTimeout(600);
// Compare against BASE rather than a hardcoded host: this suite also runs
// against the deployed copy, where "stayed put" means still under /webapp/.
const stayedWithFlag = deskPage.url().startsWith(BASE);

const deskCtx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const deskPage2 = await deskCtx2.newPage();
// the redirect leaves the origin, which counts as a navigation failure offline
await deskPage2.goto(BASE + '/index.html').catch(() => {});
await deskPage2.waitForTimeout(1200);
const leftOnDesktop = !deskPage2.url().startsWith(BASE);
check('8. ?desktop=1 stays, a bare desktop visit is redirected',
      stayedWithFlag && leftOnDesktop,
      'with flag: ' + deskPage.url() + ' / without: ' + deskPage2.url());
await deskCtx.close();
await deskCtx2.close();

/* ---- extra screenshots: the account family, dark, and LTR ----
   Not checks — BUILD.md asks for ten. These exist so the screens added last
   can be reviewed at a glance in the morning. ---- */
// Closing the chat returns to the reader it was opened from, so reload to
// get back to the home circles. localStorage keeps the onboarding dismissed.
await page.goto(BASE + '/index.html?desktop=1');
await page.waitForTimeout(500);
await page.click('#orb-account');
await page.waitForTimeout(300);
await page.click('#acc-login');
// The chooser asks the server which methods it can deliver, so it draws a
// beat later than the screen it is on.
await page.waitForSelector('#auth-tg, #auth-em, #auth-state .card', { timeout: 15000 });
await shot('10-auth-methods');
// Signing up for real would create a WordPress user on every run, so the
// account screens below are shown with local state only. `pm-auth` is
// deliberately not set: a bogus credential would go out on every request.
await page.evaluate(() => localStorage.setItem('pm-user', JSON.stringify({ name: 'آزمون' })));
await page.goto(BASE + '/index.html?desktop=1');
await page.waitForTimeout(500);
await page.click('#orb-account');
await page.waitForTimeout(300);
await shot('11-account');
// Row 0 is «پرسش‌های من», which needs a credential this run deliberately
// does not have — see the note above. Usage and settings are rows 1 and 2.
await page.locator('#account-body .prow').nth(1).click();
await page.waitForTimeout(300);
await shot('12-usage');
await page.click('#s-usage [data-page-back]');
await page.locator('#account-body .prow').nth(2).click();
await page.waitForTimeout(300);
await shot('13-settings');
await page.click('#set-theme button[data-v="dark"]');
await page.waitForTimeout(300);
await shot('14-settings-dark');
await page.click('#set-lang button[data-v="en"]');
await page.waitForTimeout(400);
await shot('15-settings-ltr');
await page.click('#s-settings [data-page-back]');
await page.waitForTimeout(300);
await shot('16-home-ltr-dark');
await noHScroll('home in LTR');

/* ---- 9 + 10 ---- */
check('9. no horizontal scroll anywhere', hScrollFailures.length === 0, hScrollFailures.join(', '));
check('10. zero console errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));

await browser.close();

const failed = results.filter(r => !r.ok);
console.log('\n' + (results.length - failed.length) + '/' + results.length + ' passed · screenshots in test/screens/');
process.exit(failed.length ? 1 : 0);
