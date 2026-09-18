<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter, RouterLink } from 'vue-router';
import type { Article } from '@shared/types';
import { pmApi } from '@/api/client';
import { typeset } from '@/composables/useMathJax';
import { usePdfExport } from '@/composables/usePdfExport';
import { useBookmarksStore } from '@/stores/bookmarks';
import { useArticleCacheStore } from '@/stores/articleCache';

const QuestionsModal = defineAsyncComponent(() => import('@/components/QuestionsModal.vue'));
const ProblemsModal = defineAsyncComponent(() => import('@/components/ProblemsModal.vue'));
const LabModal = defineAsyncComponent(() => import('@/components/LabModal.vue'));
const CommentsModal = defineAsyncComponent(() => import('@/components/CommentsModal.vue'));

const route  = useRoute();
const router = useRouter();
const slug = ref<string>(route.params.slug as string);

const article = ref<Article | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const body = ref<HTMLElement | null>(null);
const isStale = ref(false);        // shown from cache while network is unreachable
const renderNonce = ref(0);        // bumped on every article assignment to retrigger MathJax
const showQuestionsModal = ref(false);
const showProblemsModal = ref(false);
const showLabModal = ref(false);
const showCommentsModal = ref(false);
let loadToken = 0;                 // discards stale fetches when the user navigates fast

// ── Inline AI trigger ─────────────────────────────────────────────────────────
const aiCtx     = ref('');
const showAiBtn = ref(false);

function onSelectionChange() {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.toString().trim()) {
    showAiBtn.value = false;
    aiCtx.value = '';
    return;
  }
  if (!body.value) return;
  const range = sel.getRangeAt(0);
  if (!body.value.contains(range.commonAncestorContainer)) {
    showAiBtn.value = false;
    return;
  }
  aiCtx.value = sel.toString().trim().substring(0, 600);
  showAiBtn.value = true;
}

function askAI() {
  showAiBtn.value = false;
  window.getSelection()?.removeAllRanges();
  router.push({ path: '/chat', query: { ctx: aiCtx.value } });
}

const bookmarks = useBookmarksStore();
const articleCache = useArticleCacheStore();
const { exporting, exportArticleToPdf } = usePdfExport();
const isBookmarked = computed(() =>
  article.value ? bookmarks.has(article.value.slug) : false
);

async function toggleBookmark() {
  if (!article.value) return;
  await bookmarks.toggle({
    slug:        article.value.slug,
    title:       article.value.title,
    chapterSlug: article.value.chapterSlug,
    bookSlug:    article.value.bookSlug,
    thumbUrl:    article.value.thumbUrl,
    excerpt:     article.value.excerpt,
  });
}

async function downloadPdf() {
  if (!article.value) return;
  await exportArticleToPdf(article.value, body.value);
}

async function load() {
  const token = ++loadToken;
  const wantedSlug = slug.value;

  error.value = null;
  isStale.value = false;

  // 1. Try cache first — instant render if hit
  const cached = articleCache.get(wantedSlug);
  if (cached) {
    article.value = cached;
    loading.value = false;
    renderNonce.value++;
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  } else {
    article.value = null;
    loading.value = true;
  }

  // 2. Revalidate from network in the background (or as the only fetch if no cache)
  try {
    const fresh = await pmApi.getArticle(wantedSlug);
    if (token !== loadToken) return; // user navigated away — drop result
    article.value = fresh;
    renderNonce.value++;
    if (!cached) window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    await articleCache.set(wantedSlug, fresh);
  } catch (e) {
    if (token !== loadToken) return;
    if (cached) {
      // Network failed but the cached copy is on screen — mark stale, no error
      isStale.value = true;
    } else {
      error.value = (e as Error).message;
    }
  } finally {
    if (token === loadToken) loading.value = false;
  }
}

// Re-typeset MathJax on every fresh article assignment (cache hit, then revalidate)
// — keyed on renderNonce so cache→fresh swaps with the same slug still retypeset.
watch(
  () => renderNonce.value,
  async () => {
    if (!article.value) return;
    await nextTick();
    // Poll briefly for body.value — v-html mounts on a microtask after the ref
    for (let i = 0; i < 10 && !body.value; i++) await nextTick();
    if (body.value) await typeset(body.value);
  },
  { flush: 'post' }
);

onMounted(() => {
  load();
  document.addEventListener('selectionchange', onSelectionChange);
});
onUnmounted(() => {
  document.removeEventListener('selectionchange', onSelectionChange);
});
watch(() => route.params.slug, (s) => { slug.value = s as string; load(); });
</script>

<template>
  <main class="pb-20">
    <!-- Sticky back bar — pt accounts for the Android status-bar safe area on
         devices where the WebView extends behind the status overlay. -->
    <div class="pm-sticky-bar">
      <RouterLink
        v-if="article"
        :to="article.bookSlug ? `/book/${article.bookSlug}` : '/'"
        class="text-olive text-sm">
        ← فصل‌ها
      </RouterLink>
      <RouterLink v-else to="/" class="text-olive text-sm">← خانه</RouterLink>

      <div v-if="article" class="flex gap-1">
        <button
          type="button"
          @click="showQuestionsModal = true"
          title="سوالات"
          class="text-lg leading-none px-2 py-1 rounded-md text-olive hover:bg-cream transition"
        >
          ❓
        </button>
        <button
          type="button"
          @click="showProblemsModal = true"
          title="مسائل"
          class="text-lg leading-none px-2 py-1 rounded-md text-blue-600 hover:bg-blue-50 transition"
        >
          📐
        </button>
        <button
          type="button"
          @click="showLabModal = true"
          title="آزمایشگاه"
          class="text-lg leading-none px-2 py-1 rounded-md text-amber-600 hover:bg-amber-50 transition"
        >
          🧪
        </button>
        <button
          type="button"
          @click="showCommentsModal = true"
          title="نظرات"
          class="text-lg leading-none px-2 py-1 rounded-md text-purple-600 hover:bg-purple-50 transition"
        >
          💬
        </button>
        <button
          type="button"
          @click="downloadPdf"
          :disabled="exporting"
          title="دانلود PDF"
          class="text-lg leading-none px-2 py-1 rounded-md text-green-600 hover:bg-green-50 transition disabled:text-gray-400 disabled:cursor-not-allowed"
        >
          {{ exporting ? '⏳' : '📥' }}
        </button>
        <button
          type="button"
          @click="toggleBookmark"
          :aria-label="isBookmarked ? 'حذف از نشان‌شده‌ها' : 'نشان‌کن'"
          :title="isBookmarked ? 'حذف از نشان‌شده‌ها' : 'نشان‌کن'"
          class="text-xl leading-none px-2 py-1 rounded-md"
          :class="isBookmarked ? 'text-amber-500' : 'text-gray-400'"
        >
          {{ isBookmarked ? '★' : '☆' }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="text-center py-16 text-gray-500">در حال بارگذاری…</div>
    <div v-else-if="error" class="text-center py-16 text-red-600">{{ error }}</div>

    <article v-else-if="article" class="px-4 pt-4">
      <!-- Offline / stale-cache indicator -->
      <div
        v-if="isStale"
        class="-mx-4 mb-3 px-4 py-2 bg-amber-50 border-y border-amber-200 text-xs text-amber-800 flex items-center gap-2"
      >
        <span>⚠</span>
        <span>نسخه‌ی آفلاین — اینترنت قطع شده، آخرین نسخه‌ی ذخیره‌شده رو نشون می‌دیم.</span>
      </div>

      <h1 class="text-3xl font-bold leading-tight mb-2">{{ article.title }}</h1>
      <div class="text-xs text-gray-500 mb-6 flex flex-wrap gap-2">
        <span v-if="article.readingTime">⏱ {{ article.readingTime }}</span>
        <span v-if="article.chapterSlug">• فصل {{ article.chapterSlug }}</span>
      </div>

      <!-- The article body — HTML straight from WP, MathJax runs over it -->
      <div ref="body" class="pm-article-body" v-html="article.html"></div>

      <!-- Prev/Next navigation -->
      <nav class="mt-10 grid grid-cols-2 gap-3">
        <RouterLink
          v-if="article.prev"
          :to="`/article/${article.prev.slug}`"
          class="block p-3 bg-white border border-gray-200 rounded-xl text-sm hover:border-olive"
        >
          <div class="text-xs text-gray-500 mb-1">قبلی →</div>
          <div class="font-bold leading-snug">{{ article.prev.title }}</div>
        </RouterLink>
        <span v-else></span>

        <RouterLink
          v-if="article.next"
          :to="`/article/${article.next.slug}`"
          class="block p-3 bg-white border border-gray-200 rounded-xl text-sm hover:border-olive text-left"
        >
          <div class="text-xs text-gray-500 mb-1">← بعدی</div>
          <div class="font-bold leading-snug">{{ article.next.title }}</div>
        </RouterLink>
      </nav>
    </article>
  </main>

  <!-- Inline AI trigger: appears when user selects text inside the article -->
  <Teleport to="body">
    <Transition name="pm-ai-btn">
      <div v-if="showAiBtn" class="pm-ai-bubble">
        <button @pointerdown.prevent="askAI" class="pm-ai-bubble-btn">
          <span class="pm-ai-bubble-icon">⚛</span>
          <span>بپرس از AI</span>
        </button>
      </div>
    </Transition>
  </Teleport>

  <!-- Questions Modal -->
  <QuestionsModal
    v-if="article"
    :article-slug="article.slug"
    :open="showQuestionsModal"
    @close="showQuestionsModal = false"
  />

  <!-- Problems Modal -->
  <ProblemsModal
    v-if="article"
    :article-slug="article.slug"
    :open="showProblemsModal"
    @close="showProblemsModal = false"
  />

  <!-- Lab Modal -->
  <LabModal
    v-if="article"
    :article-slug="article.slug"
    :open="showLabModal"
    @close="showLabModal = false"
  />

  <!-- Comments Modal -->
  <CommentsModal
    v-if="article"
    :article-slug="article.slug"
    :open="showCommentsModal"
    @close="showCommentsModal = false"
  />
</template>

<style>
/* Sticky top bar — pads the Android status-bar safe-area inset so its content
   isn't clipped by the system overlay. The bar height + top padding both
   absorb env(safe-area-inset-top) on devices that report one. */
.pm-sticky-bar {
    position: sticky;
    top: 0;
    z-index: 20;
    background: #FBF6E3;
    border-bottom: 1px solid #D1D5DB;
    padding: calc(env(safe-area-inset-top, 0px) + 10px) 16px 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 48px;
}
.pm-sticky-bar a { text-decoration: none; }
.pm-sticky-bar button { background: transparent; border: none; cursor: pointer; }

/* Article body — minimal reset since the HTML comes from WP with its own styles */
.pm-article-body { line-height: 1.95; color: #1F2421; font-size: 16px; }
.pm-article-body h1, .pm-article-body h2, .pm-article-body h3 {
    font-weight: 800; margin: 1.6em 0 0.6em; line-height: 1.4;
}
.pm-article-body h1 { font-size: 1.9em; }
.pm-article-body h2 { font-size: 1.5em; border-bottom: 1px solid #E0DCC8; padding-bottom: 0.3em; }
.pm-article-body h3 { font-size: 1.2em; color: #3D4548; }
.pm-article-body p { margin: 0 0 1em; text-align: justify; }
.pm-article-body ul, .pm-article-body ol { padding-right: 1.4em; margin: 0 0 1em; }
.pm-article-body li { margin-bottom: 0.4em; }
.pm-article-body blockquote {
    background: #F8F6F0; border-right: 4px solid #9CAB52;
    padding: 12px 18px; margin: 18px 0; border-radius: 6px;
}
.pm-article-body table {
    width: 100%; border-collapse: collapse; margin: 18px 0; font-size: 0.92em;
}
.pm-article-body th, .pm-article-body td {
    border: 1px solid #E0DCC8; padding: 8px 10px; text-align: right;
}
.pm-article-body th { background: #3D4548; color: #F8F6F0; }
.pm-article-body tr:nth-child(even) td { background: #FAFAF5; }
.pm-article-body code {
    background: #F1ECDB; color: #4A3B1F; padding: 2px 5px;
    border-radius: 3px; font-size: 0.92em; direction: ltr; display: inline-block;
    font-family: 'JetBrains Mono', Consolas, monospace;
}
.pm-article-body pre {
    background: #1E1E2E; color: #EAE8DF; padding: 18px 14px;
    border-radius: 8px; overflow-x: auto; direction: ltr; text-align: left;
    line-height: 1.6; font-size: 14px;
    font-family: 'JetBrains Mono', Consolas, monospace;
}
.pm-article-body pre code { background: transparent; color: inherit; padding: 0; }
.pm-article-body iframe {
    width: 100%; border: none; border-radius: 12px; margin: 14px 0;
    background: #FAFAF5;
}
.pm-article-body img { max-width: 100%; height: auto; border-radius: 8px; }
.pm-article-body a { color: #5B6E32; text-decoration: underline;
    text-decoration-color: #D4A847; text-underline-offset: 3px; }

/* Quiz cards (details/summary from WP) */
.pm-article-body details {
    background: #FAFAF5; border: 1px solid #D4A847; border-radius: 10px;
    padding: 12px 16px; margin: 12px 0;
}
.pm-article-body summary {
    cursor: pointer; font-weight: 600; outline: none;
}
.pm-article-body details[open] summary { margin-bottom: 8px; }

/* Make sure MathJax doesn't overflow */
mjx-container[display="true"] {
    max-width: 100%; overflow-x: auto; padding-block: 0.4em;
}
mjx-container { line-height: 1.6; }

/* ── Inline AI bubble ─────────────────────────────────────────────────────── */
.pm-ai-bubble {
    position: fixed;
    bottom: calc(env(safe-area-inset-bottom, 0px) + 16px);
    left: 50%;
    transform: translateX(-50%);
    z-index: 9999;
}
.pm-ai-bubble-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 11px 22px;
    background: #1e40af;
    color: #fff;
    border: none;
    border-radius: 999px;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 4px 20px rgba(30,64,175,0.45);
    white-space: nowrap;
    user-select: none;
    -webkit-user-select: none;
}
.pm-ai-bubble-btn:active { background: #1e3a8a; }
.pm-ai-bubble-icon { font-size: 18px; line-height: 1; }
.pm-ai-btn-enter-active, .pm-ai-btn-leave-active { transition: opacity 0.15s, transform 0.15s; }
.pm-ai-btn-enter-from, .pm-ai-btn-leave-to { opacity: 0; transform: translateX(-50%) translateY(8px); }
</style>
