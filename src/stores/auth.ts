import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { User } from '@/types'

const KEY = 'bravo-stock-ops-user'

export const useAuthStore = defineStore('auth', () => {
  const currentUser = ref<User | null>(readStoredUser())

  const isAuthenticated = computed(() => currentUser.value !== null)

  function setUser(user: User | null) {
    currentUser.value = user
    if (user) localStorage.setItem(KEY, JSON.stringify(user))
    else localStorage.removeItem(KEY)
  }

  function readUserId(): string | null {
    return currentUser.value?.id ?? readStoredUserId()
  }

  return { currentUser, isAuthenticated, setUser, readUserId }
})

function readStoredUser(): User | null {
  const raw = localStorage.getItem(KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === 'object' && 'id' in parsed && 'email' in parsed) {
      return parsed as User
    }
  } catch {
    return null
  }
  return null
}

export function readStoredUserId(): string | null {
  const user = readStoredUser()
  if (user?.id) return user.id
  const raw = localStorage.getItem(KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed === 'string' && parsed) return parsed
  } catch {
    return raw.replace(/^"|"$/g, '') || null
  }
  return null
}
