import { computed } from 'vue'
import { useAsyncList } from '@/composables/useAsyncList'
import { locationRepository, placementRepository } from '@/repositories'
import type { WarehouseLocationInput } from '@/repositories/interfaces'

export function useLocations(warehouseId?: () => string | undefined) {
  const list = useAsyncList(() => locationRepository.list(warehouseId?.()))
  const locations = computed(() => list.data.value)

  async function createLocation(input: WarehouseLocationInput) {
    const created = await locationRepository.create(input)
    await list.refresh()
    return created
  }

  async function updateLocation(id: string, input: Partial<WarehouseLocationInput>) {
    const updated = await locationRepository.update(id, input)
    await list.refresh()
    return updated
  }

  return {
    locations,
    loading: list.loading,
    error: list.error,
    refresh: list.refresh,
    createLocation,
    updateLocation,
  }
}

export function usePlacements(warehouseId?: () => string | undefined, productId?: () => string | undefined) {
  const list = useAsyncList(() => placementRepository.list(warehouseId?.(), productId?.()))
  const placements = computed(() => list.data.value)
  return { placements, loading: list.loading, error: list.error, refresh: list.refresh }
}

export async function fetchPickPath(
  warehouseId: string,
  lines: { productId: string; quantity: number; productName?: string; sku?: string }[],
) {
  return placementRepository.pickPath(warehouseId, lines)
}
