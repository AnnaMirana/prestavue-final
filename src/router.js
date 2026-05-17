import { createRouter, createWebHistory } from 'vue-router'
import { AuthService } from './services/auth.service'

const LoginView = () => import('./views/LoginView.vue')
const BackofficeView = () => import('./views/BackofficeView.vue')
const GlobalImportView = () => import('./views/GlobalImportView.vue')
const DashboardView = () => import('./views/DashboardView.vue')
const ShopLoginView = () => import('./views/ShopLoginView.vue')
const FrontofficeView = () => import('./views/FrontofficeView.vue')
const StockManagement = () => import('./views/StockManagement.vue')
const StockEvolution = () => import('./views/StockEvolution.vue')

const routes = [
  { path: '/', redirect: '/shop-login' },
  { path: '/login', component: LoginView, meta: { public: true } },
  { path: '/shop-login', component: ShopLoginView, meta: { public: true } },
  { path: '/shop', component: FrontofficeView, meta: { public: true } },
  {
    path: '/backoffice',
    component: BackofficeView,
    children: [
      { path: '', redirect: '/backoffice/dashboard' },
      { path: 'import', component: GlobalImportView },
      { path: 'dashboard', component: DashboardView },
      { path: 'stock', component: StockManagement },
      { path: 'stock-evolution', component: StockEvolution }
    ]
  },
  { path: '/global-import', redirect: '/backoffice/import' },
  { path: '/dashboard', redirect: '/backoffice/dashboard' },
  { path: '/stock-management', redirect: '/backoffice/stock' },
  { path: '/stock-evolution', redirect: '/backoffice/stock-evolution' }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to) => {
  const isPublic = to.matched.some((route) => route.meta.public)
  const isAuthenticated = AuthService.isAuthenticated()

  if (!isPublic && !isAuthenticated) return '/login'
  if (isAuthenticated && to.path === '/login') return '/backoffice/dashboard'
  return true
})

export default router
