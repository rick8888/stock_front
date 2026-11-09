import { computed } from 'vue'
import { stockService, buildStockRows, recommendStock } from '@/services/stock.service'
import { purchaseService } from '@/services/purchase.service'
import { procurementService } from '@/services/procurement.service'
import { supplierService } from '@/services/supplier.service'
import { productService } from '@/services/product.service'
import { warehouseService } from '@/services/warehouse.service'
import { receiptService } from '@/services/receipt.service'
import { userRepository } from '@/repositories'
import { useAsyncList } from './useAsyncList'
import { usePermissions } from './usePermissions'
import { useCurrentUser } from './useAuth'
import { downloadCsv } from '@/utils/csv'
import { MOVEMENT_LABEL } from '@/config/stock'
import { useDataStore } from '@/stores/data'
import { DEMO_TODAY } from '@/utils/helpers'
import type { StockHealth, StockMovementType, StockOverviewRow } from '@/types'

export function useStock() {
  const { scopedWarehouseIds, inScopeWarehouse } = usePermissions()
  const { currentUser } = useCurrentUser()
  const store = useDataStore()
  const { data: stock, loading, error, refresh } = useAsyncList(() => stockService.list())
  const movements = useAsyncList(() => stockService.movements())
  const inventories = useAsyncList(() => stockService.inventories())
  const products = useAsyncList(() => productService.list())
  const warehouses = useAsyncList(() => warehouseService.list())
  const orders = useAsyncList(() => purchaseService.list())
  const requests = useAsyncList(() => procurementService.list())
  const suppliers = useAsyncList(() => supplierService.list())
  const receipts = useAsyncList(() => receiptService.list())
  const users = useAsyncList(() => userRepository.list())

  const scopedStock = computed(() => {
    const ids = scopedWarehouseIds()
    if (!ids) return stock.value
    return stock.value.filter((row) => ids.includes(row.warehouseId))
  })

  const scopedWarehouses = computed(() => {
    const ids = scopedWarehouseIds()
    if (!ids) return warehouses.data.value
    return warehouses.data.value.filter((item) => ids.includes(item.id))
  })

  const overview = computed(() =>
    buildStockRows({
      stock: scopedStock.value,
      products: products.data.value.filter((item) => !item.archived),
      warehouses: warehouses.data.value,
      orders: orders.data.value,
      suppliers: suppliers.data.value,
    }),
  )

  const counts = computed(() => {
    const tally: Record<StockHealth | 'all', number> = {
      all: overview.value.length,
      critical: 0,
      watch: 0,
      on_order: 0,
      normal: 0,
    }
    overview.value.forEach((row) => {
      tally[row.status] += 1
    })
    return tally
  })

  const scopedMovements = computed(() => {
    const ids = scopedWarehouseIds()
    const list = [...movements.data.value].sort((a, b) => b.date.localeCompare(a.date))
    if (!ids) return list
    return list.filter(
      (item) =>
        (item.fromWarehouseId && ids.includes(item.fromWarehouseId)) ||
        (item.toWarehouseId && ids.includes(item.toWarehouseId)),
    )
  })

  const scopedInventories = computed(() => {
    const ids = scopedWarehouseIds()
    const list = inventories.data.value
    if (!ids) return list
    return list.filter((item) => ids.includes(item.warehouseId))
  })

  const pendingReceipts = computed(() => {
    const ids = scopedWarehouseIds()
    return receipts.data.value.filter(
      (item) =>
        item.status !== 'validated' && (!ids || ids.includes(item.warehouseId)),
    )
  })

  function recommendationFor(row: StockOverviewRow) {
    return recommendStock(row, requests.data.value)
  }

  function movementsFor(productId: string, warehouseId: string, limit?: number) {
    const list = scopedMovements.value.filter(
      (item) =>
        item.productId === productId &&
        (item.fromWarehouseId === warehouseId || item.toWarehouseId === warehouseId),
    )
    return limit ? list.slice(0, limit) : list
  }

  function requestsFor(productId: string, warehouseId: string) {
    return requests.data.value.filter(
      (item) => item.warehouseId === warehouseId && item.items.some((line) => line.productId === productId),
    )
  }

  function ordersFor(productId: string, warehouseId: string) {
    return orders.data.value.filter(
      (item) => item.warehouseId === warehouseId && item.items.some((line) => line.productId === productId),
    )
  }

  function productName(id: string) {
    return products.data.value.find((item) => item.id === id)?.name ?? id
  }

  function warehouseName(id?: string) {
    if (!id) return '—'
    return warehouses.data.value.find((item) => item.id === id)?.name ?? id
  }

  function userName(id: string) {
    const user = users.data.value.find((item) => item.id === id)
    return user ? `${user.firstName} ${user.lastName}` : id
  }

  async function refreshAll(silent = true) {
    await Promise.all([
      refresh(silent),
      movements.refresh(silent),
      inventories.refresh(silent),
      receipts.refresh(silent),
      orders.refresh(silent),
    ])
  }

  async function receiveStock(productId: string, warehouseId: string, quantity: number, note = 'Réception', reference?: string) {
    if (!currentUser.value || !inScopeWarehouse(warehouseId)) throw new Error('Périmètre insuffisant')
    await stockService.receive(productId, warehouseId, quantity, currentUser.value.id, note, reference)
    await refreshAll()
  }

  async function issueStock(productId: string, warehouseId: string, quantity: number, note = 'Sortie', reference?: string) {
    if (!currentUser.value || !inScopeWarehouse(warehouseId)) throw new Error('Périmètre insuffisant')
    await stockService.issue(productId, warehouseId, quantity, currentUser.value.id, note, reference)
    await refreshAll()
  }

  async function transferStock(productId: string, fromId: string, toId: string, quantity: number, note?: string) {
    if (!currentUser.value || !inScopeWarehouse(fromId)) throw new Error('Périmètre insuffisant')
    await stockService.transfer(productId, fromId, toId, quantity, currentUser.value.id, note)
    await refreshAll()
  }

  async function adjustStock(productId: string, warehouseId: string, quantity: number, note: string) {
    if (!currentUser.value || !inScopeWarehouse(warehouseId)) throw new Error('Périmètre insuffisant')
    await stockService.adjust(productId, warehouseId, quantity, currentUser.value.id, note)
    await refreshAll()
  }

  async function toggleAssignment(productId: string, warehouseId: string, enabled: boolean) {
    await stockService.toggleAssignment(productId, warehouseId, enabled)
    await refresh(true)
  }

  async function startInventory(warehouseId: string) {
    if (!currentUser.value || !inScopeWarehouse(warehouseId)) throw new Error('Périmètre insuffisant')
    const session = await stockService.startInventory(warehouseId, currentUser.value.id)
    await inventories.refresh(true)
    return session
  }

  async function saveInventory(id: string, lines: { productId: string; counted: number }[]) {
    const session = await stockService.saveInventory(id, lines)
    await inventories.refresh(true)
    return session
  }

  async function submitInventory(id: string) {
    if (!currentUser.value) throw new Error('Non connecté')
    const session = await stockService.submitInventory(id, currentUser.value.id)
    await inventories.refresh(true)
    return session
  }

  async function completeInventory(id: string) {
    if (!currentUser.value) throw new Error('Non connecté')
    await stockService.completeInventory(id, currentUser.value.id)
    await refreshAll()
  }

  async function receiveOrderLines(receiptId: string, lines: { productId: string; received: number }[]) {
    if (!currentUser.value) throw new Error('Non connecté')
    const total = lines.reduce((sum, line) => sum + line.received, 0)
    await receiptService.validate(receiptId, total, currentUser.value.id, lines)
    await refreshAll()
  }

  async function ensureReceipt(orderId: string) {
    const order = orders.data.value.find((item) => item.id === orderId)
    if (!order) throw new Error('Commande introuvable')
    await receiptService.createFromOrder(order)
    await receipts.refresh(true)
    await orders.refresh(true)
    return receipts.data.value.find((item) => item.purchaseOrderId === orderId) ?? null
  }

  function exportMovements(
    list = scopedMovements.value,
    name = 'mouvements-stock',
  ) {
    downloadCsv(
      name,
      ['Date', 'Type', 'Article', 'Quantité', 'De', 'Vers', 'Par', 'Note', 'Référence'],
      list.map((item) => [
        item.date,
        MOVEMENT_LABEL[item.type as StockMovementType] ?? item.type,
        productName(item.productId),
        item.quantity,
        warehouseName(item.fromWarehouseId),
        warehouseName(item.toWarehouseId),
        userName(item.userId),
        item.note,
        item.reference ?? '',
      ]),
    )
  }

  async function closeDay(warehouseId: string) {
    if (!currentUser.value || !inScopeWarehouse(warehouseId)) throw new Error('Périmètre insuffisant')
    await stockService.closeDay(warehouseId, currentUser.value.id)
    store.persist()
  }

  function isClosed(warehouseId: string) {
    const stamp = `${warehouseId}|${DEMO_TODAY}`
    return store.db.auditLogs.some((item) => item.action === 'Clôture de journée' && item.entityId === stamp)
  }

  const loadingAll = computed(
    () => loading.value || products.loading.value || warehouses.loading.value || orders.loading.value,
  )

  return {
    stock: scopedStock,
    overview,
    counts,
    movements: scopedMovements,
    inventories: scopedInventories,
    products: products.data,
    warehouses: scopedWarehouses,
    allWarehouses: warehouses.data,
    orders: orders.data,
    receipts: receipts.data,
    pendingReceipts,
    users: users.data,
    loading: loadingAll,
    error,
    recommendationFor,
    movementsFor,
    requestsFor,
    ordersFor,
    productName,
    warehouseName,
    userName,
    receiveStock,
    issueStock,
    transferStock,
    adjustStock,
    toggleAssignment,
    startInventory,
    saveInventory,
    submitInventory,
    completeInventory,
    receiveOrderLines,
    ensureReceipt,
    exportMovements,
    closeDay,
    isClosed,
    refresh: refreshAll,
  }
}
