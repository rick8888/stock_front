import { computed } from 'vue'
import { warehouseService } from '@/services/warehouse.service'
import { useAsyncList } from './useAsyncList'
import { usePermissions } from './usePermissions'
import { useCurrentUser } from './useAuth'
import type { Warehouse } from '@/types'

export function useWarehouses() {
  const { scopedWarehouseIds } = usePermissions()
  const { currentUser } = useCurrentUser()
  const list = useAsyncList(() => warehouseService.list())
  const warehouses = computed(() => {
    const companyId = currentUser.value?.companyId
    const byCompany = companyId
      ? list.data.value.filter((row) => !row.companyId || row.companyId === companyId)
      : list.data.value
    const ids = scopedWarehouseIds()
    if (!ids) return byCompany
    return byCompany.filter((row) => ids.includes(row.id))
  })
  const allWarehouses = computed(() => {
    const companyId = currentUser.value?.companyId
    if (!companyId) return list.data.value
    return list.data.value.filter((row) => !row.companyId || row.companyId === companyId)
  })
  async function createWarehouse(input: Omit<Warehouse, 'id'>) {
    return warehouseService.create({
      ...input,
      companyId: input.companyId ?? currentUser.value?.companyId,
    })
  }

  return {
    warehouses,
    allWarehouses,
    loading: list.loading,
    error: list.error,
    refresh: list.refresh,
    createWarehouse,
    updateWarehouse: warehouseService.update,
  }
}
