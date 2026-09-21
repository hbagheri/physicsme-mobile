/* =====================================================================
   من فیزیکی — auth
   ---------------------------------------------------------------------
   One credential, two ways to get it. Telegram opens a deep link and the
   app polls; email sends a six-digit code. Both end at the same place: a
   WordPress Application Password, stored as base64("login:password") and
   sent as `Authorization: Basic`. Core WordPress resolves that in
   determine_current_user, so every endpoint that asks is_user_logged_in()
   works without knowing this module exists.

   `X-PM-Device` rides along on every request, signed in or not. Inside a
   Capacitor webview the page is served from https://localhost, so the
   guest cookie the server would otherwise set is third-party and gets
   dropped — without this header every request looks like a new guest and
   the free allowance is no allowance at all.
   ===================================================================== */

window.PMAuth = (function () {
  'use strict';

  var BASE = 'https://physicsme.ir/wp-json/pm/v1';

  var K_CRED   = 'pm-auth';
  var K_DEVICE = 'pm-device';

  function read(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function write(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function drop(k) { try { localStorage.removeItem(k); } catch (e) {} }

  function uuid4() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    var b = new Uint8Array(16);
    (window.crypto || {}).getRandomValues
      ? crypto.getRandomValues(b)
      : (function () { for (var i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256); })();
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    var h = [];
    for (var i = 0; i < 16; i++) h.push((b[i] + 0x100).toString(16).slice(1));
    return h.slice(0, 4).join('') + '-' + h.slice(4, 6).join('') + '-' +
           h.slice(6, 8).join('') + '-' + h.slice(8, 10).join('') + '-' + h.slice(10).join('');
  }

  function deviceId() {
    var d = read(K_DEVICE);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(d || '')) {
      d = uuid4();
      write(K_DEVICE, d);
    }
    return d;
  }

  function token() { return read(K_CRED); }
  function isMember() { return !!token(); }

  /* Full headers, device id included. For anything that is already a
     preflighted request — the chat POSTs, the auth POSTs — so the extra
     header is free. */
  function headers(extra) {
    var h = extra || {};
    h['X-PM-Device'] = deviceId();
    var t = token();
    if (t) h['Authorization'] = 'Basic ' + t;
    return h;
  }

  /* Content GETs use this instead. A custom header on a cross-origin GET
     turns a simple request into a preflight, and the device id buys
     nothing here — only the chat quota reads it. A signed-out reader
     therefore pays one round trip per screen, not two. */
  function contentHeaders(extra) {
    var h = extra || {};
    var t = token();
    if (t) h['Authorization'] = 'Basic ' + t;
    return h;
  }

  function setCredential(cred) { if (cred) write(K_CRED, cred); }
  function clear() { drop(K_CRED); }

  /* An error the callers can branch on. `status` is the HTTP code and
     `code` the server's own string, so a 402 gate and a 429 rate limit do
     not have to be told apart by reading a message. */
  function ApiError(status, code, message) {
    var e = new Error(message || ('HTTP ' + status));
    e.status = status;
    e.code = code || '';
    return e;
  }

  function post(path, body) {
    return fetch(BASE + path, {
      method: 'POST',
      headers: headers({ 'Content-Type': 'application/json', Accept: 'application/json' }),
      body: JSON.stringify(body || {})
    }).then(parse);
  }

  function get(path) {
    return fetch(BASE + path, { headers: headers({ Accept: 'application/json' }) }).then(parse);
  }

  function parse(r) {
    return r.json().catch(function () { return {}; }).then(function (j) {
      if (r.ok) return j;
      throw ApiError(r.status, (j.error && j.error.code) || j.status, j.error && j.error.message);
    });
  }

  /* Which methods the server can actually deliver today. SMTP may be
     unconfigured, and a sign-up button that cannot send anything is worse
     than no button — so the chooser asks first rather than assuming. */
  var mePromise = null;
  function me(fresh) {
    if (fresh || !mePromise) mePromise = get('/auth/me');
    return mePromise;
  }

  return {
    deviceId: deviceId,
    token: token,
    isMember: isMember,
    headers: headers,
    contentHeaders: contentHeaders,
    setCredential: setCredential,
    clear: function () { mePromise = null; clear(); },
    me: me,

    tgStart: function () { return post('/auth/tg/start'); },
    tgPoll: function (t) { return get('/auth/tg/poll?token=' + encodeURIComponent(t)); },
    emailStart: function (email) { return post('/auth/email/start', { email: email }); },
    emailVerify: function (email, code) { return post('/auth/email/verify', { email: email, code: code }); }
  };
})();
