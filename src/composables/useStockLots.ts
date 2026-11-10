import { computed } from 'vue'
import { useAsyncList } from '@/composables/useAsyncList'
import { stockLotRepository } from '@/repositories'

export function useStockLots(warehouseId?: () => string | undefined, productId?: () => string | undefined) {
  const list = useAsyncList(() => stockLotRepository.list(warehouseId?.(), productId?.()))
  const lots = computed(() => list.data.value)
  return { lots, loading: list.loading, error: list.error, refresh: list.refresh }
}
