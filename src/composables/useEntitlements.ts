import { useEntitlementsStore } from '@/stores/entitlements'
import type { PlanModule } from '@/types'

export function useEntitlements() {
  const store = useEntitlementsStore()
  return {
    entitlements: store.snapshot,
    loading: store.loading,
    hasModule: (module: PlanModule) => store.hasModule(module),
    canAddUser: store.canAddUser,
    canAddWarehouse: store.canAddWarehouse,
    refresh: store.refresh,
  }
}
