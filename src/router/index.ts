import { createRouter, createWebHistory } from 'vue-router'
import HomePage from '@/pages/HomePage.vue'
import FarmerPage from '@/pages/FarmerPage.vue'
import PluginsPage from "@/pages/PluginsPage.vue"
import FilesPage from "@/pages/FilesPage.vue"
import SettingsPage from "@/pages/SettingsPage.vue"
import UserPage from "@/pages/UserPage.vue"
import LoginPage from '@/pages/LoginPage.vue'
import { useUserStore } from '@/stores/userStore'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomePage,
      meta: { requiresAuth: true }
    },
    {
      path: '/farmer',
      name: 'farmer',
      component: FarmerPage,
      meta: { requiresAuth: true }
    },
    {
      path: '/plugins',
      name: 'plugins',
      component: PluginsPage,
      meta: { requiresAuth: true }
    },
    {
      path: '/files',
      name: 'files',
      component: FilesPage,
      meta: { requiresAuth: true }
    },
    {
      path: '/settings',
      name: 'settings',
      component: SettingsPage,
      meta: { requiresAuth: true }
    },
    {
      path: '/user',
      name: 'user',
      component: UserPage,
      meta: { requiresAuth: true }
    },
    {
      path: '/login',
      name: 'login',
      component: LoginPage
    }
  ],
})

router.beforeEach((to, from, next) => {
  const userStore = useUserStore()

  userStore.refreshUserFromToken()

  if (to.matched.some(record => record.meta.requiresAuth)) {
    if (!userStore.isAuthenticated) {
      return next({
        path: '/login',
        query: { redirect: to.fullPath }
      })
    }

    if (userStore.passwordUpdateRequired && to.name !== 'user') {
      return next({ name: 'user' })
    }
  }

  next()
})

export default router