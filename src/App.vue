<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router';
import { useBookmarksStore } from '@/stores/bookmarks';
import { useArticleCacheStore } from '@/stores/articleCache';
import { initPushNotifications } from '@/composables/usePushNotifications';
import { checkAppVersion } from '@/composables/useAppVersion';
import UpdateBanner from '@/components/UpdateBanner.vue';

const bookmarks = useBookmarksStore();
const articleCache = useArticleCacheStore();
const router = useRouter();
onMounted(() => {
  bookmarks.hydrate();
  articleCache.hydrate();
  initPushNotifications(router);
  checkAppVersion();
});

const route = useRoute();
const hideTabBar = computed(() => route.path.startsWith('/article/') || route.path === '/chat');
</script>

<template>
  <div class="min-h-screen flex flex-col pm-app-root">
    <RouterView />

    <UpdateBanner />

    <nav v-if="!hideTabBar" class="pm-tabbar">
      <RouterLink to="/" class="pm-tab" :class="{ active: route.path === '/' }">
        <span class="pm-tab-icon">🏠</span>
        <span class="pm-tab-label">خانه</span>
      </RouterLink>
      <RouterLink to="/bookmarks" class="pm-tab" :class="{ active: route.path === '/bookmarks' }">
        <span class="pm-tab-icon">★</span>
        <span class="pm-tab-label">نشان‌شده‌ها</span>
        <span v-if="bookmarks.count > 0" class="pm-tab-badge">{{ bookmarks.count }}</span>
      </RouterLink>
      <RouterLink to="/chat" class="pm-tab" :class="{ active: route.path === '/chat' }">
        <span class="pm-tab-icon">⚛</span>
        <span class="pm-tab-label">دستیار</span>
      </RouterLink>
      <RouterLink to="/settings" class="pm-tab" :class="{ active: route.path === '/settings' }">
        <span class="pm-tab-icon">⚙</span>
        <span class="pm-tab-label">تنظیمات</span>
      </RouterLink>
    </nav>
  </div>
</template>

<style>
/* Reserve the Android status-bar safe area on every page so non-sticky tops
   (← خانه links, page titles) aren't clipped by the system overlay. The
   sticky bar in ArticleView handles its own inset so it stays glued to the
   true viewport top below the status bar. */
.pm-app-root { padding-top: env(safe-area-inset-top, 0px); }

.pm-tabbar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 30;
  display: flex;
  background: #FBF6E3;
  border-top: 1px solid #D1D5DB;
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
.pm-tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 8px 4px 10px;
  color: #6B7280;
  text-decoration: none;
  position: relative;
  font-size: 11px;
  gap: 2px;
  transition: color 0.15s;
}
.pm-tab.active { color: #5B6E32; }
.pm-tab-icon { font-size: 20px; line-height: 1; }
.pm-tab-badge {
  position: absolute;
  top: 4px;
  /* In RTL the visual "right of icon" is logical-end; placing badge at 28% from center works for all tabs */
  right: calc(50% - 22px);
  background: #D4A847;
  color: #1F2421;
  font-size: 10px;
  font-weight: bold;
  min-width: 16px;
  height: 16px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
}
</style>
