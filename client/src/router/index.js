import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/stores/userStore'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/auth/LoginPage.vue'),
    meta: { guest: true }
  },
  {
    path: '/',
    redirect: '/dashboard'
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('@/views/dashboard/DashboardPage.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/market',
    name: 'Market',
    component: () => import('@/views/market/MarketPage.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/market/:code',
    name: 'StockDetail',
    component: () => import('@/views/market/StockDetail.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/strategy',
    name: 'Strategy',
    component: () => import('@/views/strategy/StrategyPage.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/backtest',
    name: 'Backtest',
    component: () => import('@/views/backtest/BacktestPage.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/screener',
    name: 'Screener',
    component: () => import('@/views/screener/ScreenerPage.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/vision',
    name: 'Vision',
    component: () => import('@/views/vision/VisionAnalysis.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/signals',
    name: 'Signals',
    component: () => import('@/views/signals/SignalsPage.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/ai-settings',
    name: 'AiSettings',
    component: () => import('@/views/settings/AiSettingsPage.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/admin',
    name: 'Admin',
    component: () => import('@/views/admin/AdminPage.vue'),
    meta: { requiresAuth: true, roles: ['admin'] }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 路由守卫
router.beforeEach((to, from, next) => {
  const userStore = useUserStore()

  if (to.meta.requiresAuth && !userStore.isLoggedIn) {
    next({ name: 'Login', query: { redirect: to.fullPath } })
  } else if (to.meta.guest && userStore.isLoggedIn) {
    next({ name: 'Dashboard' })
  } else if (to.meta.roles && !to.meta.roles.includes(userStore.user?.role)) {
    next({ name: 'Dashboard' })
  } else {
    next()
  }
})

export default router
