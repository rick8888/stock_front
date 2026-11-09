import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { authService } from '@/services/auth.service'
import type { RoleKey } from '@/types'

export function useAuth() {
  const store = useAuthStore()
  const router = useRouter()
  const { currentUser, isAuthenticated } = storeToRefs(store)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function login(email: string, password: string) {
    loading.value = true
    error.value = null
    try {
      const user = await authService.login(email, password)
      const redirect = router.currentRoute.value.query.redirect
      const target =
        typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('//')
          ? redirect
          : homeFor(user.role)
      await router.push(target)
      return user
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Connexion impossible'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    loading.value = true
    error.value = null
    try {
      await authService.logout()
      await router.push('/login')
    } finally {
      loading.value = false
    }
  }

  async function restore() {
    return authService.restore()
  }

  return { currentUser, isAuthenticated, loading, error, login, logout, restore }
}

export function homeFor(role: RoleKey): string {
  if (role === 'DRIVER') return '/driver/today'
  if (role === 'SUPER_ADMIN') return '/platform'
  if (role === 'TENANT_OWNER') return '/account'
  if (role === 'ADMIN') return '/admin'
  return '/today'
}

export function useCurrentUser() {
  const { currentUser } = storeToRefs(useAuthStore())
  const displayName = computed(() =>
    currentUser.value ? `${currentUser.value.firstName} ${currentUser.value.lastName}` : '',
  )
  return { currentUser, displayName }
}
