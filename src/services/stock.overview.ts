import type {
  MockDatabase,
  ProcurementRequest,
  Product,
  PurchaseOrder,
  StockHealth,
  StockItem,
  StockOverviewRow,
  StockRecommendation,
  Supplier,
  Warehouse,
} from '@/types'
import type { StockOverviewBoard } from '@/repositories/interfaces'
import { opsToday } from '@/utils/helpers'

const OPEN_ORDERS = new Set(['draft', 'sent', 'confirmed', 'partial', 'delayed'])
const OPEN_REQUESTS = new Set(['submitted', 'approved'])

function lightImageUrl(product?: Product): string | undefined {
  const candidates = [product?.imageUrl, ...(product?.images ?? [])].filter(
    (value): value is string => typeof value === 'string' && value.length > 0,
  )
  return candidates.find((url) => !url.startsWith('data:') && url.length <= 500)
}

function health(available: number, minStock: number, days: number, onOrder: boolean): StockHealth {
  if (available < minStock * 0.5 || days <= 3) return 'critical'
  if (available < minStock || days <= 7) return 'watch'
  if (onOrder) return 'on_order'
  return 'normal'
}

function recommend(row: StockOverviewRow, requests: ProcurementRequest[]): StockRecommendation {
  const daily = row.weeklyDemand / 7
  const pendingNeed = requests
    .filter(
      (request) =>
        request.warehouseId === row.warehouseId &&
        OPEN_REQUESTS.has(request.status) &&
        request.items.some((item) => item.productId === row.productId),
    )
    .reduce(
      (sum, request) =>
        sum + request.items.filter((item) => item.productId === row.productId).reduce((qty, item) => qty + item.quantity, 0),
      0,
    )

  const coverNeed = Math.ceil(daily * row.leadTimeDays)
  const target = row.minStock + coverNeed + pendingNeed
  const quantity = Math.max(0, target - row.available - row.inTransit)
  const reasons: string[] = []
  if (row.available < row.minStock) reasons.push(`Stock disponible insuffisant (${row.available} / seuil ${row.minStock})`)
  if (pendingNeed) reasons.push(`Demande validée ou soumise : ${pendingNeed} ${row.unit}s`)
  if (daily) reasons.push(`Consommation moyenne : ${row.weeklyDemand} / semaine`)
  reasons.push(`Délai fournisseur : ${row.leadTimeDays} jours`)
  reasons.push(`Stock de sécurité : ${row.minStock} ${row.unit}s`)
  if (row.inTransit) reasons.push(`Déjà en commande : ${row.inTransit} ${row.unit}s`)

  return {
    quantity,
    risk: row.status === 'critical' ? 'high' : row.status === 'watch' ? 'medium' : 'low',
    reasons,
  }
}

export function buildStockRows(input: {
  stock: StockItem[]
  products: Product[]
  warehouses: Warehouse[]
  orders: PurchaseOrder[]
  suppliers: Supplier[]
  requests?: ProcurementRequest[]
}): StockOverviewRow[] {
  const requests = input.requests ?? []
  return input.stock
    .filter((row) => row.enabled !== false)
    .map((row) => {
      const product = input.products.find((item) => item.id === row.productId)
      const warehouse = input.warehouses.find((item) => item.id === row.warehouseId)
      const supplier = input.suppliers.find((item) => item.id === product?.supplierId)
      const inTransit = input.orders
        .filter((order) => OPEN_ORDERS.has(order.status) && order.warehouseId === row.warehouseId)
        .reduce(
          (sum, order) =>
            sum + order.items.filter((item) => item.productId === row.productId).reduce((qty, item) => qty + item.quantity, 0),
          0,
        )
      const physical = row.quantity
      const reserved = row.reserved
      const available = Math.max(0, physical - reserved)
      const daily = product?.dailyDemand || 0
      const days = daily > 0 ? Math.round((available / daily) * 10) / 10 : 99
      const minStock = product?.minStock ?? 0
      const onOrder = inTransit > 0
      const imageUrl = lightImageUrl(product)
      const overview: StockOverviewRow = {
        id: row.id,
        productId: row.productId,
        warehouseId: row.warehouseId,
        productName: product?.name ?? row.productId,
        sku: product?.sku ?? '',
        unit: product?.unit ?? 'unité',
        categoryId: product?.categoryId ?? '',
        warehouseName: warehouse?.name ?? row.warehouseId,
        physical,
        reserved,
        available,
        inTransit,
        minStock,
        maxStock: product?.maxStock ?? minStock * 4,
        days,
        weeklyDemand: Math.round(daily * 7),
        leadTimeDays: supplier?.leadTimeDays ?? 5,
        supplierId: product?.supplierId ?? '',
        supplierName: supplier?.name ?? '',
        status: health(available, minStock, days, onOrder),
        flags: { onOrder },
        imageUrl,
        images: imageUrl ? [imageUrl] : [],
        description: undefined,
        barcode: product?.barcode,
      }
      overview.recommendation = recommend(overview, requests)
      return overview
    })
    .sort((a, b) => {
      const rank = { critical: 0, watch: 1, on_order: 2, normal: 3 }
      if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status]
      return a.days - b.days
    })
}

export function buildStockOverviewBoard(db: MockDatabase, warehouseIds?: string[]): StockOverviewBoard {
  const stock = warehouseIds?.length
    ? db.stock.filter((row) => warehouseIds.includes(row.warehouseId))
    : db.stock
  const rows = buildStockRows({
    stock,
    products: db.products.filter((item) => !item.archived),
    warehouses: db.warehouses,
    orders: db.purchaseOrders,
    suppliers: db.suppliers,
    requests: db.procurementRequests,
  })
  const counts = {
    all: rows.length,
    critical: 0,
    watch: 0,
    on_order: 0,
    normal: 0,
  }
  for (const row of rows) counts[row.status] += 1

  const today = opsToday()
  const closedWarehouseIds = db.auditLogs
    .filter((item) => item.action === 'Clôture de journée' && item.entityId.endsWith(`|${today}`))
    .map((item) => item.entityId.split('|')[0]!)

  return { rows, counts, closedWarehouseIds, today }
}
