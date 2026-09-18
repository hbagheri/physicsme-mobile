import { createRouter, createWebHistory } from 'vue-router';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/',                  component: () => import('./views/HomeView.vue'),     meta: { title: 'خانه' } },
    { path: '/book/:slug',        component: () => import('./views/BookView.vue'),     meta: { title: 'کتاب' } },
    { path: '/article/:slug',     component: () => import('./views/ArticleView.vue'),  meta: { title: 'مقاله' } },
    { path: '/bookmarks',         component: () => import('./views/BookmarksView.vue'),meta: { title: 'نشان‌شده‌ها' } },
    { path: '/settings',          component: () => import('./views/SettingsView.vue'), meta: { title: 'تنظیمات' } },
    { path: '/chat',              component: () => import('./views/ChatView.vue'),     meta: { title: 'دستیار فیزیک' } },
    { path: '/:pathMatch(.*)*',   component: () => import('./views/NotFoundView.vue'), meta: { title: 'پیدا نشد' } },
  ],
});

router.afterEach((to) => {
  if (to.meta?.title) document.title = `${to.meta.title} — منِ فیزیکی`;
});
