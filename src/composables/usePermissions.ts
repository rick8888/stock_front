import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useEntitlementsStore } from '@/stores/entitlements'
import { ROLE_PERMISSIONS } from '@/mocks/roles'
import type { PermissionKey, PlanModule } from '@/types'

export function usePermissions() {
  const store = useAuthStore()
  const entitlements = useEntitlementsStore()

  const permissions = computed<PermissionKey[]>(() => {
    const user = store.currentUser
    if (!user) return []
    return ROLE_PERMISSIONS[user.role]
  })

  function can(permission: PermissionKey): boolean {
    return permissions.value.includes(permission)
  }

  function hasModule(module: PlanModule): boolean {
    return entitlements.hasModule(module)
  }

  function canOnWarehouse(permission: PermissionKey, warehouseId: string): boolean {
    if (!can(permission)) return false
    const user = store.currentUser
    if (!user) return false
    if (!user.warehouseIds.length) return true
    return user.warehouseIds.includes(warehouseId)
  }

  function inScopeWarehouse(warehouseId: string): boolean {
    const user = store.currentUser
    if (!user) return false
    if (!user.warehouseIds.length) return true
    return user.warehouseIds.includes(warehouseId)
  }

  function scopedWarehouseIds(): string[] | undefined {
    const user = store.currentUser
    if (!user || !user.warehouseIds.length) return undefined
    return user.warehouseIds
  }

  return { permissions, can, hasModule, canOnWarehouse, inScopeWarehouse, scopedWarehouseIds }
}
