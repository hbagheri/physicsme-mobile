/* =====================================================================
   من فیزیکی — chat module
   ---------------------------------------------------------------------
   Exposes window.PMChat.open(opts). Everything that touches the network
   lives in `api` at the top; the views never fetch.

   The app has no sign-in yet. POST /chat answers anonymous callers, so the
   conversation works; everything that belongs to an account — history,
   rename, hide, rate — does not, and is skipped rather than fired at the
   server to collect a 401. See docs/api-contract.md.
   ===================================================================== */

window.PMChat = (function () {
  'use strict';

  var BASE = 'https://physicsme.ir/wp-json/physicalme/v1';

  /* ===================================================================
     1. API — shapes taken verbatim from the plugin (REPORT.md §1.3)
     =================================================================== */

  function token() { return window.PMAuth.token(); }

  function authHeaders() {
    return window.PMAuth.headers({ 'Content-Type': 'application/json' });
  }

  var api = {
    // GET /chat/sessions → [{id,title,date,tokens}] — max 60, no paging yet
    sessions: function () {
      if (!token()) return Promise.resolve([]);
      return fetch(BASE + '/chat/sessions', { headers: authHeaders() })
        .then(function (r) { return r.ok ? r.json() : []; })
        .catch(function () { return []; });
    },

    // GET /chat/sessions/{id} → [{role,message}]  ⚠ no log_id, so rating is
    // dead on a reloaded conversation until the backend adds it
    session: function (id) {
      if (!token()) return Promise.resolve([]);
      return fetch(BASE + '/chat/sessions/' + id, { headers: authHeaders() })
        .then(function (r) { return r.ok ? r.json() : []; })
        .catch(function () { return []; });
    },

    rename: function (id, title) {
      if (!token()) return Promise.resolve({ ok: true, title: title });
      return fetch(BASE + '/chat/sessions/' + id + '/rename', {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ title: title })
      }).then(function (r) { return r.json(); }).catch(function () { return { ok: false }; });
    },

    // soft delete: sets wp_pm_chat_sessions.is_hidden = 1. Messages stay.
    hide: function (id) {
      if (!token()) return Promise.resolve({ ok: true });
      return fetch(BASE + '/chat/sessions/' + id + '/hide', {
        method: 'POST', headers: authHeaders(), body: '{}'
      }).then(function (r) { return r.json(); }).catch(function () { return { ok: false }; });
    },

    rate: function (logId, rating, sessionId) {
      if (!token()) return Promise.resolve({ ok: true });
      return fetch(BASE + '/chat/rate', {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ log_id: logId, rating: rating, session_id: sessionId })
      }).then(function (r) { return r.json(); }).catch(function () { return { ok: false }; });
    },

    /* POST /chat — SSE over fetch, NOT EventSource.
       EventSource is GET-only and cannot send auth headers, which is why
       the site reads the body by hand. Same approach here.
       handlers: { status, token, source, translation, done, error } */
    stream: function (payload, handlers, signal) {
      return fetch(BASE + '/chat', {
        method: 'POST', headers: authHeaders(), body: JSON.stringify(payload), signal: signal
      }).then(function (res) {
        if (!res.ok) {
          return res.json().then(function (j) {
            var msg = (j && j.data && j.data.message) || (j && j.message) || T('err.unknown');
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
        handlers.error({ status: 0, message: T('err.offline') });
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
        run.textContent = T('code.run');
        run.addEventListener('click', function () { Py.open(code); });
        bar.appendChild(run);
      }
      var cp = document.createElement('button');
      cp.className = 'codebtn';
      cp.textContent = T('code.copy');
      cp.addEventListener('click', function () { copy(code, cp, T('code.copied'), T('code.copy')); });
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

  var scripts = {};
  function loadScript(src) {
    if (scripts[src]) return scripts[src];
    scripts[src] = new Promise(function (ok, fail) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = ok;
      s.onerror = function () { fail(new Error(T('err.script', { src: src }))); };
      document.head.appendChild(s);
    });
    return scripts[src];
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
    draftQuote: null,
    onClose: null
  };

  // A paragraph the reader pointed at is sent with the question, but not whole:
  // a long one pushes the question itself out of the model's attention and the
  // answer comes back as a summary of the excerpt instead of a reply. Cut at the
  // last sentence break before the cap so the excerpt still ends somewhere.
  var QUOTE_MAX = 900;

  function clipQuote(text) {
    text = String(text || '').replace(/\s+/g, ' ').trim();
    if (text.length <= QUOTE_MAX) return text;
    var cut = text.slice(0, QUOTE_MAX);
    var stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('۔'), cut.lastIndexOf('؟'), cut.lastIndexOf('!'));
    return (stop > QUOTE_MAX * 0.5 ? cut.slice(0, stop + 1) : cut) + ' …';
  }


  var faNum = window.PMI18n.num;
  function $(s) { return document.querySelector(s); }

  // The backend titles a chat with the user's whole first message cut at 70
  // chars, so the list reads as near-identical sentences. Until a server-side
  // LLM title exists, a topic chip gives the eye something to sort on.
  function topicOf(title) {
    if (/کد|پایتون|python|code/i.test(title)) return 'topic.code';
    if (/بار|الکتر|جریان|ولتاژ|مقاومت|charge|current|volt/i.test(title)) return 'topic.electricity';
    if (/نیرو|شتاب|حرکت|نیوتن|پرتاب|سقوط|force|newton|motion/i.test(title)) return 'topic.mechanics';
    if (/گرما|دما|انرژی|ترمو|heat|thermo|energy/i.test(title)) return 'topic.heat';
    if (/نور|موج|عدسی|بازتاب|light|wave|lens/i.test(title)) return 'topic.light';
    if (/اتم|کوانتوم|هسته|atom|quantum|nucle/i.test(title)) return 'topic.quantum';
    return 'topic.physics';
  }

  /* ===================================================================
     4. Quota — four states, including debt.
     The plugin gates on `used < limit`, not `used + cost <= limit`, so a
     single answer can overshoot and `remaining` goes negative. That excess
     carries into tomorrow. The badge must render a negative number.
     =================================================================== */

  // There is no quota endpoint, so `remaining` stays null until the first
  // answer arrives and its `done` event reports it. Null therefore means
  // "not known yet", and is drawn as a dash — never as unlimited, which for
  // a signed-out reader on a daily cap would simply be untrue.
  function quotaClass() {
    var r = S.quota.remaining;
    if (r === null) return 'ok';
    if (r < 0) return 'debt';
    if (r === 0) return 'out';
    if (r < S.quota.limit * 0.1) return 'low';
    return 'ok';
  }

  function renderQuota() {
    var r = S.quota.remaining, cls = quotaClass(), blocked = (r !== null && r <= 0);

    var badge = $('#chat-tokbadge');
    badge.className = 'tokbadge ' + cls;
    $('#chat-tokval').textContent = (r === null) ? '—' : faNum(r);
    $('#drawer-quota').textContent = (r === null) ? '—' : T('chat.tokens', { n: faNum(r) });

    var meter = $('#chat-meter');
    meter.className = 'meter' + (cls === 'low' || cls === 'debt' ? ' warn' : '');
    if (r === null)   meter.innerHTML = T('quota.unknown');
    else if (r < 0)   meter.innerHTML = T('quota.debt',  { n: faNum(-r) });
    else if (r === 0) meter.innerHTML = T('quota.empty');
    else              meter.innerHTML = T('quota.left',  { n: faNum(r) });

    var wall = $('#chat-wall');
    wall.innerHTML = '';
    if (blocked) {
      wall.innerHTML =
        '<div class="wall"><h5>' + T('quota.wallTitle') + '</h5><p>' +
        (r < 0 ? T('quota.wallDebt', { n: faNum(-r) }) : T('quota.wallFresh')) +
        '</p><button id="quota-cta">' + T('quota.wallCta') + '</button></div>';
    }

    var box = $('#chat-composer');
    box.disabled = blocked || S.streaming;
    box.placeholder = T(blocked ? 'chat.blocked' : 'chat.placeholder');
    syncSend();
  }

  /* ===================================================================
     5. Messages
     =================================================================== */

  var SRC = { site: 1, external: 1, general: 1, code: 1 };

  var ICON = {
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/></svg>',
    up:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10.5v9H4.5v-9z"/><path d="M7 10.5 11.5 4a1.8 1.8 0 0 1 3 1.6l-.7 3.7h4.4a1.9 1.9 0 0 1 1.85 2.3l-1.1 5.5A2.4 2.4 0 0 1 16.6 19H7z"/></svg>',
    down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 13.5v-9H4.5v9z"/><path d="M7 13.5 11.5 20a1.8 1.8 0 0 0 3-1.6l-.7-3.7h4.4a1.9 1.9 0 0 0 1.85-2.3l-1.1-5.5A2.4 2.4 0 0 0 16.6 5H7z"/></svg>',
    refresh:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-1.5 5.5"/><path d="M20 5v6h-6"/></svg>',
    pencil:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
    trash:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M9.5 7V5.2h5V7"/><path d="M6.4 7l.8 12.2a1.6 1.6 0 0 0 1.6 1.5h6.4a1.6 1.6 0 0 0 1.6-1.5L17.6 7"/><path d="M10.2 10.8v6M13.8 10.8v6"/></svg>',
    atom: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="2.3" fill="currentColor" stroke="none"/><ellipse cx="12" cy="12" rx="10" ry="4.4"/><ellipse cx="12" cy="12" rx="10" ry="4.4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4.4" transform="rotate(-60 12 12)"/></svg>'
  };

  function seeds() {
    return [['؟', T('seed.1')], ['Σ', T('seed.2')], ['🐍', T('seed.3')]];
  }

  function messageNode(m) {
    var wrap = document.createElement('div');
    wrap.className = 'msg ' + (m.role === 'user' ? 'me' : 'ai') + (m.error ? ' err' : '');

    var bubble = document.createElement('div');
    bubble.className = 'bubble' + (m.streaming ? ' typing' : '');
    if (m.role === 'user') {
      if (m.quote) {
        var q = document.createElement('div');
        q.className = 'bubble-quote';
        q.textContent = m.quote;
        bubble.appendChild(q);
      }
      bubble.appendChild(document.createTextNode(m.message));
    }
    else if (m.error) bubble.textContent = '⚠️ ' + m.message;
    else renderAnswer(bubble, m.message);
    wrap.appendChild(bubble);
    m._el = bubble;

    if (m.role !== 'user' && !m.streaming) {
      var foot = document.createElement('div');
      foot.className = 'msg-foot';

      if (m.source && SRC[m.source]) {
        var b = document.createElement('span');
        b.className = 'srcbadge ' + m.source;
        b.textContent = T('src.' + m.source);
        foot.appendChild(b);
      }

      if (m.error) {
        var rt = document.createElement('button');
        rt.className = 'retry';
        rt.innerHTML = ICON.refresh + T('chat.retry');
        rt.addEventListener('click', retryLast);
        foot.appendChild(rt);
      } else {
        var acts = document.createElement('div');
        acts.className = 'msg-acts';

        // message-level copy: the site has this only on code blocks, which
        // makes an answer effectively uncopyable on a phone
        var cp = document.createElement('button');
        cp.className = 'act'; cp.innerHTML = ICON.copy;
        cp.setAttribute('aria-label', T('a11y.copyAnswer'));
        cp.addEventListener('click', function () { copy(m.message, cp); });
        acts.appendChild(cp);

        [['up', 1], ['down', -1]].forEach(function (p) {
          var btn = document.createElement('button');
          btn.className = 'act' + (m.rating === p[1] ? ' on' : '');
          btn.innerHTML = ICON[p[0]];
          btn.setAttribute('aria-label', T(p[1] === 1 ? 'a11y.helpful' : 'a11y.notHelpful'));
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
      var SEEDS = seeds();
      e.innerHTML =
        '<span class="glyph">' + ICON.atom + '</span>' +
        '<h3>' + T('chat.emptyTitle') + '</h3>' +
        '<p>' + T('chat.emptyBody') + '</p>' +
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
      st.innerHTML = '<i></i><span>' + T('chat.thinking') + '</span>';
      scroll.appendChild(st);
    }
    if (S.active.stopped) {
      var s = document.createElement('div');
      s.className = 'stopped';
      // the server does not persist partial output on abort — say so
      s.textContent = T('chat.stopped');
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

    var mine = { role: 'user', message: text };
    if (S.draftQuote) mine.quote = S.draftQuote;
    S.active.msgs.push(mine);
    if (!S.active.title) {
      S.active.title = text.length > 70 ? text.slice(0, 70) : text;
      S.active.topic = topicOf(text);
      $('#chat-title').textContent = S.active.title;
    }
    box.value = '';
    $('#chat-draft').innerHTML = '';
    S.draftCite = null;
    S.draftQuote = null;
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
        // The excerpt rides beside the question, never inside it. Glued in, it
        // becomes the site-search query and the science-gate input, and a wall of
        // prose ruins both. It is resent every turn of this conversation so that
        // "ساده‌تر بگو" still knows what it is about.
        passage: S.active.passage || '',
        passage_title: S.active.passageTitle || '',
        passage_article: S.active.passageArticle || '',
        // history is kept client-side and resent whole; the server keeps the
        // last 20 turns and never reads history from the database
        history: S.active.msgs.filter(m => !m.streaming && !m.error)
                              .map(m => ({ role: m.role, message: m.message })),
        session_id: S.active.id,
        lang: window.PMI18n.lang
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
          if (d.provider) $('#chat-sub').textContent = T('chat.provider', { name: d.provider });
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
    if (prev) {
      S.draftQuote = prev.quote || null;
      $('#chat-composer').value = prev.message;
      autogrow(); send();
    }
  }

  /* ===================================================================
     7. Conversation list
     =================================================================== */

  function renderList() {
    var list = $('#chat-list');
    list.innerHTML = '';

    var shown = S.chats.filter(function (c) {
      if (!S.filter) return true;
      return (c.title || '').indexOf(S.filter) !== -1 ||
             T(c.topic || 'topic.physics').indexOf(S.filter) !== -1;
    });
    if (!shown.length) {
      list.innerHTML = '<div class="list-head">' + T('chat.nothingFound') + '</div>';
      return;
    }

    var groups = {};
    shown.forEach(function (c) {
      var g = groupOf(c.date);
      (groups[g] = groups[g] || []).push(c);
    });

    Object.keys(groups).forEach(function (g) {
      var h = document.createElement('div');
      h.className = 'list-head'; h.textContent = T(g);
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
    if (!dateStr) return 'group.today';
    var d = new Date(dateStr.replace(' ', 'T') + 'Z');
    var days = Math.floor((Date.now() - d.getTime()) / 86400000);
    if (days < 1) return 'group.today';
    if (days < 2) return 'group.yesterday';
    if (days < 8) return 'group.lastWeek';
    return 'group.older';
  }

  function drawRow(row, c) {
    row.innerHTML =
      '<button class="name"><span class="n1"></span>' +
      '<span class="n2"><span class="topic"></span><span class="tk"></span></span></button>' +
      '<button class="chat-act" data-act="rename" aria-label="' + T('a11y.rename') + '">' + ICON.pencil + '</button>' +
      '<button class="chat-act" data-act="del" aria-label="' + T('a11y.delete') + '">' + ICON.trash + '</button>';

    row.querySelector('.n1').textContent = c.title || T('chat.new');
    row.querySelector('.topic').textContent = T(c.topic || topicOf(c.title || ''));
    row.querySelector('.tk').textContent = T('chat.tokens', { n: faNum(c.tokens || 0) });

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
        '<div class="delbar"><p>' + T('chat.deleteAsk') + '</p>' +
        '<p class="keeps">' + T('chat.deleteKeeps') + '</p>' +
        '<div class="row2"><button class="del-yes">' + T('chat.deleteYes') + '</button>' +
        '<button class="del-no">' + T('chat.deleteNo') + '</button></div></div>';
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

    // Bundled under vendor/pyodide, never a CDN. The loader script is injected
    // on first Run rather than from index.html, so the 26MB of wasm and wheels
    // beside it are never touched by someone who only reads articles.
    load: function () {
      if (Py.loaded) return Promise.resolve(Py.loaded);
      return loadScript('vendor/pyodide/pyodide.js')
        .then(function () { return window.loadPyodide({ indexURL: 'vendor/pyodide/' }); })
        .then(function (p) { Py.loaded = p; return p; });
    },

    render: function (state, payload) {
      var body = $('#py-body'), foot = $('#py-foot');
      var codeHtml = '<pre class="py-code"></pre>';

      if (state === 'warn') {
        // Not a toast: this is the user deciding to spend their phone's RAM.
        body.innerHTML =
          '<div class="py-warn"><h5>' + T('py.warnTitle') + '</h5>' +
          '<p>' + T('py.warnBody') + '</p>' +
          '<ul><li>' + T('py.warn1') + '</li>' +
          '<li>' + T('py.warn2') + '</li>' +
          '<li>' + T('py.warn3') + '</li></ul></div>' + codeHtml;
        body.querySelector('.py-code').textContent = Py.code;
        foot.innerHTML = '<button class="py-run">' + T('py.start') + '</button>' +
                         '<button class="py-cancel">' + T('py.close') + '</button>';
        foot.querySelector('.py-run').addEventListener('click', Py.run);
        foot.querySelector('.py-cancel').addEventListener('click', Py.close);
        return;
      }

      if (state === 'loading') {
        body.innerHTML = codeHtml +
          '<div class="py-load"><i></i><i></i><i></i><span>' +
          (payload || T('py.loadingInterp')) + '</span></div>';
        body.querySelector('.py-code').textContent = Py.code;
        foot.innerHTML = '<button class="py-run" disabled>' + T('py.preparing') + '</button>' +
                         '<button class="py-cancel">' + T('py.cancel') + '</button>';
        foot.querySelector('.py-cancel').addEventListener('click', Py.close);
        return;
      }

      if (state === 'result') {
        body.innerHTML = codeHtml + '<div class="py-label">' + T('py.output') + '</div>' +
          '<pre class="py-out' + (payload.error ? ' err' : '') + '"></pre>' +
          (payload.figures || []).map(src =>
            '<div class="py-fig"><img alt="' + T('py.figure') + '" src="' + src + '"></div>').join('');
        body.querySelector('.py-code').textContent = Py.code;
        body.querySelector('.py-out').textContent = payload.text || '';
        foot.innerHTML = '<button class="py-run">' + T('py.rerun') + '</button>' +
                         '<button class="py-cancel">' + T('py.close') + '</button>';
        foot.querySelector('.py-run').addEventListener('click', Py.run);
        foot.querySelector('.py-cancel').addEventListener('click', Py.close);
        return;
      }

      // ready
      body.innerHTML = codeHtml;
      body.querySelector('.py-code').textContent = Py.code;
      foot.innerHTML = '<button class="py-run">' + T('code.run') + '</button>' +
                       '<button class="py-cancel">' + T('py.close') + '</button>';
      foot.querySelector('.py-run').addEventListener('click', Py.run);
      foot.querySelector('.py-cancel').addEventListener('click', Py.close);
    },

    run: function () {
      Py.render('loading', T('py.loadingInterp'));
      Py.load().then(function (p) {
        Py.render('loading', T('py.loadingPkgs'));
        return p.loadPackagesFromImports(Py.code).then(function () {
          // Pyodide's default matplotlib backend draws straight into the DOM.
          // AGG keeps figures in memory so collectFigures can serialise them,
          // and makes plt.show() a no-op instead of an error.
          try { p.runPython('import matplotlib\nmatplotlib.use("AGG")'); } catch (e) {}
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
    var c = { id: uuid(), title: '', topic: 'topic.new', date: null, tokens: 0, msgs: [] };
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
    $('#chat-title').textContent = chat.title || T('chat.new');
    $('#chat-sub').textContent = T(chat.msgs && chat.msgs.length ? 'chat.assistant' : 'chat.fresh');

    $('#chat-draft').innerHTML = '';
    S.draftCite = opts.cite || null;
    S.draftQuote = opts.quote ? clipQuote(opts.quote) : null;
    // Kept on the conversation, not the turn: every follow-up in this chat is
    // still about the same paragraph.
    if (S.draftQuote) {
      chat.passage = S.draftQuote;
      chat.passageTitle = opts.source || '';
      chat.passageArticle = opts.articleSlug || '';
    }
    $('#chat-composer').value = opts.draft || '';
    if (S.draftCite) {
      var tag = document.createElement('span');
      tag.className = 'draft-tag';
      tag.textContent = S.draftCite;
      $('#chat-draft').appendChild(tag);
    }
    if (S.draftQuote) {
      var qd = document.createElement('div');
      qd.className = 'draft-quote';
      qd.textContent = S.draftQuote;
      $('#chat-draft').appendChild(qd);
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


  /* public */
  return {
    init: init,
    open: function (opts) {
      opts = opts || {};
      if (opts.newChat || !S.chats.length) newChat(opts);
      else openChat(S.chats[0], opts);
    },
    onClose: function (fn) { S.onClose = fn; },
    // Pyodide is 26MB and iOS evicts storage under pressure anyway. Settings
    // offers to drop it so the runtime is re-fetched fresh on the next Run.
    resetPython: function () {
      Py.loaded = null;
      if (!window.caches) return Promise.resolve();
      return caches.keys().then(function (names) {
        return Promise.all(names.map(function (n) {
          return caches.open(n).then(function (c) {
            return c.keys().then(function (reqs) {
              return Promise.all(reqs
                .filter(function (r) { return r.url.indexOf('/vendor/pyodide/') !== -1; })
                .map(function (r) { return c.delete(r); }));
            });
          });
        }));
      }).catch(function () {});
    }
  };
})();
