import type { User } from '@/types'
import { apiConfig } from '@/config/api'
import { authRepository, userRepository } from '@/repositories'
import { useAuthStore } from '@/stores/auth'
import { ApiError, getAccessToken } from '@/services/http/http.client'

export const authService = {
  async login(email: string, password: string): Promise<User> {
    const user = await authRepository.login(email, password)
    useAuthStore().setUser(user)
    return user
  },

  async logout(): Promise<void> {
    await authRepository.logout()
    useAuthStore().setUser(null)
  },

  async restore(): Promise<User | null> {
    const store = useAuthStore()

    if (apiConfig.useApi) {
      if (!getAccessToken()) {
        store.setUser(null)
        return null
      }
      try {
        const user = await authRepository.restore('')
        if (user) {
          store.setUser(user)
          return user
        }
        store.setUser(null)
        return null
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          store.setUser(null)
          return null
        }
        return store.currentUser
      }
    }

    const id = store.readUserId()
    if (!id) {
      store.setUser(null)
      return null
    }
    try {
      const user = await authRepository.restore(id)
      if (user) store.setUser(user)
      else store.setUser(null)
      return user
    } catch {
      return store.currentUser
    }
  },

  async current(): Promise<User | null> {
    return useAuthStore().currentUser
  },

  users: () => userRepository.list(),
}
