/* =====================================================================
   من فیزیکی — chat module
   ---------------------------------------------------------------------
   Exposes window.PMChat.open(opts). Everything that touches the network
   lives in `api` at the top; the views never fetch. Set MOCK = false once
   token auth exists (see docs/api-contract.md — cookie+nonce does not
   work from a packaged app).
   ===================================================================== */

window.PMChat = (function () {
  'use strict';

  var MOCK = true;                       // flip to false when auth is ready
  var BASE = 'https://physicsme.ir/wp-json/physicalme/v1';

  /* ===================================================================
     1. API — shapes taken verbatim from the plugin (REPORT.md §1.3)
     =================================================================== */

  function authHeaders() {
    var h = { 'Content-Type': 'application/json' };
    var t = null;
    try { t = localStorage.getItem('pm-auth'); } catch (e) {}
    if (t) h['Authorization'] = 'Basic ' + t;   // WP Application Passwords
    return h;
  }

  var api = {
    // GET /chat/sessions → [{id,title,date,tokens}] — max 60, no paging yet
    sessions: function () {
      if (MOCK) return Promise.resolve(FIXTURES.sessions.slice());
      return fetch(BASE + '/chat/sessions', { headers: authHeaders() }).then(r => r.json());
    },

    // GET /chat/sessions/{id} → [{role,message}]  ⚠ no log_id, so rating is
    // dead on a reloaded conversation until the backend adds it
    session: function (id) {
      if (MOCK) return Promise.resolve(FIXTURES.messages[id] || []);
      return fetch(BASE + '/chat/sessions/' + id, { headers: authHeaders() }).then(r => r.json());
    },

    rename: function (id, title) {
      if (MOCK) return Promise.resolve({ ok: true, title: title });
      return fetch(BASE + '/chat/sessions/' + id + '/rename', {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ title: title })
      }).then(r => r.json());
    },

    // soft delete: sets wp_pm_chat_sessions.is_hidden = 1. Messages stay.
    hide: function (id) {
      if (MOCK) return Promise.resolve({ ok: true });
      return fetch(BASE + '/chat/sessions/' + id + '/hide', {
        method: 'POST', headers: authHeaders(), body: '{}'
      }).then(r => r.json());
    },

    rate: function (logId, rating, sessionId) {
      if (MOCK) return Promise.resolve({ ok: true });
      return fetch(BASE + '/chat/rate', {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ log_id: logId, rating: rating, session_id: sessionId })
      }).then(r => r.json());
    },

    /* POST /chat — SSE over fetch, NOT EventSource.
       EventSource is GET-only and cannot send auth headers, which is why
       the site reads the body by hand. Same approach here.
       handlers: { status, token, source, translation, done, error } */
    stream: function (payload, handlers, signal) {
      if (MOCK) return mockStream(payload, handlers, signal);

      return fetch(BASE + '/chat', {
        method: 'POST', headers: authHeaders(), body: JSON.stringify(payload), signal: signal
      }).then(function (res) {
        if (!res.ok) {
          return res.json().then(function (j) {
            var msg = (j && j.data && j.data.message) || (j && j.message) || 'خطای ناشناخte';
            handlers.error({ status: res.status, message: msg, code: j && j.data && j.data.code });
          });
        }
        var reader = res.body.getReader();
        var dec = new TextDecoder();
        var buf = '';

        function pump() {
          return reader.read().then(function (r) {
            if (r.done) return;
            buf += dec.decode(r.value, { stream: true });
            var parts = buf.split('\n\n');
            buf = parts.pop();
            parts.forEach(function (chunk) {
              var ev = 'message', data = '';
              chunk.split('\n').forEach(function (line) {
                if (line.indexOf('event:') === 0) ev = line.slice(6).trim();
                else if (line.indexOf('data:') === 0) data += line.slice(5).trim();
              });
              if (!data) return;
              var parsed;
              try { parsed = JSON.parse(data); } catch (e) { return; }
              if (handlers[ev]) handlers[ev](parsed);
            });
            return pump();
          });
        }
        return pump();
      }).catch(function (err) {
        if (err.name === 'AbortError') return;      // user pressed stop
        handlers.error({ status: 0, message: 'ارتباط با دستیار قطع شد. اینترنت را بررسی کن.' });
      });
    }
  };

  /* ===================================================================
     2. Rendering an answer
     Markdown: marked@9. Math: MathJax 3 (CHTML). Both must be BUNDLED,
     not pulled from a CDN — see docs/api-contract.md.
     =================================================================== */

  function renderAnswer(el, text) {
    if (window.marked) {
      el.innerHTML = window.marked.parse(text, { breaks: true, gfm: true });
    } else {
      el.textContent = text;                       // honest fallback
    }
    decorateCode(el);
    if (window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise([el]).catch(function () {});
    }
  }

  // Code blocks get copy + run. They stay LTR inside an RTL bubble.
  function decorateCode(el) {
    el.querySelectorAll('pre').forEach(function (pre) {
      if (pre.parentNode.classList.contains('codewrap')) return;
      var wrap = document.createElement('div');
      wrap.className = 'codewrap';
      pre.parentNode.insertBefore(wrap, pre);
      wrap.appendChild(pre);

      var bar = document.createElement('div');
      bar.className = 'codebar';
      var code = pre.textContent;
      var isPy = /language-python/.test(pre.querySelector('code') ? pre.querySelector('code').className : '')
                 || /^\s*(import|from|def|print\()/m.test(code);

      if (isPy) {
        var run = document.createElement('button');
        run.className = 'codebtn run';
        run.textContent = '▶ اجرا';
        run.addEventListener('click', function () { Py.open(code); });
        bar.appendChild(run);
      }
      var cp = document.createElement('button');
      cp.className = 'codebtn';
      cp.textContent = 'کپی';
      cp.addEventListener('click', function () { copy(code, cp, 'کپی شد', 'کپی'); });
      bar.appendChild(cp);
      wrap.appendChild(bar);
    });
  }

  function copy(text, btn, okLabel, backLabel) {
    var done = function () {
      if (!btn) return;
      if (okLabel) { btn.textContent = okLabel; btn.classList.add('copied'); }
      else btn.classList.add('on');
      setTimeout(function () {
        if (backLabel) btn.textContent = backLabel;
        btn.classList.remove('copied', 'on');
      }, 1600);
    };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, done);
    else done();
  }

  /* ===================================================================
     3. State
     =================================================================== */

  var S = {
    chats: [],
    active: null,
    quota: { remaining: null, limit: 100000 },
    streaming: false,
    abort: null,
    filter: '',
    draftCite: null,
    onClose: null
  };

  var FA = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
  function fa(n) { return String(n).replace(/\d/g, d => FA[+d]); }
  function faNum(n) {
    var s = Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '٬');
    return (n < 0 ? '−' : '') + fa(s);
  }
  function $(s) { return document.querySelector(s); }

  // The backend titles a chat with the user's whole first message cut at 70
  // chars, so the list reads as near-identical sentences. Until a server-side
  // LLM title exists, a topic chip gives the eye something to sort on.
  function topicOf(title) {
    if (/کد|پایتون|python|برنامه/i.test(title)) return 'کد';
    if (/بار|الکتر|جریان|ولتاژ|مقاومت/.test(title)) return 'الکتریسیته';
    if (/نیرو|شتاب|حرکت|نیوتن|پرتاب|سقوط/.test(title)) return 'مکانیک';
    if (/گرما|دما|انرژی|ترمو/.test(title)) return 'گرما';
    if (/نور|موج|عدسی|بازتاب/.test(title)) return 'نور';
    if (/اتم|کوانتوم|هسته/.test(title)) return 'کوانتوم';
    return 'فیزیک';
  }

  /* ===================================================================
     4. Quota — four states, including debt.
     The plugin gates on `used < limit`, not `used + cost <= limit`, so a
     single answer can overshoot and `remaining` goes negative. That excess
     carries into tomorrow. The badge must render a negative number.
     =================================================================== */

  function quotaClass() {
    var r = S.quota.remaining;
    if (r === null) return 'ok';           // admin: unlimited
    if (r < 0) return 'debt';
    if (r === 0) return 'out';
    if (r < S.quota.limit * 0.1) return 'low';
    return 'ok';
  }

  function renderQuota() {
    var r = S.quota.remaining, cls = quotaClass(), blocked = (r !== null && r <= 0);

    var badge = $('#chat-tokbadge');
    badge.className = 'tokbadge ' + cls;
    $('#chat-tokval').textContent = (r === null) ? '∞' : faNum(r);
    $('#drawer-quota').textContent = (r === null ? '∞' : faNum(r)) + ' توکن';

    var meter = $('#chat-meter');
    meter.className = 'meter' + (cls === 'low' || cls === 'debt' ? ' warn' : '');
    if (r === null)   meter.innerHTML = 'سهمیهٔ نامحدود';
    else if (r < 0)   meter.innerHTML = 'سهمیهٔ امروز تمام شده و <b>' + faNum(-r) + ' توکن</b> به فردا منتقل می‌شود';
    else if (r === 0) meter.innerHTML = 'سهمیهٔ امروز تمام شد';
    else              meter.innerHTML = '<b>' + faNum(r) + ' توکن</b> از سهمیهٔ امروز باقی مانده';

    var wall = $('#chat-wall');
    wall.innerHTML = '';
    if (blocked) {
      wall.innerHTML =
        '<div class="wall"><h5>سقف سؤال‌های امروز تمام شد</h5><p>' +
        (r < 0 ? 'آخرین پاسخ از سقف عبور کرد، پس فردا با ' + faNum(-r) + ' توکن بدهی شروع می‌کنی.'
               : 'فردا سهمیهٔ تازه می‌گیری.') +
        '</p><button id="quota-cta">دیدن مصرف و ارتقای حساب</button></div>';
    }

    var box = $('#chat-composer');
    box.disabled = blocked || S.streaming;
    box.placeholder = blocked ? 'تا فردا نمی‌توانی سؤال بفرستی' : 'سؤالت را بنویس…';
    syncSend();
  }

  /* ===================================================================
     5. Messages
     =================================================================== */

  var SRC = {
    site:     ['site', '📖 از مقالات سایت'],
    external: ['external', '🔗 منبع خارجی'],
    general:  ['general', '💭 دانش عمومی'],
    code:     ['code', '🐍 کد']
  };

  var ICON = {
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/></svg>',
    up:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10.5v9H4.5v-9z"/><path d="M7 10.5 11.5 4a1.8 1.8 0 0 1 3 1.6l-.7 3.7h4.4a1.9 1.9 0 0 1 1.85 2.3l-1.1 5.5A2.4 2.4 0 0 1 16.6 19H7z"/></svg>',
    down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 13.5v-9H4.5v9z"/><path d="M7 13.5 11.5 20a1.8 1.8 0 0 0 3-1.6l-.7-3.7h4.4a1.9 1.9 0 0 0 1.85-2.3l-1.1-5.5A2.4 2.4 0 0 0 16.6 5H7z"/></svg>',
    refresh:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-1.5 5.5"/><path d="M20 5v6h-6"/></svg>',
    pencil:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
    trash:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M9.5 7V5.2h5V7"/><path d="M6.4 7l.8 12.2a1.6 1.6 0 0 0 1.6 1.5h6.4a1.6 1.6 0 0 0 1.6-1.5L17.6 7"/><path d="M10.2 10.8v6M13.8 10.8v6"/></svg>',
    atom: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="2.3" fill="currentColor" stroke="none"/><ellipse cx="12" cy="12" rx="10" ry="4.4"/><ellipse cx="12" cy="12" rx="10" ry="4.4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4.4" transform="rotate(-60 12 12)"/></svg>'
  };

  var SEEDS = [
    ['؟', 'تفاوت بار و جرم چیست؟'],
    ['Σ', 'قانون دوم نیوتن را با مثال توضیح بده'],
    ['🐍', 'کد پایتون سقوط آزاد با نمودار بنویس']
  ];

  function messageNode(m) {
    var wrap = document.createElement('div');
    wrap.className = 'msg ' + (m.role === 'user' ? 'me' : 'ai') + (m.error ? ' err' : '');

    var bubble = document.createElement('div');
    bubble.className = 'bubble' + (m.streaming ? ' typing' : '');
    if (m.role === 'user') bubble.textContent = m.message;
    else if (m.error) bubble.textContent = '⚠️ ' + m.message;
    else renderAnswer(bubble, m.message);
    wrap.appendChild(bubble);
    m._el = bubble;

    if (m.role !== 'user' && !m.streaming) {
      var foot = document.createElement('div');
      foot.className = 'msg-foot';

      if (m.source && SRC[m.source]) {
        var b = document.createElement('span');
        b.className = 'srcbadge ' + SRC[m.source][0];
        b.textContent = SRC[m.source][1];
        foot.appendChild(b);
      }

      if (m.error) {
        var rt = document.createElement('button');
        rt.className = 'retry';
        rt.innerHTML = ICON.refresh + 'تلاش دوباره';
        rt.addEventListener('click', retryLast);
        foot.appendChild(rt);
      } else {
        var acts = document.createElement('div');
        acts.className = 'msg-acts';

        // message-level copy: the site has this only on code blocks, which
        // makes an answer effectively uncopyable on a phone
        var cp = document.createElement('button');
        cp.className = 'act'; cp.innerHTML = ICON.copy;
        cp.setAttribute('aria-label', 'کپی پاسخ');
        cp.addEventListener('click', function () { copy(m.message, cp); });
        acts.appendChild(cp);

        [['up', 1], ['down', -1]].forEach(function (p) {
          var btn = document.createElement('button');
          btn.className = 'act' + (m.rating === p[1] ? ' on' : '');
          btn.innerHTML = ICON[p[0]];
          btn.setAttribute('aria-label', p[1] === 1 ? 'مفید بود' : 'مفید نبود');
          // log_id only arrives in the `done` event of a live stream, so a
          // reloaded conversation cannot be rated until the API returns it
          btn.disabled = !m.log_id;
          btn.addEventListener('click', function () {
            m.rating = m.rating === p[1] ? 0 : p[1];
            api.rate(m.log_id, m.rating, S.active.id);
            renderMessages();
          });
          acts.appendChild(btn);
        });
        foot.appendChild(acts);
      }
      wrap.appendChild(foot);
    }
    return wrap;
  }

  function renderMessages() {
    var scroll = $('#chat-scroll');
    scroll.innerHTML = '';

    if (!S.active.msgs.length && !S.streaming) {
      var e = document.createElement('div');
      e.className = 'chat-empty';
      e.innerHTML =
        '<span class="glyph">' + ICON.atom + '</span>' +
        '<h3>چه چیزی را نفهمیدی؟</h3>' +
        '<p>هر جای مقاله گیر کردی، روی علامت ؟ کنار همان پاراگراف بزن تا سؤالت با متنش اینجا بیاید. یا یکی از این‌ها را امتحان کن:</p>' +
        '<div class="seeds">' +
          SEEDS.map(s => '<button class="seed"><span class="k">' + s[0] + '</span>' + s[1] + '</button>').join('') +
        '</div>';
      scroll.appendChild(e);
      e.querySelectorAll('.seed').forEach(function (btn, i) {
        btn.addEventListener('click', function () {
          var box = $('#chat-composer');
          box.value = SEEDS[i][1];
          autogrow(); syncSend(); box.focus();
        });
      });
      return;
    }

    S.active.msgs.forEach(function (m) { scroll.appendChild(messageNode(m)); });

    if (S.streaming) {
      var st = document.createElement('div');
      st.className = 'status'; st.id = 'stream-status';
      st.innerHTML = '<i></i><span>در حال فکر کردن…</span>';
      scroll.appendChild(st);
    }
    if (S.active.stopped) {
      var s = document.createElement('div');
      s.className = 'stopped';
      // the server does not persist partial output on abort — say so
      s.textContent = 'تولید پاسخ متوقف شد — این متن ذخیره نشده است';
      scroll.appendChild(s);
    }
    scroll.scrollTop = scroll.scrollHeight;
  }

  /* ===================================================================
     6. Sending
     =================================================================== */

  function autogrow() {
    var b = $('#chat-composer');
    b.style.height = 'auto';
    b.style.height = Math.min(b.scrollHeight, 110) + 'px';
  }
  function syncSend() {
    var b = $('#chat-composer');
    $('#chat-send').disabled = b.disabled || b.value.trim() === '';
  }

  function send() {
    var box = $('#chat-composer');
    var text = box.value.trim();
    if (!text || S.streaming) return;

    S.active.msgs.push({ role: 'user', message: text });
    if (!S.active.title) {
      S.active.title = text.length > 70 ? text.slice(0, 70) : text;
      S.active.topic = topicOf(text);
      $('#chat-title').textContent = S.active.title;
    }
    box.value = '';
    $('#chat-draft').innerHTML = '';
    S.draftCite = null;
    autogrow();

    var answer = { role: 'assistant', message: '', streaming: true, rating: 0 };
    S.active.msgs.push(answer);
    S.streaming = true;
    S.active.stopped = false;
    $('#chat-stop').hidden = false;
    $('#chat-send').hidden = true;
    renderQuota();
    renderMessages();

    S.abort = new AbortController();

    api.stream(
      {
        message: text,
        // history is kept client-side and resent whole; the server keeps the
        // last 20 turns and never reads history from the database
        history: S.active.msgs.filter(m => !m.streaming && !m.error)
                              .map(m => ({ role: m.role, message: m.message })),
        session_id: S.active.id,
        lang: 'fa'
      },
      {
        status: function (d) {
          var st = document.getElementById('stream-status');
          if (st) st.querySelector('span').textContent = d.text;
        },
        token: function (d) {
          answer.message += d.text;
          if (answer._el) renderAnswer(answer._el, answer.message);
          var sc = $('#chat-scroll');
          sc.scrollTop = sc.scrollHeight;
        },
        source: function (d) { answer.source = d.type; },
        translation: function (d) { answer.translation = d.text; },
        done: function (d) {
          answer.streaming = false;
          answer.log_id = d.log_id;
          S.active.id = d.session_id || S.active.id;
          S.active.tokens = (S.active.tokens || 0) + (d.response_tokens || 0);
          if (typeof d.remaining === 'number') S.quota.remaining = d.remaining;
          if (d.provider) $('#chat-sub').textContent = 'پاسخ‌دهنده: ' + d.provider;
          finish();
        },
        error: function (e) {
          answer.streaming = false;
          answer.error = true;
          answer.message = e.message;
          if (e.code === 'limit_reached') S.quota.remaining = 0;
          finish();
        }
      },
      S.abort.signal
    );
  }

  function finish() {
    S.streaming = false;
    S.abort = null;
    $('#chat-stop').hidden = true;
    $('#chat-send').hidden = false;
    renderQuota();
    renderMessages();
    renderList();
  }

  function stop() {
    if (S.abort) S.abort.abort();
    var last = S.active.msgs[S.active.msgs.length - 1];
    if (last && last.streaming) {
      if (!last.message) S.active.msgs.pop();
      else last.streaming = false;
    }
    S.active.stopped = true;
    finish();
  }

  function retryLast() {
    var last = S.active.msgs[S.active.msgs.length - 1];
    if (!last || !last.error) return;
    S.active.msgs.pop();
    var prev = S.active.msgs.pop();          // the user message that failed
    renderMessages();
    if (prev) { $('#chat-composer').value = prev.message; autogrow(); send(); }
  }

  /* ===================================================================
     7. Conversation list
     =================================================================== */

  function renderList() {
    var list = $('#chat-list');
    list.innerHTML = '';

    var shown = S.chats.filter(function (c) {
      if (!S.filter) return true;
      return (c.title || '').indexOf(S.filter) !== -1 || (c.topic || '').indexOf(S.filter) !== -1;
    });
    if (!shown.length) {
      list.innerHTML = '<div class="list-head">چیزی پیدا نشد</div>';
      return;
    }

    var groups = {};
    shown.forEach(function (c) {
      var g = groupOf(c.date);
      (groups[g] = groups[g] || []).push(c);
    });

    Object.keys(groups).forEach(function (g) {
      var h = document.createElement('div');
      h.className = 'list-head'; h.textContent = g;
      list.appendChild(h);
      groups[g].forEach(function (c) {
        var row = document.createElement('div');
        row.className = 'chat-item' + (S.active && c.id === S.active.id ? ' active' : '');
        drawRow(row, c);
        list.appendChild(row);
      });
    });
  }

  // `date` is a MySQL string with no timezone — treat it as UTC explicitly,
  // or every conversation shifts by the device offset.
  function groupOf(dateStr) {
    if (!dateStr) return 'امروز';
    var d = new Date(dateStr.replace(' ', 'T') + 'Z');
    var days = Math.floor((Date.now() - d.getTime()) / 86400000);
    if (days < 1) return 'امروز';
    if (days < 2) return 'دیروز';
    if (days < 8) return 'هفتهٔ گذشته';
    return 'قدیمی‌تر';
  }

  function drawRow(row, c) {
    row.innerHTML =
      '<button class="name"><span class="n1"></span>' +
      '<span class="n2"><span class="topic"></span><span class="tk"></span></span></button>' +
      '<button class="chat-act" data-act="rename" aria-label="تغییر نام">' + ICON.pencil + '</button>' +
      '<button class="chat-act" data-act="del" aria-label="حذف">' + ICON.trash + '</button>';

    row.querySelector('.n1').textContent = c.title || 'گفتگوی جدید';
    row.querySelector('.topic').textContent = c.topic || topicOf(c.title || '');
    row.querySelector('.tk').textContent = faNum(c.tokens || 0) + ' توکن';

    row.querySelector('.name').addEventListener('click', function () {
      closeDrawer(); openChat(c);
    });

    // rename happens in place, exactly as on the site — no system dialog
    row.querySelector('[data-act="rename"]').addEventListener('click', function () {
      row.innerHTML = '';
      var inp = document.createElement('input');
      inp.className = 'rename-input'; inp.value = c.title || ''; inp.maxLength = 120;
      row.appendChild(inp); inp.focus(); inp.select();
      var committed = false;
      function commit() {
        if (committed) return; committed = true;
        var v = inp.value.trim();
        if (v && v !== c.title) { c.title = v; api.rename(c.id, v); }
        if (S.active && S.active.id === c.id) $('#chat-title').textContent = c.title;
        renderList();
      }
      inp.addEventListener('blur', commit);
      inp.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); commit(); }
        if (e.key === 'Escape') { committed = true; renderList(); }
      });
    });

    row.querySelector('[data-act="del"]').addEventListener('click', function () {
      row.innerHTML =
        '<div class="delbar"><p>این گفتگو حذف شود؟</p>' +
        '<p class="keeps">از فهرست می‌رود؛ مصرف توکن ثبت‌شده باقی می‌ماند.</p>' +
        '<div class="row2"><button class="del-yes">حذف</button><button class="del-no">انصراف</button></div></div>';
      row.querySelector('.del-no').addEventListener('click', renderList);
      row.querySelector('.del-yes').addEventListener('click', function () {
        api.hide(c.id);
        S.chats = S.chats.filter(x => x.id !== c.id);
        if (S.active && S.active.id === c.id) newChat();
        renderList();
      });
    });
  }

  function openDrawer() { $('#chat-drawer').classList.add('on'); $('#chat-scrim').classList.add('on'); renderList(); }
  function closeDrawer() { $('#chat-drawer').classList.remove('on'); $('#chat-scrim').classList.remove('on'); }

  /* ===================================================================
     8. Python runner — Pyodide, on device, lazily
     =================================================================== */

  var Py = {
    loaded: null,
    code: '',

    open: function (code) {
      Py.code = code;
      $('#pysheet').classList.add('on');
      Py.render(Py.loaded ? 'ready' : 'warn');
    },
    close: function () { $('#pysheet').classList.remove('on'); },

    // Bundle pyodide with the app; do not load it from a CDN.
    load: function () {
      if (Py.loaded) return Promise.resolve(Py.loaded);
      if (!window.loadPyodide) return Promise.reject(new Error('Pyodide bundle not found'));
      return window.loadPyodide({ indexURL: 'vendor/pyodide/' }).then(function (p) {
        Py.loaded = p; return p;
      });
    },

    render: function (state, payload) {
      var body = $('#py-body'), foot = $('#py-foot');
      var codeHtml = '<pre class="py-code"></pre>';

      if (state === 'warn') {
        // Not a toast: this is the user deciding to spend their phone's RAM.
        body.innerHTML =
          '<div class="py-warn"><h5>⚠️ اجرا روی همین گوشی انجام می‌شود</h5>' +
          '<p>کد روی سرور اجرا نمی‌شود. مفسر پایتون داخل اپ بالا می‌آید:</p>' +
          '<ul><li>اولین اجرا حدود ۲۰ ثانیه طول می‌کشد</li>' +
          '<li>حدود ۳۰۰ مگابایت حافظه می‌گیرد</li>' +
          '<li>روی گوشی‌های قدیمی ممکن است اپ بسته شود</li></ul></div>' + codeHtml;
        body.querySelector('.py-code').textContent = Py.code;
        foot.innerHTML = '<button class="py-run">شروع اجرا</button><button class="py-cancel">بستن</button>';
        foot.querySelector('.py-run').addEventListener('click', Py.run);
        foot.querySelector('.py-cancel').addEventListener('click', Py.close);
        return;
      }

      if (state === 'loading') {
        body.innerHTML = codeHtml +
          '<div class="py-load"><i></i><i></i><i></i><span>' +
          (payload || 'بارگذاری مفسر پایتون…') + '</span></div>';
        body.querySelector('.py-code').textContent = Py.code;
        foot.innerHTML = '<button class="py-run" disabled>در حال آماده‌سازی…</button><button class="py-cancel">لغو</button>';
        foot.querySelector('.py-cancel').addEventListener('click', Py.close);
        return;
      }

      if (state === 'result') {
        body.innerHTML = codeHtml + '<div class="py-label">خروجی</div>' +
          '<pre class="py-out' + (payload.error ? ' err' : '') + '"></pre>' +
          (payload.figures || []).map(src => '<div class="py-fig"><img alt="نمودار" src="' + src + '"></div>').join('');
        body.querySelector('.py-code').textContent = Py.code;
        body.querySelector('.py-out').textContent = payload.text || '';
        foot.innerHTML = '<button class="py-run">اجرای دوباره</button><button class="py-cancel">بستن</button>';
        foot.querySelector('.py-run').addEventListener('click', Py.run);
        foot.querySelector('.py-cancel').addEventListener('click', Py.close);
        return;
      }

      // ready
      body.innerHTML = codeHtml;
      body.querySelector('.py-code').textContent = Py.code;
      foot.innerHTML = '<button class="py-run">▶ اجرا</button><button class="py-cancel">بستن</button>';
      foot.querySelector('.py-run').addEventListener('click', Py.run);
      foot.querySelector('.py-cancel').addEventListener('click', Py.close);
    },

    run: function () {
      Py.render('loading', 'بارگذاری مفسر پایتون…');
      Py.load().then(function (p) {
        Py.render('loading', 'آماده‌سازی numpy و matplotlib…');
        return p.loadPackagesFromImports(Py.code).then(function () {
          var out = [];
          p.setStdout({ batched: function (s) { out.push(s); } });
          p.setStderr({ batched: function (s) { out.push(s); } });
          return p.runPythonAsync(Py.code).then(function () {
            Py.render('result', { text: out.join('\n'), figures: collectFigures(p) });
          });
        });
      }).catch(function (err) {
        Py.render('result', { text: String(err && err.message || err), error: true });
      });
    }
  };

  // matplotlib figures → data URLs. Claude Code: verify against the bundled
  // matplotlib backend; this is the agg/base64 path.
  function collectFigures(p) {
    try {
      var b64 = p.runPython(
        'import io, base64, matplotlib.pyplot as plt\n' +
        'figs = []\n' +
        'for n in plt.get_fignums():\n' +
        '    buf = io.BytesIO()\n' +
        '    plt.figure(n).savefig(buf, format="png", dpi=110, bbox_inches="tight")\n' +
        '    figs.append(base64.b64encode(buf.getvalue()).decode())\n' +
        'plt.close("all")\n' +
        'figs'
      );
      return (b64.toJs ? b64.toJs() : b64).map(s => 'data:image/png;base64,' + s);
    } catch (e) { return []; }
  }

  /* ===================================================================
     9. Open / close
     =================================================================== */

  function newChat(opts) {
    var c = { id: uuid(), title: '', topic: 'تازه', date: null, tokens: 0, msgs: [] };
    S.chats.unshift(c);
    openChat(c, opts);
    return c;
  }

  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  function openChat(chat, opts) {
    opts = opts || {};
    S.active = chat;
    chat.stopped = false;
    $('#chat-title').textContent = chat.title || 'گفتگوی جدید';
    $('#chat-sub').textContent = chat.msgs && chat.msgs.length ? 'دستیار من فیزیکی' : 'گفتگوی تازه';

    $('#chat-draft').innerHTML = '';
    S.draftCite = opts.cite || null;
    $('#chat-composer').value = opts.draft || '';
    if (S.draftCite) {
      var tag = document.createElement('span');
      tag.className = 'draft-tag';
      tag.textContent = S.draftCite;
      $('#chat-draft').appendChild(tag);
    }
    autogrow();

    var ready = chat.msgs ? Promise.resolve(chat.msgs)
                          : api.session(chat.id).then(function (rows) { chat.msgs = rows; return rows; });

    ready.then(function () {
      renderMessages(); renderList(); renderQuota();
      document.querySelectorAll('.screen').forEach(s => s.classList.toggle('is-on', s.id === 's-chat'));
      setTimeout(function () {
        var b = $('#chat-composer');
        if (!b.disabled) { b.focus(); b.selectionStart = b.value.length; }
      }, 60);
    });
  }

  /* ===================================================================
     10. Wiring
     =================================================================== */

  function init() {
    $('#chat-menu').addEventListener('click', openDrawer);
    $('#drawer-close').addEventListener('click', closeDrawer);
    $('#chat-scrim').addEventListener('click', closeDrawer);
    $('#chat-new').addEventListener('click', function () { closeDrawer(); newChat(); });
    $('#chat-tokbadge').addEventListener('click', openDrawer);
    $('#py-close').addEventListener('click', Py.close);
    $('#chat-send').addEventListener('click', send);
    $('#chat-stop').addEventListener('click', stop);
    $('#chat-composer').addEventListener('input', function () { autogrow(); syncSend(); });
    $('#chat-search').addEventListener('input', function (e) {
      S.filter = e.target.value.trim(); renderList();
    });
    $('#chat-close').addEventListener('click', function () {
      if (S.streaming) stop();
      if (S.onClose) S.onClose();
    });

    api.sessions().then(function (rows) {
      S.chats = rows.map(function (r) {
        return { id: r.id, title: r.title, topic: topicOf(r.title || ''), date: r.date, tokens: r.tokens, msgs: null };
      });
      renderList();
    });
  }

  /* ===================================================================
     11. Mock stream — removed once MOCK = false
     =================================================================== */

  var FIXTURES = {
    sessions: [
      { id: 'm1', title: 'سه قانون نیوتن را با تیتر و فهرست بنویس', date: '2026-09-21 09:12:00', tokens: 303 },
      { id: 'm2', title: 'کد پایتون پرتابه با نمودار بنویس', date: '2026-09-21 08:40:00', tokens: 335 },
      { id: 'm3', title: 'ترانزیستور چیست؟', date: '2026-09-16 21:05:00', tokens: 1500 }
    ],
    messages: {
      m1: [
        { role: 'user', message: 'سه قانون نیوتن را با تیتر و فهرست بنویس' },
        { role: 'assistant', source: 'site', message:
          '## سه قانون نیوتن\n\nدر اینجا سه اصل بنیادین مکانیک کلاسیک آمده است:\n\n' +
          '### ۱. قانون اول (اینرسی)\nهر جسمی در حالت سکون یا حرکت یکنواخت باقی می‌ماند، مگر اینکه بر آن **نیروی حاصل‌جمع غیر صفر** وارد شود.\n\n' +
          '$$\\sum \\vec{F} = 0 \\Rightarrow \\vec{a} = 0$$\n\n' +
          '### ۲. قانون دوم (حرکت)\nشتاب مستقیماً با **نیرو** و معکوساً با **جرم** نسبت دارد.\n\n' +
          '$$\\vec{F} = m\\vec{a}$$\n\n' +
          '> واحد نیرو در SI نیوتن است: 1 N = 1 kg·m/s²' }
      ],
      m2: [
        { role: 'user', message: 'کد پایتون پرتابه با نمودار بنویس' },
        { role: 'assistant', source: 'code', message:
          '```python\nimport numpy as np\nimport matplotlib.pyplot as plt\n\n' +
          'g = 9.81\nv0 = 25.0\nangle = 45.0\n\n' +
          't = np.linspace(0, 2*v0*np.sin(np.radians(angle))/g, 400)\n' +
          'x = v0 * np.cos(np.radians(angle)) * t\n' +
          'y = v0 * np.sin(np.radians(angle)) * t - 0.5 * g * t**2\n\n' +
          'plt.plot(x, y)\nplt.xlabel("X (m)")\nplt.ylabel("Y (m)")\n' +
          'plt.title("Projectile Motion")\nplt.grid(True)\nplt.show()\n\n' +
          'print(f"Range: {x[-1]:.2f} m")\n```' }
      ],
      m3: []
    }
  };

  function mockStream(payload, h, signal) {
    var steps = ['در حال جست‌وجو در مقالات سایت…', 'در حال فکر کردن…', 'در حال نوشتن پاسخ…'];
    var isCode = /کد|پایتون|python/i.test(payload.message);
    var body = isCode ? FIXTURES.messages.m2[1].message : FIXTURES.messages.m1[1].message;
    var i = 0, pos = 0, timer;

    function tick() {
      if (signal && signal.aborted) { clearInterval(timer); return; }
      if (i < steps.length) { h.status({ text: steps[i++] }); return; }
      if (pos === 0) h.source({ type: isCode ? 'code' : 'site' });
      var chunk = body.slice(pos, pos + 14);
      pos += 14;
      if (chunk) { h.token({ text: chunk }); return; }
      clearInterval(timer);
      h.done({ session_id: payload.session_id, remaining: Math.max(0, (S.quota.remaining || 100000) - 300),
               response_tokens: 300, provider: 'groq', log_id: Date.now() });
    }
    timer = setInterval(tick, 60);
    return Promise.resolve();
  }

  /* public */
  return {
    init: init,
    open: function (opts) {
      opts = opts || {};
      if (opts.newChat || !S.chats.length) newChat(opts);
      else openChat(S.chats[0], opts);
    },
    onClose: function (fn) { S.onClose = fn; }
  };
})();
