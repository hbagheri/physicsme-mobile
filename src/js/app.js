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
    siteUrl: 'https://physicsme.ir/'
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
     Everything the views read comes from here and nowhere else, so the
     shape below is the whole contract. The site speaks in books,
     chapters and articles; the app speaks in nodes. The translation
     happens here rather than in the views, which never fetch.
     =================================================================== */
  var API = 'https://physicsme.ir/wp-json/pm/v1';

  function getJSON(path) {
    return fetch(API + path, { headers: window.PMAuth.contentHeaders({ Accept: 'application/json' }) })
      .then(function (r) {
        // 402 is not a failure to retry — the article is there and the
        // reader needs a sign-up card, not the offline/error screen.
        if (r.status === 402) {
          var e = new Error('locked');
          e.locked = true;
          throw e;
        }
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      });
  }

  /* One fetch per list, kept for the life of the session. Navigation is
     back-and-forth by nature, and the site's content does not move
     while someone is reading it. */
  var cache = {};
  function once(key, make) {
    if (!cache[key]) {
      cache[key] = make().catch(function (e) { delete cache[key]; throw e; });
    }
    return cache[key];
  }

  function books() { return once('books', function () { return getJSON('/books'); }); }

  /* ---- the offline library ----
     Reading an article does not keep it. Someone has to ask, and the ask is
     capped, because iOS gives a non-installed site roughly 50MB and evicts
     the whole origin when it runs out — an unbounded library would take the
     app shell down with it.

     The body lives in a Cache Storage bucket the service worker reads on a
     failed fetch; the index lives in localStorage so the library screen can
     draw without unpacking every response. Two stores means they can drift,
     so `list()` treats the index as the truth and a missing body is repaired
     on the next download rather than reported. */
  var SAVE_LIMIT = 20;
  var SAVE_CACHE = 'pm-saved';
  var SAVE_INDEX = 'pm-saved-index';

  var saved = {
    // No Cache Storage means no secure context — LAN http, typically. The
    // feature is hidden rather than offered and then silently broken.
    available: function () { return typeof caches !== 'undefined'; },

    list: function () {
      try { return JSON.parse(localStorage.getItem(SAVE_INDEX)) || []; }
      catch (e) { return []; }
    },

    has: function (slug) {
      return saved.list().some(function (a) { return a.slug === slug; });
    },

    full: function () { return saved.list().length >= SAVE_LIMIT; },

    add: function (slug, title) {
      if (!saved.available()) return Promise.reject(new Error('unavailable'));
      if (saved.has(slug)) return Promise.resolve();
      if (saved.full()) return Promise.reject(new Error('full'));
      var url = API + '/articles/' + slug;
      return fetch(url, { headers: window.PMAuth.contentHeaders({ Accept: 'application/json' }) })
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return caches.open(SAVE_CACHE).then(function (c) { return c.put(url, r); });
        })
        .then(function () {
          var l = saved.list();
          l.unshift({ slug: slug, title: title, at: Date.now() });
          localStorage.setItem(SAVE_INDEX, JSON.stringify(l));
        });
    },

    remove: function (slug) {
      var l = saved.list().filter(function (a) { return a.slug !== slug; });
      localStorage.setItem(SAVE_INDEX, JSON.stringify(l));
      if (!saved.available()) return Promise.resolve();
      return caches.open(SAVE_CACHE).then(function (c) {
        return c.delete(API + '/articles/' + slug);
      });
    },

    clear: function () {
      localStorage.removeItem(SAVE_INDEX);
      if (!saved.available()) return Promise.resolve();
      return caches.delete(SAVE_CACHE);
    }
  };

  // The site has no "track" field: the grade books encode it in the slug
  // and the university book matches neither. Reading the slug keeps the
  // three top-level groups without asking the backend for a new field.
  function track(slug) {
    if (/-ram$/.test(slug)) return 'riazi';
    if (/-tajrobi$/.test(slug)) return 'tajrobi';
    return 'uni';
  }

  // The grade is in the label, but the badge is where the eye lands first, so
  // a track screen reads as 10-11-12 at a glance. The university book has no
  // grade and keeps its emoji.
  var YEARS = { dahom: '10', yazdahom: '11', davazdahom: '12' };

  function bookRows(which) {
    return books().then(function (list) {
      return list.filter(function (b) { return track(b.slug) === which; })
        .map(function (b) {
          var year = YEARS[b.slug.split('-')[0]];
          return {
            id: 'book:' + b.slug,
            kind: 'list',
            badge: year ? window.PMI18n.digits(year) : (b.emoji || ''),
            title: b.label,
            sub: T('sub.book', {
              c: window.PMI18n.digits(b.chapterCount),
              l: window.PMI18n.digits(b.lessonCount)
            })
          };
        });
    });
  }

  // A chapter holds three different things — its sections, then its problem
  // set, then its flashcard deck — and the site files all three as `article`.
  // The server tags each one with `kind`; splitting them here means the
  // numbering counts sections only, instead of running on into the extras.
  var KINDS = ['lesson', 'problems', 'flashcards'];
  var KIND_BADGE = { problems: '📝', flashcards: '🃏' };

  function articleRows(list) {
    var rows = [];
    KINDS.forEach(function (kind) {
      var group = list.filter(function (a) { return (a.kind || 'lesson') === kind; });
      if (!group.length) return;
      rows.push({ group: T('group.' + kind) });
      group.forEach(function (a, i) {
        rows.push({
          id: a.slug,
          kind: 'article',
          badge: KIND_BADGE[kind] || window.PMI18n.digits(i + 1),
          title: a.title,
          sub: a.readingTime || ''
        });
      });
    });
    return rows;
  }

  var api = {
    nodes: function (parentId) {
      if (parentId === 'root') {
        return Promise.resolve([
          { id: 'school', kind: 'circles', icon: 'school', title: T('node.school') },
          // The site has exactly one university book, so a circle screen
          // holding a single orb would be a step that asks for a tap and
          // gives nothing back. It opens as a list instead.
          { id: 'uni',    kind: 'list',    icon: 'cap',    title: T('node.uni'), notice: 'copyright' },
          { id: 'wiki',   kind: 'list',    icon: 'wiki',   title: T('node.wiki') },
          { id: 'ai',     kind: 'chat',    icon: 'atom',   title: T('node.ai'), accent: true }
        ]);
      }
      if (parentId === 'school') {
        return Promise.resolve([
          { id: 'riazi',   kind: 'list', icon: 'rocket', title: T('node.riazi') },
          { id: 'tajrobi', kind: 'list', icon: 'bio',    title: T('node.tajrobi') }
        ]);
      }
      if (parentId === 'riazi' || parentId === 'tajrobi') return bookRows(parentId);
      if (parentId === 'uni') return bookRows('uni');

      // The wiki circle is the site's feed: whatever went up most recently.
      if (parentId === 'wiki') {
        return once('recent', function () { return getJSON('/recent'); })
          .then(function (list) {
            return list.map(function (a) {
              return { id: a.slug, kind: 'article', icon: 'book', title: a.title, sub: a.readingTime || '' };
            });
          });
      }

      if (parentId.indexOf('book:') === 0) {
        var bslug = parentId.slice(5);
        return once(parentId, function () {
          return getJSON('/books/' + bslug + '/chapters');
        }).then(function (list) {
          return list.map(function (c, i) {
            return {
              id: 'ch:' + c.slug,
              kind: 'list',
              // `order` is book-scoped (101, 102 … for the tenth-grade books),
              // so it is a sort key, not a chapter number to show.
              badge: window.PMI18n.digits(i + 1),
              title: c.title,
              sub: T('sub.chapter', { l: window.PMI18n.digits(c.lessonCount) })
            };
          });
        });
      }

      if (parentId.indexOf('ch:') === 0) {
        var cslug = parentId.slice(3);
        return once(parentId, function () {
          return getJSON('/chapters/' + cslug + '/articles');
        }).then(articleRows);
      }

      return Promise.resolve([]);
    },

    article: function (slug) {
      return once('a:' + slug, function () {
        return getJSON('/articles/' + slug);
      }).then(function (a) {
        return {
          title: a.title,
          meta: a.readingTime || '',
          blocks: blocksFromHtml(a.html || '')
        };
      });
    },

    quota: function () {
      // No per-user quota endpoint exists yet, and there is no sign-in to
      // attach one to. Reported as unknown rather than invented.
      return Promise.resolve(null);
    },

    ask: function (payload) {
      // payload = { paragraphId, articleId, target: 'ai' | 'tutor', text }
      console.log('ask →', payload);
      return Promise.resolve({ ok: true });
    }
  };

  /* The site returns rendered HTML; the reader wants blocks, because the
     "؟" affordance belongs to a paragraph and nothing else. Paragraphs
     become askable blocks, everything else — headings, lists, quotes,
     figures, code — passes through untouched.

     innerHTML is safe here in the sense that matters: the markup comes
     from our own WordPress, the same trust boundary as the site itself.
     If this ever reads a third-party feed, it needs sanitising first. */
  function blocksFromHtml(html) {
    var host = document.createElement('div');
    host.innerHTML = html;

    // An embedded video cannot play offline and costs a connection the
    // reader may not have. The link survives; the player does not.
    host.querySelectorAll('iframe').forEach(function (f) {
      var a = document.createElement('p');
      a.innerHTML = '<a href="' + (f.getAttribute('src') || '') +
                    '" target="_blank" rel="noopener">' + T('reader.video') + '</a>';
      f.parentNode.replaceChild(a, f);
    });

    var out = [];
    var n = 0;
    Array.prototype.forEach.call(host.children, function (node) {
      if (node.tagName === 'P' && node.textContent.trim()) {
        n++;
        out.push({ type: 'p', id: 'p' + n, html: node.innerHTML });
        return;
      }
      out.push({ type: 'raw', html: node.outerHTML });
    });
    return out;
  }

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
    var sep = window.PMI18n.dir === 'rtl' ? ' ← ' : ' → ';
    return [T('app.name')].concat(stack.map(function (f) { return f.title; })).join(sep);
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

    // The copyright notice belongs to the university branch wherever it is
    // drawn, and that branch is now a list rather than a circle screen.
    if (frame.notice === 'copyright') {
      var note = document.createElement('div');
      note.className = 'banner';
      note.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
        '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.01"/></svg>' +
        '<span>' + T('banner.copyright') + '</span>';
      el.listBody.appendChild(note);
    }

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

  // A labelled button rather than an icon in the topbar: "this one article is
  // now on your phone" is not something a glyph says clearly, and the cap
  // needs somewhere to be stated when it is reached.
  function saveButton(slug, title) {
    var b = document.createElement('button');
    b.className = 'savebtn';
    b.setAttribute('data-slug', slug);

    function draw(state, msg) {
      b.classList.toggle('is-on', state === 'on');
      b.disabled = state === 'busy';
      b.textContent = msg;
    }
    function rest() {
      draw(saved.has(slug) ? 'on' : 'off',
           saved.has(slug) ? T('save.done') : T('save.do'));
    }
    rest();

    b.addEventListener('click', function () {
      if (saved.has(slug)) { saved.remove(slug).then(rest); return; }
      if (saved.full()) {
        draw('off', T('save.full', { n: window.PMI18n.digits(SAVE_LIMIT) }));
        setTimeout(rest, 2600);
        return;
      }
      draw('busy', T('save.busy'));
      saved.add(slug, title).then(rest, function () {
        draw('off', T('save.fail'));
        setTimeout(rest, 2600);
      });
    });
    return b;
  }

  function renderArticle(doc, frame) {
    el.readerTitle.textContent = doc.title;
    el.readerCrumb.textContent = crumbText();

    var inner = document.createElement('div');
    inner.className = 'reader-inner';
    inner.innerHTML = '<h2>' + doc.title + '</h2><p class="reader-meta">' + doc.meta + '</p>';
    if (saved.available()) inner.appendChild(saveButton(frame.id, doc.title));

    var askable = 0;
    doc.blocks.forEach(function (b) {
      if (b.type === 'raw') {
        var box = document.createElement('div');
        box.className = 'reader-html';
        box.innerHTML = b.html;
        inner.appendChild(box);
        return;
      }
      askable++;
      var n = askable;
      var wrap = document.createElement('div');
      wrap.className = 'para';
      wrap.innerHTML =
        '<button class="ask" aria-label="' + T('a11y.askPara') + '">؟</button>' +
        '<p>' + b.html + '</p>';
      wrap.querySelector('.ask').addEventListener('click', function () {
        document.querySelectorAll('.para').forEach(function (p) { p.classList.remove('is-asked'); });
        wrap.classList.add('is-asked');
        openSheet('para', { n: n, articleId: frame.id, paragraphId: b.id });
      });
      inner.appendChild(wrap);
    });

    el.readerBody.innerHTML = '';
    el.readerBody.appendChild(inner);
    el.readerBody.scrollTop = 0;
    showScreen('s-reader');

    // The site writes formulas as bare \( … \) and $ … $, so nothing shows
    // until MathJax walks the tree it has just been handed.
    if (window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise([inner]).catch(function () {});
    }
  }

  /* ---- navigation ---- */

  /* An article behind the membership gate. Not a failure — the text exists
     and the reader is one free sign-up away from it, so the screen offers
     that instead of a retry button that would return the same 402. */
  function renderLocked(item) {
    el.readerTitle.textContent = item.title || '';
    el.readerCrumb.textContent = crumbText();
    el.readerBody.innerHTML =
      '<div class="reader-inner"><div class="locked">' +
        '<span class="locked-ico" aria-hidden="true">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
          '<rect x="4" y="10.5" width="16" height="11" rx="2.5"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/></svg>' +
        '</span>' +
        '<h3>' + T('gate.title') + '</h3>' +
        '<p>' + T('gate.body') + '</p>' +
        '<button class="btn" id="locked-join">' + T('gate.join') + '</button>' +
        '<p class="t-small">' + T('gate.free') + '</p>' +
      '</div></div>';
    el.readerBody.scrollTop = 0;
    $('#locked-join').addEventListener('click', showAuth);
    showScreen('s-reader');
  }

  /* Content now comes over the network, so every screen has a way to fail.
     A dead screen with no explanation is worse than a wrong one. */
  function renderFail(target, screen, retry) {
    target.innerHTML = '';
    var box = document.createElement('div');
    box.className = 'loadfail';
    box.innerHTML = '<p>' + T('err.load') + '</p>';
    var b = document.createElement('button');
    b.className = 'btn btn--ghost';
    b.textContent = T('err.retry');
    b.addEventListener('click', retry);
    box.appendChild(b);
    target.appendChild(box);
    showScreen(screen);
  }

  function open(item) {
    if (item.kind === 'chat') { openChat({ newChat: false }); return; }

    if (item.kind === 'circles') {
      animateOutThen(function () {
        stack.push(item);
        api.nodes(item.id).then(function (kids) {
          renderCircles(kids, { notice: item.notice });
        }).catch(function () {
          renderFail(el.listBody, 's-list', function () { stack.pop(); open(item); });
        });
      });
      return;
    }

    stack.push(item);
    if (item.kind === 'article') {
      api.article(item.id)
        .then(function (doc) { renderArticle(doc, item); })
        .catch(function (e) {
          if (e && e.locked) { renderLocked(item); return; }
          renderFail(el.readerBody, 's-reader', function () { stack.pop(); open(item); });
        });
    } else {
      api.nodes(item.id)
        .then(function (kids) { renderList(kids, item); })
        .catch(function () {
          renderFail(el.listBody, 's-list', function () { stack.pop(); open(item); });
        });
    }
  }

  function back() {
    if (!stack.length) return;
    var leaving = stack.pop();
    var parent = stack[stack.length - 1];

    if (!parent) {
      if (leaving && leaving.from === 'saved') { showSaved(); return; }
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
      api.article(parent.id)
        .then(function (doc) { renderArticle(doc, parent); })
        .catch(function (e) { if (e && e.locked) renderLocked(parent); });
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
      el.sheetTitle.textContent = T('sheet.aiTitle');
      el.sheetSub.textContent = T('sheet.aiSub');
    } else {
      el.sheetTitle.textContent = T('sheet.paraTitle');
      el.sheetSub.textContent = T('sheet.paraSub', { n: window.PMI18n.num(ctx.n) });
    }
    api.quota().then(function (q) {
      el.quota.hidden = !q;
      if (!q) return;
      el.quota.innerHTML = T('sheet.quota', {
        left:  window.PMI18n.num(q.total - q.used),
        total: window.PMI18n.num(q.total)
      });
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
      draft: T('sheet.draftAsk'),
      cite: T('sheet.citePara', { n: window.PMI18n.num(ctx.n || 0) })
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
     4.5 ACCOUNT FAMILY — auth · account · usage · settings
     These four screens are not part of the content stack. A chapter is
     something you are reading; the account is somewhere you stepped away
     to. So they push onto their own stack and one back press returns you
     to whatever screen opened them.
     =================================================================== */
  var pageStack = [];

  function openPage(id, render) {
    var on = document.querySelector('.screen.is-on');
    if (on) pageStack.push(on.id);
    if (render) render();
    showScreen(id);
  }
  function pageBack() { showScreen(pageStack.pop() || 's-orbs'); }
  document.querySelectorAll('[data-page-back]').forEach(function (b) {
    b.addEventListener('click', pageBack);
  });

  /* ---- account data layer ----
     Same contract as `api` above: the views never touch storage directly,
     so swapping localStorage for the REST endpoints is a change here only. */
  var account = {
    me: function () {
      try { return JSON.parse(localStorage.getItem('pm-user') || 'null'); }
      catch (e) { return null; }
    },
    save: function (u) {
      try { localStorage.setItem('pm-user', JSON.stringify(u)); } catch (e) {}
      return Promise.resolve(u);
    },
    logout: function () {
      try { localStorage.removeItem('pm-user'); } catch (e) {}
      window.PMAuth.clear();
      // Articles read as a member must not stay readable after signing out.
      cache = {};
      return Promise.resolve();
    },
    // App Store rules require this to really delete, not hide. The endpoint
    // does not exist yet — see NOTES.md.
    destroy: function () { return account.logout(); },
    usage: function () {
      return Promise.resolve({
        used: 12400, limit: 20000, remaining: 7600,
        days: [
          { label: 'day.sat', tokens: 1200 },
          { label: 'day.sun', tokens: 2400 },
          { label: 'day.mon', tokens: 800 },
          { label: 'day.tue', tokens: 3100 },
          { label: 'day.wed', tokens: 1900 },
          { label: 'day.thu', tokens: 2600 },
          { label: 'day.fri', tokens: 400 }
        ]
      });
    }
  };

  function prow(t1, t2, cls) {
    return '<button class="prow' + (cls ? ' ' + cls : '') + '">' +
             '<span class="prow-text"><span class="prow-t1">' + t1 + '</span>' +
             (t2 ? '<span class="prow-t2">' + t2 + '</span>' : '') + '</span>' +
             '<span class="prow-chev">' + ICONS.chev + '</span>' +
           '</button>';
  }

  /* ---- auth ----
     Two roads to one credential. Telegram is offered first because the
     tutor replies already arrive there, so it costs no second inbox; email
     exists because Telegram is not installed on every phone. Which of the
     two the screen actually shows is the server's call — /auth/me reports
     what it can deliver, and a method that cannot send is never drawn. */

  function showAuth() { openPage('s-auth', function () { renderAuth('start'); }); }

  var authPoll = null;
  function stopPolling() { clearInterval(authPoll); authPoll = null; }

  function authDone(res) {
    stopPolling();
    window.PMAuth.setCredential(res.credential);
    // The gate answers differently now, so a chapter fetched as a guest
    // must not be served from the session cache.
    cache = {};
    account.save({ name: res.name || T('account.guest') })
      .then(function () { showAccount(); });
  }

  function renderAuth(state, payload) {
    var box = $('#auth-state');
    stopPolling();

    if (state === 'waiting') {
      box.innerHTML =
        '<div class="waiting"><i></i>' +
          '<p class="t-body">' + T('auth.waitBody') + '</p></div>' +
        '<button class="btn" id="auth-open">' + T('auth.openTelegram') + '</button>' +
        '<button class="btn btn--ghost" id="auth-cancel">' + T('auth.cancel') + '</button>';
      $('#auth-open').addEventListener('click', function () {
        window.open(payload.deep_link, '_blank', 'noopener');
      });
      $('#auth-cancel').addEventListener('click', function () { renderAuth('start'); });
      pollTelegram(payload.token);
      return;
    }

    if (state === 'email') {
      box.innerHTML =
        '<label class="field"><span>' + T('auth.email') + '</span>' +
          '<input id="auth-email" type="email" inputmode="email" autocomplete="email" ' +
          'placeholder="' + T('auth.emailPh') + '"></label>' +
        '<button class="btn" id="auth-send">' + T('auth.sendCode') + '</button>' +
        '<p class="t-small" id="auth-msg"></p>' +
        '<button class="btn btn--ghost" id="auth-cancel">' + T('auth.cancel') + '</button>';
      $('#auth-cancel').addEventListener('click', function () { renderAuth('start'); });
      $('#auth-send').addEventListener('click', function () {
        var address = $('#auth-email').value.trim();
        if (!address) return;
        $('#auth-send').disabled = true;
        $('#auth-msg').textContent = T('auth.sending');
        window.PMAuth.emailStart(address)
          .then(function () { renderAuth('code', address); })
          .catch(function (e) {
            $('#auth-send').disabled = false;
            $('#auth-msg').textContent = e.message || T('auth.errBody');
          });
      });
      return;
    }

    if (state === 'code') {
      box.innerHTML =
        '<p class="t-body">' + T('auth.codeSent', { email: payload }) + '</p>' +
        '<label class="field"><span>' + T('auth.code6') + '</span>' +
          '<input id="auth-code" type="text" inputmode="numeric" autocomplete="one-time-code" ' +
          'maxlength="6" placeholder="------"></label>' +
        '<button class="btn" id="auth-verify">' + T('auth.verify') + '</button>' +
        '<p class="t-small" id="auth-msg"></p>' +
        '<button class="btn btn--ghost" id="auth-cancel">' + T('auth.cancel') + '</button>';
      $('#auth-cancel').addEventListener('click', function () { renderAuth('start'); });
      $('#auth-verify').addEventListener('click', function () {
        var code = $('#auth-code').value.replace(/\D/g, '');
        if (code.length !== 6) return;
        $('#auth-verify').disabled = true;
        $('#auth-msg').textContent = T('auth.checking');
        window.PMAuth.emailVerify(payload, code)
          .then(authDone)
          .catch(function (e) {
            $('#auth-verify').disabled = false;
            $('#auth-msg').textContent = e.message || T('auth.errBody');
          });
      });
      return;
    }

    if (state === 'error') {
      box.innerHTML =
        '<div class="card"><h4>' + T('auth.errTitle') + '</h4>' +
          '<p class="t-small">' + (payload || T('auth.errBody')) + '</p></div>' +
        '<button class="btn" id="auth-start">' + T('auth.retry') + '</button>';
      $('#auth-start').addEventListener('click', function () { renderAuth('start'); });
      return;
    }

    // The hero above already carries auth.h / auth.why, so the chooser is
    // only the buttons and the reason is not stated twice.
    box.innerHTML = '<p class="t-small">' + T('auth.checking') + '</p>';
    window.PMAuth.me().then(function (info) {
      var m = info.methods || {};
      var html = '';
      if (m.telegram) html += '<button class="btn" id="auth-tg">' + T('auth.start') + '</button>';
      if (m.email) html += '<button class="btn btn--ghost" id="auth-em">' + T('auth.withEmail') + '</button>';
      if (!html) html = '<div class="card"><p class="t-small">' + T('auth.noMethod') + '</p></div>';
      box.innerHTML = html + '<p class="t-small">' + T('gate.free') + '</p>';
      if (m.telegram) $('#auth-tg').addEventListener('click', startTelegram);
      if (m.email) $('#auth-em').addEventListener('click', function () { renderAuth('email'); });
    }).catch(function () { renderAuth('error'); });
  }

  function startTelegram() {
    $('#auth-state').innerHTML = '<p class="t-small">' + T('auth.checking') + '</p>';
    window.PMAuth.tgStart()
      .then(function (res) {
        renderAuth('waiting', res);
        // Opening straight away is what the tap meant; the button in the
        // waiting state is there for when the popup was blocked.
        window.open(res.deep_link, '_blank', 'noopener');
      })
      .catch(function (e) { renderAuth('error', e.message); });
  }

  /* The bot tells the server, not the app. Three seconds is the gap between
     "did it work?" and hammering an endpoint; the token dies after fifteen
     minutes and so does this. */
  function pollTelegram(tok) {
    var until = Date.now() + 15 * 60 * 1000;
    authPoll = setInterval(function () {
      if (Date.now() > until) { renderAuth('error'); return; }
      window.PMAuth.tgPoll(tok)
        .then(function (res) { if (res.status === 'ready') authDone(res); })
        .catch(function (e) { if (e.status === 410) renderAuth('error'); });
    }, 3000);
  }

  /* ---- account ---- */

  function showAccount() { openPage('s-account', function () { drawAccount(account.me()); }); }

  function drawAccount(u) {
    var box = $('#account-body');
    if (!u) {
      box.innerHTML =
        '<div class="card"><h4>' + T('account.guest') + '</h4>' +
          '<p class="t-small">' + T('account.signIn') + '</p>' +
          '<button class="btn" id="acc-login">' + T('auth.start') + '</button></div>' +
        // The library belongs to the phone, not to an account, and there is
        // no sign-in yet — putting it only in the signed-in branch would
        // make it unreachable for everyone.
        prow(T('saved.title'), T('saved.sub'));
      $('#acc-login').addEventListener('click', showAuth);
      box.querySelector('.prow').addEventListener('click', showSaved);
      return;
    }

    box.innerHTML =
      '<div class="who">' +
        '<span class="avatar">' + (u.name || '؟').slice(0, 1) + '</span>' +
        '<span class="who-t1">' + (u.name || '') + '</span>' +
        '<span class="who-t2">' + (u.telegram || '') + '</span>' +
      '</div>' +
      '<label class="field"><span>' + T('account.name') + '</span>' +
        '<input id="acc-name" placeholder="' + T('account.namePh') + '" value="' + (u.name || '') + '"></label>' +
      '<button class="btn" id="acc-save">' + T('account.save') + '</button>' +
      prow(T('account.usage'), T('account.usageSub')) +
      prow(T('account.settings'), T('account.settingsSub')) +
      prow(T('saved.title'), T('saved.sub')) +
      '<button class="btn btn--ghost" id="acc-out">' + T('account.logout') + '</button>' +
      prow(T('account.delete'), T('account.deleteSub'), 'prow--danger') +
      '<div class="confirm" id="acc-confirm" hidden>' +
        '<h5>' + T('account.deleteAsk') + '</h5>' +
        '<p>' + T('account.deleteBody') + '</p>' +
        '<div class="row2">' +
          '<button class="yes">' + T('account.deleteYes') + '</button>' +
          '<button class="no">' + T('account.deleteNo') + '</button>' +
        '</div>' +
      '</div>';

    var rows = box.querySelectorAll('.prow');
    $('#acc-save').addEventListener('click', function (e) {
      u.name = $('#acc-name').value.trim() || u.name;
      account.save(u).then(function () { e.target.textContent = T('account.saved'); });
    });
    rows[0].addEventListener('click', showUsage);
    rows[1].addEventListener('click', showSettings);
    rows[2].addEventListener('click', showSaved);
    $('#acc-out').addEventListener('click', function () {
      account.logout().then(function () { drawAccount(null); });
    });
    rows[3].addEventListener('click', function () { $('#acc-confirm').hidden = false; });
    $('#acc-confirm').querySelector('.no').addEventListener('click', function () {
      $('#acc-confirm').hidden = true;
    });
    $('#acc-confirm').querySelector('.yes').addEventListener('click', function () {
      account.destroy().then(function () { drawAccount(null); });
    });
  }

  /* ---- offline library ---- */

  function showSaved() { openPage('s-saved', drawSaved); }

  function drawSaved() {
    var box = $('#saved-body');
    var list = saved.list();

    if (!list.length) {
      box.innerHTML = '<div class="card"><h4>' + T('saved.emptyTitle') + '</h4>' +
        '<p class="t-small">' + T('saved.emptyBody') + '</p></div>';
      return;
    }

    box.innerHTML =
      '<p class="note">' + T('saved.count', {
        n: window.PMI18n.digits(list.length),
        max: window.PMI18n.digits(SAVE_LIMIT)
      }) + '</p>' +
      list.map(function (a) {
        return '<div class="srow">' +
                 '<button class="srow-open">' + a.title + '</button>' +
                 '<button class="srow-del" aria-label="' + T('saved.remove') + '">✕</button>' +
               '</div>';
      }).join('') +
      '<button class="btn btn--ghost" id="saved-clear">' + T('saved.clearAll') + '</button>';

    box.querySelectorAll('.srow').forEach(function (row, i) {
      var a = list[i];
      row.querySelector('.srow-open').addEventListener('click', function () {
        // The library is not a node in the content tree — offline there is
        // no tree to be in — so the article opens as a root and carries a
        // note saying where it came from, which is what Back reads.
        stack.length = 0;
        open({ id: a.slug, kind: 'article', title: a.title, from: 'saved' });
      });
      row.querySelector('.srow-del').addEventListener('click', function () {
        saved.remove(a.slug).then(drawSaved);
      });
    });
    $('#saved-clear').addEventListener('click', function () {
      saved.clear().then(drawSaved);
    });
  }

  /* ---- usage ---- */

  function showUsage() {
    openPage('s-usage', function () {
      account.usage().then(function (q) {
        var over = q.remaining < 0;
        var peak = Math.max.apply(null, q.days.map(function (d) { return d.tokens; })) || 1;
        var cap = q.limit / 7;

        $('#usage-body').innerHTML =
          '<div class="stats">' +
            '<div class="stat"><b>' + window.PMI18n.num(q.used) + '</b><span>' + T('usage.used') + '</span></div>' +
            '<div class="stat"><b>' + window.PMI18n.num(q.limit) + '</b><span>' + T('usage.limit') + '</span></div>' +
            '<div class="stat' + (over ? ' stat--debt' : '') + '"><b>' +
              window.PMI18n.num(q.remaining) + '</b><span>' + T('usage.remaining') + '</span></div>' +
          '</div>' +
          '<div class="card"><h4>' + T('usage.week') + '</h4><div class="bars">' +
            q.days.map(function (d) {
              return '<div class="bar' + (d.tokens > cap ? ' over' : '') + '">' +
                       '<i style="height:' + Math.round(d.tokens / peak * 100) + '%"></i>' +
                       '<u>' + T(d.label) + '</u></div>';
            }).join('') +
          '</div></div>' +
          (over ? '<p class="note">' + T('usage.debtNote') + '</p>' : '');
      });
    });
  }

  /* ---- settings ---- */

  var THEMES = [
    { v: 'light',  k: 'settings.themeLight' },
    { v: 'dark',   k: 'settings.themeDark'  },
    { v: 'system', k: 'settings.themeAuto'  }
  ];

  function theme() {
    try { return localStorage.getItem('pm-theme') || 'system'; } catch (e) { return 'system'; }
  }
  function setTheme(v) {
    try { localStorage.setItem('pm-theme', v); } catch (e) {}
    applyTheme();
  }
  // "system" means: remove the attribute and let the prefers-color-scheme
  // media query in tokens.css decide. Anything else pins it.
  function applyTheme() {
    var v = theme();
    if (v === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', v);
  }

  var VERSION = '0.3.0';

  function showSettings() { openPage('s-settings', drawSettings); }

  function drawSettings() {
    $('#settings-body').innerHTML =
      '<div class="card"><h4>' + T('settings.language') + '</h4>' +
        '<div class="seg" id="set-lang">' +
          '<button data-v="fa">فارسی</button>' +
          '<button data-v="en">English</button>' +
        '</div></div>' +
      '<div class="card"><h4>' + T('settings.theme') + '</h4>' +
        '<div class="seg" id="set-theme">' +
          THEMES.map(function (o) {
            return '<button data-v="' + o.v + '">' + T(o.k) + '</button>';
          }).join('') +
        '</div></div>' +
      '<div class="card"><h4>' + T('settings.pyCache') + '</h4>' +
        '<p class="t-small">' + T('settings.pyCacheSub') + '</p>' +
        '<button class="btn btn--ghost" id="set-clear">' + T('settings.clear') + '</button></div>' +
      '<p class="note">' + T('settings.version', { v: window.PMI18n.digits(VERSION) }) + '</p>';

    function seg(id, current, onPick) {
      var box = $(id);
      box.querySelectorAll('button').forEach(function (b) {
        b.classList.toggle('on', b.getAttribute('data-v') === current);
        b.addEventListener('click', function () { onPick(b.getAttribute('data-v')); });
      });
    }
    seg('#set-lang', window.PMI18n.lang, function (v) {
      window.PMI18n.set(v);
      drawSettings();
      refreshContent();
    });
    seg('#set-theme', theme(), function (v) { setTheme(v); drawSettings(); });

    $('#set-clear').addEventListener('click', function (e) {
      window.PMChat.resetPython().then(function () {
        e.target.textContent = T('settings.cleared');
      });
    });
  }

  // A language switch rewrites static markup, but anything JS painted has to
  // be painted again. renderCircles navigates as well as paints, so the
  // active screen is restored afterwards — the switch happens in Settings and
  // must not throw you back to the home circles.
  function refreshContent() {
    var here = document.querySelector('.screen.is-on');
    var u = account.me();
    if (document.querySelector('#account-body').children.length) drawAccount(u);
    var parent = stack.length ? stack[stack.length - 1] : null;
    if (parent && parent.kind === 'article') {
      api.article(parent.id).then(function (doc) {
        renderArticle(doc, parent);
        if (here) showScreen(here.id);
      });
      return;
    }
    var circles = !parent || parent.kind === 'circles';
    api.nodes(parent ? parent.id : 'root').then(function (kids) {
      if (circles) renderCircles(kids, { notice: parent && parent.notice });
      else renderList(kids, parent);
      if (here) showScreen(here.id);
    });
  }

  $('#orb-account').addEventListener('click', showAccount);

  /* ===================================================================
     4.6 ONBOARDING
     Three cards, once. Not a tour of the UI — a statement of what the app
     is for, which is the only thing a first-time visitor cannot guess.
     =================================================================== */
  (function onboarding() {
    var seen = false;
    try { seen = localStorage.getItem('pm-onboarded') === '1'; } catch (e) {}
    if (seen) return;

    var box = $('#onboard');
    var track = $('#onb-track');
    var dots = $('#onb-dots');
    var next = $('#onb-next');
    var pages = [
      { icon: ICONS.book,   k: '1' },
      { icon: ICONS.wiki,   k: '2' },
      { icon: ICONS.rocket, k: '3' }
    ];
    var at = 0;

    track.innerHTML = pages.map(function (p) {
      return '<div class="onb-page"><span class="hero-ico">' + p.icon + '</span>' +
               '<h2 class="t-h1">' + T('onb.' + p.k + 't') + '</h2>' +
               '<p class="t-body">' + T('onb.' + p.k + 'b') + '</p></div>';
    }).join('');
    dots.innerHTML = pages.map(function () { return '<i></i>'; }).join('');

    function draw() {
      track.style.transform = 'translateX(' +
        (window.PMI18n.dir === 'rtl' ? at * 100 : at * -100) + '%)';
      dots.querySelectorAll('i').forEach(function (d, i) { d.classList.toggle('on', i === at); });
      next.textContent = T(at === pages.length - 1 ? 'onb.start' : 'onb.next');
    }
    function done() {
      box.hidden = true;
      try { localStorage.setItem('pm-onboarded', '1'); } catch (e) {}
    }

    next.addEventListener('click', function () {
      if (at === pages.length - 1) return done();
      at++; draw();
    });
    $('#onb-skip').addEventListener('click', done);

    box.hidden = false;
    draw();
  })();

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
     5.1 Update check
     The APK is side-loaded from the site, not Google Play, so nothing
     updates it on its own. The web build is excluded: its service
     worker already replaces itself, and there is no APK to offer.
     =================================================================== */
  (function updateCheck() {
    var native = !!(window.Capacitor && window.Capacitor.isNativePlatform &&
                    window.Capacitor.isNativePlatform());
    if (!native) return;

    var DAY = 86400000;
    var last = 0;
    try { last = parseInt(localStorage.getItem('update-checked') || '0', 10) || 0; } catch (e) {}
    if (Date.now() - last < DAY) return;

    // Pads the shorter side so "0.2" loses to "0.2.1" instead of tying.
    function newer(a, b) {
      var x = String(a).split('.'), y = String(b).split('.');
      for (var i = 0; i < Math.max(x.length, y.length); i++) {
        var d = (parseInt(x[i], 10) || 0) - (parseInt(y[i], 10) || 0);
        if (d) return d > 0;
      }
      return false;
    }

    fetch('https://physicsme.ir/wp-json/pm/v1/app-version', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (info) {
        try { localStorage.setItem('update-checked', String(Date.now())); } catch (e) {}
        if (!info || !info.latest || !info.apk_url) return;
        if (!newer(info.latest, VERSION)) return;

        var skipped = '';
        try { skipped = localStorage.getItem('update-skipped') || ''; } catch (e) {}
        if (skipped === info.latest) return;

        var tip = $('#update-tip');
        $('#update-tip-text').textContent =
          T('update.available', { v: window.PMI18n.digits(info.latest) });
        var link = $('#update-tip-link');
        link.textContent = T('update.get');
        link.href = info.apk_url;
        tip.hidden = false;

        $('#update-tip-close').addEventListener('click', function () {
          tip.hidden = true;
          // Silence this version only — the next one asks again.
          try { localStorage.setItem('update-skipped', info.latest); } catch (e) {}
        });
      })
      .catch(function () {});
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
  applyTheme();
  window.PMI18n.apply();
  window.PMChat.init();
  api.nodes('root').then(function (kids) { renderCircles(kids, {}); });
})();
