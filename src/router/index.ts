import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useEntitlementsStore } from '@/stores/entitlements'
import { ROLE_PERMISSIONS } from '@/mocks/roles'
import type { PermissionKey, PlanModule, RoleKey } from '@/types'
import { homeFor } from '@/composables/useAuth'
import { moduleForPath } from '@/utils/entitlements'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    component: () => import('@/layouts/AuthLayout.vue'),
    children: [
      { path: '', component: () => import('@/pages/auth/LoginPage.vue') },
    ],
  },
  {
    path: '/forgot-password',
    component: () => import('@/layouts/AuthLayout.vue'),
    children: [{ path: '', component: () => import('@/pages/auth/ForgotPasswordPage.vue') }],
  },
  {
    path: '/reset-password',
    component: () => import('@/layouts/AuthLayout.vue'),
    children: [{ path: '', component: () => import('@/pages/auth/ResetPasswordPage.vue') }],
  },
  {
    path: '/driver',
    component: () => import('@/layouts/DriverLayout.vue'),
    meta: { auth: true, roles: ['DRIVER'] satisfies RoleKey[] },
    children: [{ path: 'today', component: () => import('@/pages/driver/DriverTodayPage.vue') }],
  },
  {
    path: '/',
    component: () => import('@/layouts/AppLayout.vue'),
    meta: { auth: true },
    children: [
      { path: '', redirect: '/today' },
      { path: 'today', component: () => import('@/pages/today/TodayPage.vue') },
      { path: 'assistant', component: () => import('@/pages/assistant/AssistantPage.vue'), meta: { module: 'assistant' satisfies PlanModule } },
      { path: 'tasks', component: () => import('@/pages/tasks/TasksPage.vue'), meta: { permission: 'task.view' } },
      { path: 'planning', component: () => import('@/pages/planning/PlanningPage.vue'), meta: { permission: 'task.view' } },
      { path: 'alerts', component: () => import('@/pages/alerts/AlertsPage.vue') },
      { path: 'stock', component: () => import('@/pages/stock/StockPage.vue'), meta: { permission: 'stock.view', module: 'stock' satisfies PlanModule } },
      { path: 'procurement', component: () => import('@/pages/procurement/ProcurementPage.vue'), meta: { permission: 'procurement.view', module: 'procurement' satisfies PlanModule } },
      { path: 'purchasing', redirect: '/procurement' },
      { path: 'logistics', component: () => import('@/pages/logistics/LogisticsPage.vue'), meta: { permission: 'delivery.view', module: 'logistics' satisfies PlanModule } },
      { path: 'finance', component: () => import('@/pages/finance/FinancePage.vue'), meta: { permission: 'finance.view', module: 'finance' satisfies PlanModule } },
      { path: 'analytics', component: () => import('@/pages/analytics/AnalyticsPage.vue'), meta: { permission: 'analytics.view', module: 'analytics' satisfies PlanModule } },
      { path: 'analytics/forecasts', component: () => import('@/pages/analytics/ForecastsPage.vue'), meta: { permission: 'analytics.view', module: 'analytics' satisfies PlanModule } },
      { path: 'analytics/reports', component: () => import('@/pages/analytics/ReportsPage.vue'), meta: { permission: 'analytics.view', module: 'analytics' satisfies PlanModule } },
      { path: 'admin', component: () => import('@/pages/admin/AdminPage.vue'), meta: { permission: 'user.view' } },
      {
        path: 'platform',
        component: () => import('@/pages/platform/PlatformPage.vue'),
        meta: { roles: ['SUPER_ADMIN'] satisfies RoleKey[], permission: 'platform.view' },
      },
      {
        path: 'account',
        component: () => import('@/pages/account/AccountPage.vue'),
        meta: { roles: ['TENANT_OWNER'] satisfies RoleKey[], permission: 'account.view' },
      },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/today' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  const entitlements = useEntitlementsStore()
  const needsAuth = to.matched.some((record) => record.meta.auth)
  if (needsAuth && !auth.isAuthenticated) {
    return { path: '/login', query: to.path !== '/' ? { redirect: to.fullPath } : undefined }
  }
  if (to.path.startsWith('/login') && auth.isAuthenticated && auth.currentUser) {
    return homeFor(auth.currentUser.role)
  }
  const roles = to.matched.find((record) => record.meta.roles)?.meta.roles as RoleKey[] | undefined
  if (roles && auth.currentUser && !roles.includes(auth.currentUser.role)) {
    return homeFor(auth.currentUser.role)
  }
  if (auth.currentUser?.role === 'SUPER_ADMIN' && !to.path.startsWith('/platform')) {
    if (needsAuth && to.path !== '/login') return '/platform'
  }
  if (to.path.startsWith('/platform') && auth.currentUser && auth.currentUser.role !== 'SUPER_ADMIN') {
    return homeFor(auth.currentUser.role)
  }
  if (auth.currentUser?.role === 'TENANT_OWNER' && !to.path.startsWith('/account')) {
    if (needsAuth && to.path !== '/login') return '/account'
  }
  if (to.path.startsWith('/account') && auth.currentUser && auth.currentUser.role !== 'TENANT_OWNER') {
    return homeFor(auth.currentUser.role)
  }
  if (auth.currentUser?.role === 'DRIVER' && !to.path.startsWith('/driver') && to.path !== '/alerts') {
    if (to.matched.some((record) => record.meta.auth) && to.path !== '/login') return '/driver/today'
  }
  const permission = to.matched.find((record) => record.meta.permission)?.meta.permission as PermissionKey | undefined
  if (permission && auth.currentUser && !ROLE_PERMISSIONS[auth.currentUser.role].includes(permission)) {
    return homeFor(auth.currentUser.role)
  }
  if (auth.isAuthenticated && auth.currentUser && !entitlements.snapshot) {
    await entitlements.refresh()
  }
  const moduleMeta = to.matched.find((record) => record.meta.module)?.meta.module as PlanModule | undefined
  const moduleNeeded = moduleMeta ?? moduleForPath(to.path)
  if (moduleNeeded && auth.currentUser && !entitlements.hasModule(moduleNeeded)) {
    return homeFor(auth.currentUser.role)
  }
  return true
})

export default router
