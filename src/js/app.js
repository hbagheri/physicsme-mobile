/* =====================================================================
   من فیزیکی — app shell
   ---------------------------------------------------------------------
   Everything here is deliberately framework-free and data-driven, so the
   content layer can be swapped for the real WordPress API without
   touching a single view. The one place to change is `api` below.
   ===================================================================== */

(function () {
  'use strict';

  /* ===================================================================
     0. CONFIG
     =================================================================== */
  var CONFIG = {
    // Where the WordPress site lives. Desktop visitors go here.
    siteUrl: 'https://physicsme.ir/',
    // Where the content API lives. Cross-origin, so the site must send
    // Access-Control-Allow-Origin for this app's domain.
    apiBase: 'https://physicsme.ir/wp-json/physicsme/v1'
  };

  /* ===================================================================
     0.1 DESKTOP GUARD
     ---------------------------------------------------------------
     This app is the phone experience only; the desktop site is the
     WordPress one and is not being replaced. So a desktop visitor is
     sent back rather than shown a phone column in the middle of a
     1920px screen.

     The test is `pointer: fine` + a wide viewport, NOT width alone:
     width alone would bounce a phone in landscape and would keep an
     iPad — which should get the app — on the site.

     `?desktop=1` is the escape hatch for developing on a laptop. It
     sticks for the session so a reload doesn't bounce you out.
     =================================================================== */
  (function desktopGuard() {
    var forced = false;
    try {
      if (location.search.indexOf('desktop=1') !== -1) sessionStorage.setItem('force-app', '1');
      forced = sessionStorage.getItem('force-app') === '1';
    } catch (e) {}
    if (forced) return;

    // An installed home-screen app is never redirected, whatever it reports.
    var standalone = window.navigator.standalone === true ||
                     window.matchMedia('(display-mode: standalone)').matches;
    if (standalone) return;

    var finePointer = window.matchMedia('(pointer: fine)').matches;
    var wide = Math.min(window.innerWidth, window.innerHeight) >= 700;

    if (finePointer && wide) location.replace(CONFIG.siteUrl);
  })();

  /* ===================================================================
     1. ICONS
     Swap these for the site's own artwork. Anything that renders inside
     a .orb-disc works: inline SVG, an <img>, or a CSS background.
     =================================================================== */
  var ICONS = {
    school: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.5 3 7v2h18V7z"/><path d="M5 9v9M19 9v9M9.5 9v9M14.5 9v9"/><path d="M2.5 18.5h19"/><path d="M12 2.5V1"/><path d="M12 1.6h3.4v2.2H12"/></svg>',
    cap:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 1.5 8.2 12 13.4l10.5-5.2z"/><path d="M5.6 10.4v5.1c0 1.7 2.9 3.1 6.4 3.1s6.4-1.4 6.4-3.1v-5.1"/><path d="M22.5 8.2v6.2"/></svg>',
    wiki:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4.5h6a3 3 0 0 1 3 3v12a2.4 2.4 0 0 0-2.4-2.4H3z"/><path d="M21 4.5h-6a3 3 0 0 0-3 3v12a2.4 2.4 0 0 1 2.4-2.4H21z"/><path d="M15.4 8.6h3M15.4 11.6h2.2"/></svg>',
    atom:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="2.3" fill="currentColor" stroke="none"/><ellipse cx="12" cy="12" rx="10" ry="4.4"/><ellipse cx="12" cy="12" rx="10" ry="4.4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4.4" transform="rotate(-60 12 12)"/></svg>',
    rocket: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2c3 2.4 4.7 6 4.7 10.1L12 17l-4.7-4.9C7.3 8 9 4.4 12 2z"/><circle cx="12" cy="9.2" r="1.8"/><path d="M7.3 12.1 4.4 14v3.3l2.9-1.6M16.7 12.1 19.6 14v3.3l-2.9-1.6"/><path d="M10.4 18.6c.6 1.6 1.6 2.7 1.6 2.7s1-1.1 1.6-2.7"/></svg>',
    bio:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20.5S3.5 15.4 3.5 9.4a4.6 4.6 0 0 1 8.5-2.5 4.6 4.6 0 0 1 8.5 2.5c0 6-8.5 11.1-8.5 11.1z"/><path d="M3.9 12h3.5l1.4-2.6 1.9 5 1.6-3.3 1.2 1.9h4.6"/></svg>',
    book:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 3.5h11a3 3 0 0 1 3 3v14H7a3 3 0 0 1-3-3z"/><path d="M18 20.5H7a3 3 0 0 0-3 3"/><path d="M8 8h6M8 11.5h4"/></svg>',
    chev:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 6l-6 6 6 6"/></svg>'
  };

  /* ===================================================================
     2. CONTENT SOURCE
     Replace the bodies of these four functions with fetch() calls to the
     WordPress REST API. The views never change — they only await these.
     =================================================================== */
  var api = {
    nodes: function (parentId) {
      // return fetch(CONFIG.apiBase + '/nodes?parent=' + parentId, {credentials:'include'}).then(r => r.json());
      return Promise.resolve(FIXTURES.nodes[parentId] || []);
    },
    article: function (id) {
      // return fetch(CONFIG.apiBase + '/article/' + id, {credentials:'include'}).then(r => r.json());
      return Promise.resolve(FIXTURES.articles[id]);
    },
    quota: function () {
      // return fetch(CONFIG.apiBase + '/me/quota', {credentials:'include'}).then(r => r.json());
      return Promise.resolve({ used: 8, total: 20 });
    },
    ask: function (payload) {
      // payload = { paragraphId, articleId, target: 'ai' | 'tutor', text }
      console.log('ask →', payload);
      return Promise.resolve({ ok: true });
    }
  };

  /* Fixtures mirror the shape the API must return, so the contract is
     visible before a single line of backend exists. */
  var FIXTURES = {
    nodes: {
      root: [
        { id: 'school', kind: 'circles', icon: 'school', title: 'فیزیک دبیرستان' },
        { id: 'uni',    kind: 'circles', icon: 'cap',    title: 'فیزیک دانشگاه', notice: 'copyright' },
        { id: 'wiki',   kind: 'list',    icon: 'wiki',   title: 'ویکی فیزیک' },
        { id: 'ai',     kind: 'chat',    icon: 'atom',   title: 'هوش مصنوعی', accent: true }
      ],
      school: [
        { id: 'riazi',  kind: 'list', icon: 'rocket', title: 'رشتهٔ ریاضی' },
        { id: 'tajrobi',kind: 'list', icon: 'bio',    title: 'رشتهٔ تجربی' }
      ],
      uni: [
        { id: 'halliday', kind: 'list', icon: 'book', title: 'هالیدی — مبانی فیزیک' }
      ],
      riazi: [
        { id: 'ch1', kind: 'list', badge: '۱', title: 'الکتریسیتهٔ ساکن', sub: '۴ بند · ۳۲ پرسش' },
        { id: 'ch2', kind: 'list', badge: '۲', title: 'جریان الکتریکی',   sub: '۵ بند · ۴۱ پرسش' },
        { id: 'ch3', kind: 'list', badge: '۳', title: 'مغناطیس',          sub: '۳ بند · ۲۸ پرسش' },
        { id: 'ch4', kind: 'list', badge: '۴', title: 'القای الکترومغناطیسی', sub: '۴ بند · ۳۶ پرسش' }
      ],
      ch1: [
        { group: 'محتوای فصل' },
        { id: 'a1', kind: 'article', badge: '۱', title: 'بار الکتریکی',  sub: 'خواندن · ۶ دقیقه' },
        { id: 'a2', kind: 'article', badge: '۲', title: 'قانون کولن',    sub: 'خواندن · ۹ دقیقه' },
        { id: 'a3', kind: 'article', badge: '۳', title: 'میدان الکتریکی', sub: 'خواندن · ۱۱ دقیقه' },
        { group: 'تمرین و یادسپاری' },
        { id: 'q1', kind: 'quiz',  band: true, badge: '؟', title: 'پرسش‌ها',        sub: '۱۸ پرسش چهارگزینه‌ای' },
        { id: 'p1', kind: 'quiz',  band: true, badge: 'Σ', title: 'مسائل',          sub: '۱۴ مسئلهٔ تشریحی' },
        { id: 'f1', kind: 'cards', band: true, badge: '⚏', title: 'کارت‌های حافظه', sub: '۲۴ کارت' },
        { id: 'g1', kind: 'game',  band: true, badge: '◎', title: 'بازی تطبیق',     sub: 'نمودار و کمیت' }
      ]
    },
    articles: {
      a1: {
        title: 'بار الکتریکی',
        meta: 'فیزیک یازدهم · فصل ۱ · بند ۱ · حدود ۶ دقیقه',
        blocks: [
          { type: 'p', id: 'p1', text: 'اگر میله‌ای پلاستیکی را با پارچه‌ای پشمی بمالیم، میله می‌تواند تکه‌های ریز کاغذ را به خود جذب کند. این اثر ساده که از زمان یونانیان باستان شناخته شده بود، نخستین نشانه از وجود کمیتی به نام بار الکتریکی است.' },
          { type: 'p', id: 'p2', text: 'بار الکتریکی دو نوع دارد که آن‌ها را مثبت و منفی می‌نامیم. بارهای هم‌نام یکدیگر را می‌رانند و بارهای ناهم‌نام یکدیگر را می‌ربایند. این نام‌گذاری قراردادی است و از فرانکلین به یادگار مانده.' },
          { type: 'formula', text: 'F = k · q₁q₂ / r²' },
          { type: 'p', id: 'p3', text: 'نیروی میان دو بار نقطه‌ای با حاصل‌ضرب اندازهٔ بارها نسبت مستقیم و با مربع فاصلهٔ میان آن‌ها نسبت وارون دارد. ثابت کولن در خلأ برابر ۸٫۹۹ × ۱۰⁹ نیوتن‌متر مربع بر کولن مربع است.' },
          { type: 'p', id: 'p4', text: 'توجه کن که این رابطه تنها برای بارهای نقطه‌ای یا کره‌های باردار یکنواخت اعتبار دارد. برای توزیع‌های پیوستهٔ بار باید به انتگرال‌گیری روی عنصرهای بار روی آوریم.' }
        ]
      }
    }
  };

  /* ===================================================================
     3. ROUTER — a stack, because navigation here is strictly one step
        forward and one step back. Mirrors the website's behaviour.
     =================================================================== */
  var $  = function (s) { return document.querySelector(s); };
  var stack = [];
  var busy = false;

  var el = {
    orbScreen: $('#s-orbs'),
    orbGrid:   $('#orb-grid'),
    orbCrumb:  $('#orb-crumb'),
    orbBack:   $('#orb-back'),
    orbAi:     $('#orb-ai'),
    banner:    $('#copyright-banner'),
    listTitle: $('#list-title'),
    listCrumb: $('#list-crumb'),
    listBody:  $('#list-body'),
    readerTitle: $('#reader-title'),
    readerCrumb: $('#reader-crumb'),
    readerBody:  $('#reader-body'),
    scrim: $('#scrim'),
    sheet: $('#sheet'),
    sheetTitle: $('#sheet-title'),
    sheetSub: $('#sheet-sub'),
    quota: $('#quota')
  };

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(function (s) {
      s.classList.toggle('is-on', s.id === id);
    });
  }

  function crumbText() {
    return ['من فیزیکی'].concat(stack.map(function (f) { return f.title; })).join(' ← ');
  }

  /* ---- circle grid ---- */

  function renderCircles(items, opts) {
    el.orbGrid.innerHTML = '';
    el.orbGrid.setAttribute('data-cols', items.length === 1 ? '1' : '2');
    el.orbCrumb.textContent = crumbText();
    el.orbBack.hidden = stack.length === 0;
    el.orbAi.hidden = stack.length === 0;
    el.banner.hidden = !(opts && opts.notice === 'copyright');

    items.forEach(function (item, i) {
      var b = document.createElement('button');
      b.className = 'orb' + (item.accent ? ' orb--accent' : '');
      b.innerHTML =
        '<span class="orb-disc">' + (ICONS[item.icon] || '') + '</span>' +
        '<span class="orb-cap">' + item.title + '</span>';
      b.addEventListener('click', function () { if (!busy) open(item); });
      el.orbGrid.appendChild(b);
      setTimeout(function () { b.classList.add('is-in'); }, 70 + i * 85);
    });
    showScreen('s-orbs');
  }

  function animateOutThen(fn) {
    busy = true;
    var orbs = el.orbGrid.querySelectorAll('.orb');
    Array.prototype.forEach.call(orbs, function (o, i) {
      setTimeout(function () { o.classList.remove('is-in'); o.classList.add('is-out'); }, i * 55);
    });
    setTimeout(function () { fn(); busy = false; }, 240 + orbs.length * 45);
  }

  /* ---- list ---- */

  function renderList(items, frame) {
    el.listTitle.textContent = frame.title;
    el.listCrumb.textContent = crumbText();
    el.listBody.innerHTML = '';

    items.forEach(function (item) {
      if (item.group) {
        var g = document.createElement('div');
        g.className = 'group-label';
        g.textContent = item.group;
        el.listBody.appendChild(g);
        return;
      }
      var r = document.createElement('button');
      r.className = 'row' + (item.band ? ' row--band' : '');
      r.innerHTML =
        '<span class="row-thumb">' + (item.badge || (ICONS[item.icon] || '')) + '</span>' +
        '<span class="row-text"><span class="row-t1">' + item.title + '</span>' +
        (item.sub ? '<span class="row-t2">' + item.sub + '</span>' : '') + '</span>' +
        '<span class="row-chev">' + ICONS.chev + '</span>';
      r.addEventListener('click', function () { open(item); });
      el.listBody.appendChild(r);
    });
    showScreen('s-list');
  }

  /* ---- reader ---- */

  function renderArticle(doc, frame) {
    el.readerTitle.textContent = doc.title;
    el.readerCrumb.textContent = crumbText();

    var inner = document.createElement('div');
    inner.className = 'reader-inner';
    inner.innerHTML = '<h2>' + doc.title + '</h2><p class="reader-meta">' + doc.meta + '</p>';

    doc.blocks.forEach(function (b, i) {
      if (b.type === 'formula') {
        var f = document.createElement('span');
        f.className = 'formula';
        f.textContent = b.text;
        inner.appendChild(f);
        return;
      }
      var wrap = document.createElement('div');
      wrap.className = 'para';
      wrap.innerHTML =
        '<button class="ask" aria-label="پرسش دربارهٔ این پاراگراف">؟</button>' +
        '<p>' + b.text + '</p>';
      wrap.querySelector('.ask').addEventListener('click', function () {
        document.querySelectorAll('.para').forEach(function (p) { p.classList.remove('is-asked'); });
        wrap.classList.add('is-asked');
        openSheet('para', { n: i + 1, articleId: frame.id, paragraphId: b.id });
      });
      inner.appendChild(wrap);
    });

    el.readerBody.innerHTML = '';
    el.readerBody.appendChild(inner);
    el.readerBody.scrollTop = 0;
    showScreen('s-reader');
  }

  /* ---- navigation ---- */

  function open(item) {
    if (item.kind === 'chat') { openChat({ newChat: false }); return; }

    if (item.kind === 'circles') {
      animateOutThen(function () {
        stack.push(item);
        api.nodes(item.id).then(function (kids) {
          renderCircles(kids, { notice: item.notice });
        });
      });
      return;
    }

    stack.push(item);
    if (item.kind === 'article') {
      api.article(item.id).then(function (doc) { renderArticle(doc, item); });
    } else {
      api.nodes(item.id).then(function (kids) { renderList(kids, item); });
    }
  }

  function back() {
    if (!stack.length) return;
    stack.pop();
    var parent = stack[stack.length - 1];

    if (!parent) {
      api.nodes('root').then(function (kids) { renderCircles(kids, {}); });
      return;
    }
    if (parent.kind === 'circles') {
      api.nodes(parent.id).then(function (kids) {
        renderCircles(kids, { notice: parent.notice });
      });
      return;
    }
    if (parent.kind === 'article') {
      api.article(parent.id).then(function (doc) { renderArticle(doc, parent); });
      return;
    }
    api.nodes(parent.id).then(function (kids) { renderList(kids, parent); });
  }

  el.orbBack.addEventListener('click', function () { if (!busy) animateOutThen(back); });
  document.querySelectorAll('[data-back]').forEach(function (b) {
    b.addEventListener('click', back);
  });

  /* ===================================================================
     4. SHEET
     =================================================================== */
  var pendingAsk = null;

  function openSheet(kind, ctx) {
    pendingAsk = ctx || null;
    if (kind === 'ai') {
      el.sheetTitle.textContent = 'دستیار من فیزیکی';
      el.sheetSub.textContent = 'سؤالت را بپرس، یا یکی از دو مسیر زیر را انتخاب کن.';
    } else {
      el.sheetTitle.textContent = 'این پاراگراف را نفهمیدم';
      el.sheetSub.textContent = 'پاراگراف ' + ctx.n + ' انتخاب شده است.';
    }
    api.quota().then(function (q) {
      el.quota.innerHTML = 'سهمیهٔ امروز: <b>' + (q.total - q.used) + ' پرسش</b> از ' + q.total + ' باقی مانده';
    });
    el.scrim.hidden = false;
    requestAnimationFrame(function () {
      el.scrim.classList.add('is-on');
      el.sheet.classList.add('is-on');
    });
  }

  function closeSheet() {
    el.scrim.classList.remove('is-on');
    el.sheet.classList.remove('is-on');
    setTimeout(function () { el.scrim.hidden = true; }, 320);
    document.querySelectorAll('.para').forEach(function (p) { p.classList.remove('is-asked'); });
  }

  el.scrim.addEventListener('click', closeSheet);
  $('#opt-ai').addEventListener('click', function () {
    var ctx = pendingAsk || {};
    closeSheet();
    openChat({
      newChat: true,
      draft: 'این پاراگراف را نفهمیدم، ساده‌تر توضیح بده.',
      cite: 'پاراگراف ' + (ctx.n || '')
    });
  });
  $('#opt-tutor').addEventListener('click', function () {
    api.ask(Object.assign({ target: 'tutor' }, pendingAsk || {})).then(closeSheet);
  });
  document.querySelectorAll('[data-open-ai]').forEach(function (b) {
    b.addEventListener('click', function () { openChat({ newChat: false }); });
  });

  /* The paragraph sheet is the only place the two-way choice matters; the
     assistant button in a top bar goes straight into the conversation. */
  function openChat(opts) {
    var on = document.querySelector('.screen.is-on');
    if (on && on.id !== 's-chat') lastScreen = on.id;
    window.PMChat.open(opts || {});
  }
  var lastScreen = 's-orbs';
  window.PMChat.onClose(function () { showScreen(lastScreen); });

  /* ===================================================================
     5. iOS install tip
     Safari fires no beforeinstallprompt, so the gesture has to be taught.
     Shown once, only on iOS Safari, only when not already installed.
     =================================================================== */
  (function iosTip() {
    var tip = $('#ios-tip');
    var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var standalone = window.navigator.standalone === true ||
                     window.matchMedia('(display-mode: standalone)').matches;
    var seen = false;
    try { seen = localStorage.getItem('ios-tip-seen') === '1'; } catch (e) {}

    if (!isIOS || standalone || seen) return;
    setTimeout(function () { tip.hidden = false; }, 2500);
    $('#ios-tip-close').addEventListener('click', function () {
      tip.hidden = true;
      try { localStorage.setItem('ios-tip-seen', '1'); } catch (e) {}
    });
  })();

  /* ===================================================================
     6. Service worker
     =================================================================== */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }

  /* ---- boot ---- */
  window.PMChat.init();
  api.nodes('root').then(function (kids) { renderCircles(kids, {}); });
})();
