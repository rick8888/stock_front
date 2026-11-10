import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { apiConfig } from '@/config/api'
import { httpClient } from '@/services/http/http.client'
import { platformRepository } from '@/repositories'
import { buildEntitlements } from '@/utils/entitlements'
import type { Entitlements, PlanModule } from '@/types'

export const useEntitlementsStore = defineStore('entitlements', () => {
  const snapshot = ref<Entitlements | null>(null)
  const loading = ref(false)

  async function refresh() {
    const auth = useAuthStore()
    const user = auth.currentUser
    if (!user) {
      snapshot.value = null
      return
    }
    loading.value = true
    try {
      if (user.role === 'SUPER_ADMIN') {
        snapshot.value = buildEntitlements({ bypass: true })
        return
      }
      if (apiConfig.useApi) {
        snapshot.value = await httpClient.request<Entitlements>('/platform/entitlements')
        return
      }
      const [companies, subscriptions, plans] = await Promise.all([
        platformRepository.companies(),
        platformRepository.subscriptions(),
        platformRepository.plans(),
      ])
      const company = companies.find((item) => item.id === user.companyId) ?? null
      const subscription = subscriptions.find((item) => item.companyId === user.companyId) ?? null
      const plan = plans.find((item) => item.id === subscription?.planId) ?? null
      snapshot.value = buildEntitlements({ company, subscription, plan })
    } finally {
      loading.value = false
    }
  }

  function hasModule(module: PlanModule) {
    const auth = useAuthStore()
    if (auth.currentUser?.role === 'SUPER_ADMIN') return true
    return Boolean(snapshot.value?.modules.includes(module))
  }

  return {
    snapshot: computed(() => snapshot.value),
    loading: computed(() => loading.value),
    canAddUser: computed(() => snapshot.value?.canAddUser ?? true),
    canAddWarehouse: computed(() => snapshot.value?.canAddWarehouse ?? true),
    hasModule,
    refresh,
  }
})
