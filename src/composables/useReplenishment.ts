import { computed, ref } from 'vue'
import { replenishmentService, totalEstimatedCost } from '@/services/replenishment.service'
import { productService } from '@/services/product.service'
import { warehouseService } from '@/services/warehouse.service'
import { supplierService } from '@/services/supplier.service'
import { useAsyncList } from './useAsyncList'
import { usePermissions } from './usePermissions'
import { emitDataChanged } from '@/utils/events'
import type { ReplenishmentSuggestion } from '@/types'

export interface ReplenishmentRow extends ReplenishmentSuggestion {
  productName: string
  sku: string
  unit: string
  warehouseName: string
  supplierName: string
}

export function useReplenishment() {
  const { scopedWarehouseIds, inScopeWarehouse } = usePermissions()
  const suggestions = useAsyncList(() => replenishmentService.list())
  const products = useAsyncList(() => productService.list())
  const warehouses = useAsyncList(() => warehouseService.list())
  const suppliers = useAsyncList(() => supplierService.list())

  const computing = ref(false)

  const rows = computed<ReplenishmentRow[]>(() => {
    const productById = new Map(products.data.value.map((item) => [item.id, item]))
    const warehouseById = new Map(warehouses.data.value.map((item) => [item.id, item]))
    const supplierById = new Map(suppliers.data.value.map((item) => [item.id, item]))

    return suggestions.data.value
      .filter((row) => inScopeWarehouse(row.warehouseId))
      .map((row) => {
        const product = productById.get(row.productId)
        return {
          ...row,
          productName: product?.name ?? row.productId,
          sku: product?.sku ?? '',
          unit: product?.unit ?? 'unité',
          warehouseName: warehouseById.get(row.warehouseId)?.name ?? row.warehouseId,
          supplierName: row.supplierId ? (supplierById.get(row.supplierId)?.name ?? '') : '',
        }
      })
      .sort((a, b) => {
        const rank = { high: 0, medium: 1, low: 2 }
        if (rank[a.risk] !== rank[b.risk]) return rank[a.risk] - rank[b.risk]
        return b.suggestedQuantity - a.suggestedQuantity
      })
  })

  const counts = computed(() => ({
    all: rows.value.length,
    high: rows.value.filter((row) => row.risk === 'high').length,
    medium: rows.value.filter((row) => row.risk === 'medium').length,
    low: rows.value.filter((row) => row.risk === 'low').length,
  }))

  const estimatedCost = computed(() => totalEstimatedCost(rows.value))

  /** Horodatage du calcul le plus récent, pour signaler une vue périmée. */
  const computedAt = computed(() => {
    const stamps = rows.value.map((row) => row.computedAt).filter((value): value is string => !!value)
    if (!stamps.length) return null
    return stamps.sort()[stamps.length - 1] ?? null
  })

  const targetWarehouseIds = computed(
    () => scopedWarehouseIds() ?? warehouses.data.value.map((item) => item.id),
  )

  async function recompute(refreshDemand = false) {
    const ids = targetWarehouseIds.value
    if (!ids.length) return
    computing.value = true
    try {
      await replenishmentService.computeMany(ids, refreshDemand)
      await suggestions.refresh(true)
      emitDataChanged()
    } finally {
      computing.value = false
    }
  }

  return {
    rows,
    counts,
    estimatedCost,
    computedAt,
    computing,
    loading: suggestions.loading,
    error: suggestions.error,
    products: products.data,
    warehouses: warehouses.data,
    refresh: suggestions.refresh,
    recompute,
  }
}
