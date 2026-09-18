<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChatMsg {
  id:          number;
  role:        'user' | 'assistant';
  raw:         string;
  html:        string;
  streaming:   boolean;
}

// ── State ─────────────────────────────────────────────────────────────────────

const msgs       = ref<ChatMsg[]>([]);
const inputText  = ref('');
const busy       = ref(false);
const sessionId  = ref<string | null>(null);
const history    = ref<{ role: string; content: string }[]>([]);
const msgsEl     = ref<HTMLElement | null>(null);
const inputEl    = ref<HTMLTextAreaElement | null>(null);
let   msgSeq     = 0;
let   abortCtrl: AbortController | null = null;

const router = useRouter();

// API URL: swap /pm/v1 → /physicalme/v1/chat
const VITE_BASE = import.meta.env.VITE_API_BASE as string | undefined;
const CHAT_URL = VITE_BASE
  ? VITE_BASE.replace('/wp-json/pm/v1', '/wp-json/physicalme/v1/chat')
  : 'https://physicsme.ir/wp-json/physicalme/v1/chat';

const WELCOME = 'سلام! 👋 من دستیار فیزیک PhysicsMe هستم.\nسوالت رو بپرس — اول توی مقالات سایت جواب می‌گردم.';

// ── Init ──────────────────────────────────────────────────────────────────────

onMounted(() => {
  pushMsg('assistant', WELCOME, false);
  // Handle context from article inline trigger: ?ctx=...&q=...
  const p   = new URLSearchParams(window.location.search);
  const ctx = p.get('ctx');
  const q   = p.get('q');
  if (ctx || q) {
    nextTick(() => {
      if (ctx) {
        const m: ChatMsg = { id: ++msgSeq, role: 'assistant', raw: '', html: '', streaming: false };
        m.html = `<div class="text-xs text-gray-500 italic">📄 متن مقاله: ${escHtml(ctx.substring(0, 150))}${ctx.length > 150 ? '…' : ''}</div>`;
        msgs.value.push(m);
      }
      if (q) {
        inputText.value = ctx ? `متن مقاله:\n${ctx}\n\n${q}` : q;
        resizeInput();
        inputEl.value?.focus();
      }
    });
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function pushMsg(role: 'user' | 'assistant', raw: string, streaming: boolean): ChatMsg {
  const m: ChatMsg = { id: ++msgSeq, role, raw, html: role === 'user' ? escHtml(raw) : renderMd(raw), streaming };
  msgs.value.push(m);
  scrollBottom();
  return m;
}

function updateMsg(m: ChatMsg, raw: string) {
  m.raw  = raw;
  m.html = renderMd(raw);
  scrollBottom();
}

function scrollBottom() {
  nextTick(() => {
    if (msgsEl.value) msgsEl.value.scrollTop = msgsEl.value.scrollHeight;
  });
}

function resizeInput() {
  if (!inputEl.value) return;
  inputEl.value.style.height = 'auto';
  inputEl.value.style.height = Math.min(inputEl.value.scrollHeight, 120) + 'px';
}

// ── Send ──────────────────────────────────────────────────────────────────────

async function send() {
  const text = inputText.value.trim();
  if (!text || busy.value) return;

  inputText.value = '';
  resizeInput();
  busy.value = true;
  abortCtrl = new AbortController();

  pushMsg('user', text, false);
  const aMsg = pushMsg('assistant', '', true);

  try {
    const res = await fetch(CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, session_id: sessionId.value, history: history.value, lang: 'fa' }),
      signal: abortCtrl.signal,
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const reader = res.body!.getReader();
    const dec    = new TextDecoder();
    let   buf    = '';
    let   raw    = '';
    let   doneFired = false;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop()!;
      let ev = '';
      for (const line of lines) {
        if (line.startsWith('event: ')) { ev = line.slice(7).trim(); continue; }
        if (line.startsWith('data: ')) {
          try {
            const d = JSON.parse(line.slice(6));
            if (ev === 'token' && d.text) { raw += d.text; updateMsg(aMsg, raw); }
            if (ev === 'done') {
              doneFired  = true;
              sessionId.value = d.session_id;
              history.value.push({ role: 'user',      content: text });
              history.value.push({ role: 'assistant', content: raw  });
              if (history.value.length > 20) history.value.splice(0, history.value.length - 20);
            }
          } catch { /* malformed SSE line */ }
          ev = '';
        }
      }
    }

    aMsg.streaming = false;
    if (!raw) { aMsg.html = '⚠️ پاسخی دریافت نشد.'; }
    else       { typesetMath(aMsg); }

  } catch (err: unknown) {
    aMsg.streaming = false;
    if ((err as Error)?.name === 'AbortError') {
      aMsg.html = renderMd(aMsg.raw || '') + '<p class="text-gray-400 text-sm mt-1">⏹ متوقف شد.</p>';
    } else {
      aMsg.html = '⚠️ خطا در اتصال. دوباره امتحان کن.';
    }
  }

  busy.value  = false;
  abortCtrl   = null;
  scrollBottom();
}

function stop() {
  abortCtrl?.abort();
}

function newChat() {
  msgs.value = [];
  sessionId.value = null;
  history.value = [];
  pushMsg('assistant', WELCOME, false);
  inputEl.value?.focus();
}

// ── Markdown renderer (LaTeX-safe) ────────────────────────────────────────────

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderMd(text: string): string {
  // 1. Protect LaTeX blocks from HTML escaping
  const protected_: string[] = [];
  const protect = (s: string) => s
    .replace(/\$\$[\s\S]*?\$\$/g,  m => { protected_.push(m); return `\x00${protected_.length - 1}\x00`; })
    .replace(/\\\[[\s\S]*?\\\]/g,  m => { protected_.push(m); return `\x00${protected_.length - 1}\x00`; })
    .replace(/\\\([\s\S]*?\\\)/g,  m => { protected_.push(m); return `\x00${protected_.length - 1}\x00`; });

  // 2. Protect code blocks
  const codeBlocks: string[] = [];
  let s = protect(text).replace(/```([\s\S]*?)```/g, (_, inner) => {
    const code = inner.replace(/^\w+\n/, ''); // strip language tag
    const html = `<pre class="pm-code"><code>${escHtml(code.trim())}</code></pre>`;
    codeBlocks.push(html);
    return `\x01${codeBlocks.length - 1}\x01`;
  });

  // 3. Escape remaining HTML
  s = s.replace(/&(?!#?\w+;)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // 4. Inline code
  s = s.replace(/`([^`]+)`/g, (_, c) => `<code class="pm-icode">${escHtml(c)}</code>`);

  // 5. Headings
  s = s
    .replace(/^### (.+)$/gm, '<h3 class="font-bold text-base mt-3 mb-1">$1</h3>')
    .replace(/^## (.+)$/gm,  '<h2 class="font-bold text-lg mt-4 mb-1 text-olive">$1</h2>')
    .replace(/^# (.+)$/gm,   '<h1 class="font-bold text-xl mt-4 mb-2 text-olive">$1</h1>');

  // 6. Bold / italic
  s = s
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g,     '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,         '<em>$1</em>');

  // 7. Blockquotes
  s = s.replace(/^> (.+)$/gm, '<blockquote class="pm-bq">$1</blockquote>');

  // 8. Lists
  s = s.replace(/^[-*] (.+)$/gm, '<li class="list-disc list-inside">$1</li>');
  s = s.replace(/(<li[\s\S]+?<\/li>(?:\n<li[\s\S]*?<\/li>)*)/g, '<ul class="my-1">$1</ul>');

  // 9. Paragraphs & line breaks
  s = s
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/\n/g, '<br>');
  s = '<p>' + s + '</p>';

  // 10. Restore code blocks and LaTeX
  s = s.replace(/\x01(\d+)\x01/g, (_, i) => codeBlocks[+i]);
  s = s.replace(/\x00(\d+)\x00/g, (_, i) => protected_[+i]);

  return s;
}

// ── MathJax lazy loader ───────────────────────────────────────────────────────

let mjLoaded = false;
const mjQueue: (() => void)[] = [];
const HAS_LATEX = /\\\[|\\\(|\$\$|\$[^$]/;

type MathJaxGlobal = {
  typesetPromise?(els: Element[]): Promise<void>;
  startup?: { defaultReady?(): void; ready?(): void };
  tex?: unknown;
  options?: unknown;
};

function getMJ(): MathJaxGlobal | undefined {
  return (window as unknown as Record<string, unknown>)['MathJax'] as MathJaxGlobal | undefined;
}
function setMJ(val: MathJaxGlobal) {
  (window as unknown as Record<string, MathJaxGlobal>)['MathJax'] = val;
}

function ensureMathJax(cb: () => void) {
  const MJ = getMJ();
  if (mjLoaded && MJ?.typesetPromise) { cb(); return; }
  mjQueue.push(cb);
  if (mjLoaded) return;
  mjLoaded = true;
  if (!MJ) {
    setMJ({
      tex: { inlineMath: [['\\(', '\\)']], displayMath: [['\\[', '\\]'], ['$$', '$$']] },
      options: { skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre'] },
      startup: {
        ready() {
          getMJ()?.startup?.defaultReady?.();
          mjQueue.forEach(f => f());
          mjQueue.length = 0;
        },
      },
    });
  }
  const sc = document.createElement('script');
  sc.src   = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js';
  sc.async = true;
  document.head.appendChild(sc);
}

function typesetMath(m: ChatMsg) {
  if (!HAS_LATEX.test(m.raw)) return;
  ensureMathJax(() => {
    nextTick(() => {
      const el = document.getElementById(`cmsg-${m.id}`);
      const MJ = getMJ();
      if (el && MJ?.typesetPromise) MJ.typesetPromise([el]).catch(() => {});
    });
  });
}
</script>

<template>
  <div class="fixed inset-0 flex flex-col bg-gray-100" style="top: env(safe-area-inset-top, 0px);">

    <!-- Header -->
    <header class="flex items-center gap-2 px-3 py-2 bg-gradient-to-l from-[#1e3a5f] to-[#1e40af] flex-shrink-0">
      <button @click="router.back()" class="text-white/80 text-sm px-2 py-1 rounded hover:bg-white/10 active:bg-white/20 transition-colors">
        ← برگشت
      </button>
      <div class="flex-1 text-center">
        <div class="text-white font-bold text-sm">⚛ دستیار فیزیک</div>
        <div class="text-white/60 text-xs">PhysicsMe AI</div>
      </div>
      <button @click="newChat" class="text-white/80 text-sm px-2 py-1 rounded hover:bg-white/10 active:bg-white/20 transition-colors whitespace-nowrap">
        + جدید
      </button>
    </header>

    <!-- Disclaimer -->
    <div class="text-center text-xs text-amber-700 bg-amber-50 border-b border-amber-200 px-3 py-1.5 flex-shrink-0">
      ⚠️ نسخه آزمایشی — در حال آموزش است. به پاسخ‌ها کاملاً اعتماد نکنید.
    </div>

    <!-- Messages -->
    <div ref="msgsEl" class="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-3">
      <div
        v-for="m in msgs"
        :key="m.id"
        :id="`cmsg-${m.id}`"
        class="flex"
        :class="m.role === 'user' ? 'justify-start' : 'justify-end'"
      >
        <!-- user: right side (ltr context → justify-start = left → we flip below); RTL site means justify-start visually puts it on right -->
        <div
          class="max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed"
          :class="[
            m.role === 'user'
              ? 'bg-[#2563eb] text-white rounded-bl-sm'
              : 'bg-white text-gray-900 border border-gray-200 rounded-br-sm',
            m.streaming ? 'pm-streaming' : ''
          ]"
        >
          <!-- User messages: plain text -->
          <span v-if="m.role === 'user'" class="whitespace-pre-wrap">{{ m.raw }}</span>
          <!-- Assistant: rendered markdown -->
          <div v-else class="pm-chat-content" v-html="m.html || '...'"></div>
        </div>
      </div>
    </div>

    <!-- Input area -->
    <div class="flex gap-2 px-3 py-2 bg-white border-t border-gray-200 flex-shrink-0"
         style="padding-bottom: max(8px, env(safe-area-inset-bottom, 8px));">
      <textarea
        ref="inputEl"
        v-model="inputText"
        rows="1"
        class="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm resize-none outline-none max-h-28 focus:border-blue-500 focus:bg-white transition-colors"
        placeholder="سوال فیزیک بپرس…"
        dir="auto"
        @keydown.enter.prevent.exact="send"
        @input="resizeInput"
      ></textarea>
      <button
        v-if="!busy"
        @click="send"
        :disabled="!inputText.trim()"
        class="self-end w-10 h-10 rounded-xl bg-[#2563eb] text-white flex items-center justify-center flex-shrink-0 disabled:bg-gray-300 disabled:cursor-not-allowed active:bg-blue-700 transition-colors"
      >↑</button>
      <button
        v-else
        @click="stop"
        class="self-end w-10 h-10 rounded-xl bg-red-500 text-white flex items-center justify-center flex-shrink-0 active:bg-red-700 transition-colors"
      >⏹</button>
    </div>

  </div>
</template>

<style scoped>
/* Markdown content inside assistant bubbles */
.pm-chat-content :deep(p)          { margin: 0 0 0.6em; }
.pm-chat-content :deep(p:last-child) { margin-bottom: 0; }
.pm-chat-content :deep(strong)     { font-weight: 700; color: #111; }
.pm-chat-content :deep(em)         { font-style: italic; }
.pm-chat-content :deep(.pm-bq)     {
  border-right: 3px solid #2563eb;
  padding: 0.3em 0.7em;
  margin: 0.4em 0;
  background: #eff6ff;
  color: #1e40af;
  border-radius: 0 6px 6px 0;
}
.pm-chat-content :deep(.pm-code)   {
  background: #0f172a;
  color: #e2e8f0;
  border-radius: 8px;
  padding: 10px 12px;
  overflow-x: auto;
  margin: 0.5em 0;
  direction: ltr;
  text-align: left;
  font-size: 12px;
  line-height: 1.6;
}
.pm-chat-content :deep(.pm-code code) {
  background: none;
  color: inherit;
  font-family: 'JetBrains Mono', Consolas, monospace;
}
.pm-chat-content :deep(.pm-icode) {
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  color: #1d4ed8;
  padding: 1px 4px;
  border-radius: 4px;
  font-size: 0.85em;
  font-family: monospace;
  direction: ltr;
  display: inline-block;
}
.pm-chat-content :deep(mjx-container) {
  direction: ltr !important;
  overflow-x: auto;
  max-width: 100%;
  margin: 4px 0;
}
.pm-chat-content :deep(h2) { font-size: 1.05em; font-weight: 700; color: #1e40af; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; margin: 1em 0 0.4em; }
.pm-chat-content :deep(h3) { font-size: 0.95em; font-weight: 700; color: #374151; margin: 0.8em 0 0.3em; }
.pm-streaming::after {
  content: '▋';
  display: inline-block;
  animation: pm-cursor-blink 1s step-end infinite;
  color: #3b82f6;
  margin-right: 2px;
}
@keyframes pm-cursor-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
</style>
