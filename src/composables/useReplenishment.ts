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

function enrich(
  list: ReplenishmentSuggestion[],
  products: { id: string; name: string; sku: string; unit: string }[],
  warehouses: { id: string; name: string }[],
  suppliers: { id: string; name: string }[],
  inScopeWarehouse: (id: string) => boolean,
): ReplenishmentRow[] {
  const productById = new Map(products.map((item) => [item.id, item]))
  const warehouseById = new Map(warehouses.map((item) => [item.id, item]))
  const supplierById = new Map(suppliers.map((item) => [item.id, item]))

  return list
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
}

export function useReplenishment() {
  const { scopedWarehouseIds, inScopeWarehouse } = usePermissions()
  const suggestions = useAsyncList(() => replenishmentService.list())
  const products = useAsyncList(() => productService.list())
  const warehouses = useAsyncList(() => warehouseService.list())
  const suppliers = useAsyncList(() => supplierService.list())

  const computing = ref(false)
  const simulating = ref(false)
  const simulation = ref<ReplenishmentSuggestion[] | null>(null)
  const serviceLevel = ref(0.95)
  const leadTimeDays = ref<number | null>(null)

  const persistedRows = computed(() =>
    enrich(
      suggestions.data.value,
      products.data.value,
      warehouses.data.value,
      suppliers.data.value,
      inScopeWarehouse,
    ),
  )

  const rows = computed<ReplenishmentRow[]>(() => {
    if (!simulation.value) return persistedRows.value
    return enrich(
      simulation.value,
      products.data.value,
      warehouses.data.value,
      suppliers.data.value,
      inScopeWarehouse,
    )
  })

  const isSimulation = computed(() => simulation.value !== null)

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
      simulation.value = null
      await replenishmentService.computeMany(ids, refreshDemand)
      await suggestions.refresh(true)
      emitDataChanged()
    } finally {
      computing.value = false
    }
  }

  async function runSimulate(level = serviceLevel.value, lead = leadTimeDays.value) {
    const ids = targetWarehouseIds.value
    if (!ids.length) return
    simulating.value = true
    serviceLevel.value = level
    leadTimeDays.value = lead
    try {
      const batches = await Promise.all(
        ids.map((id) =>
          replenishmentService.simulate(id, {
            serviceLevel: level,
            ...(lead != null ? { leadTimeDays: lead } : {}),
          }),
        ),
      )
      simulation.value = batches.flat()
    } finally {
      simulating.value = false
    }
  }

  function clearSimulation() {
    simulation.value = null
    leadTimeDays.value = null
  }

  return {
    rows,
    persistedRows,
    counts,
    estimatedCost,
    computedAt,
    computing,
    simulating,
    isSimulation,
    serviceLevel,
    leadTimeDays,
    loading: suggestions.loading,
    error: suggestions.error,
    products: products.data,
    warehouses: warehouses.data,
    refresh: suggestions.refresh,
    recompute,
    runSimulate,
    clearSimulation,
  }
}
