import { computed } from 'vue'
import { useCurrentUser } from './useAuth'

export function useRoleTheme() {
  const { currentUser } = useCurrentUser()
  return computed(() => {
    const role = currentUser.value?.role
    if (role === 'FINANCE') return 'theme-finance'
    if (role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'TENANT_OWNER') return 'theme-admin'
    return 'theme-ops'
  })
}
