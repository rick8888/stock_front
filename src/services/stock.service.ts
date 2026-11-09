import { stockRepository } from '@/repositories'
import { productService } from './product.service'
import { warehouseRepository } from '@/repositories'
import type {
  Product,
  Warehouse,
  StockItem,
  PurchaseOrder,
  Supplier,
  ProcurementRequest,
  StockOverviewRow,
  StockRecommendation,
  StockHealth,
} from '@/types'

const OPEN_ORDERS = new Set(['draft', 'sent', 'confirmed', 'partial', 'delayed'])

function health(available: number, minStock: number, days: number, onOrder: boolean): StockHealth {
  if (available < minStock * 0.5 || days <= 3) return 'critical'
  if (available < minStock || days <= 7) return 'watch'
  if (onOrder) return 'on_order'
  return 'normal'
}

export function buildStockRows(input: {
  stock: StockItem[]
  products: Product[]
  warehouses: Warehouse[]
  orders: PurchaseOrder[]
  suppliers: Supplier[]
}): StockOverviewRow[] {
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
      return {
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
        imageUrl: product?.images?.[0] ?? product?.imageUrl,
        images: product?.images ?? (product?.imageUrl ? [product.imageUrl] : []),
        description: product?.description,
        barcode: product?.barcode,
      }
    })
    .sort((a, b) => {
      const rank = { critical: 0, watch: 1, on_order: 2, normal: 3 }
      if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status]
      return a.days - b.days
    })
}

export function recommendStock(row: StockOverviewRow, requests: ProcurementRequest[] = []): StockRecommendation {
  const daily = row.weeklyDemand / 7
  const pendingNeed = requests
    .filter(
      (request) =>
        request.warehouseId === row.warehouseId &&
        ['submitted', 'approved'].includes(request.status) &&
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

export const stockService = {
  list: () => stockRepository.list(),
  movements: () => stockRepository.movements(),
  inventories: () => stockRepository.inventories(),
  receive: stockRepository.receive.bind(stockRepository),
  issue: stockRepository.issue.bind(stockRepository),
  transfer: stockRepository.transfer.bind(stockRepository),
  adjust: stockRepository.adjust.bind(stockRepository),
  returnStock: stockRepository.returnStock.bind(stockRepository),
  toggleAssignment: stockRepository.toggleAssignment.bind(stockRepository),
  startInventory: stockRepository.startInventory.bind(stockRepository),
  saveInventory: stockRepository.saveInventory.bind(stockRepository),
  submitInventory: stockRepository.submitInventory.bind(stockRepository),
  completeInventory: stockRepository.completeInventory.bind(stockRepository),
  closeDay: stockRepository.closeDay.bind(stockRepository),

  async coverageDays(productId: string, warehouseId?: string) {
    const [products, stock] = await Promise.all([productService.list(), stockRepository.list()])
    const product = products.find((item) => item.id === productId)
    if (!product || product.dailyDemand <= 0) return Infinity
    const qty = stock
      .filter((row) => row.productId === productId && (!warehouseId || row.warehouseId === warehouseId))
      .reduce((sum, row) => sum + row.quantity - row.reserved, 0)
    return qty / product.dailyDemand
  },

  async risks(warehouseIds?: string[]) {
    const [products, stock, warehouses] = await Promise.all([
      productService.list(),
      stockRepository.list(),
      warehouseRepository.list(),
    ])
    return products
      .map((product) => {
        const rows = stock.filter(
          (row) =>
            row.enabled !== false &&
            row.productId === product.id &&
            (!warehouseIds?.length || warehouseIds.includes(row.warehouseId)),
        )
        return rows.map((row) => {
          const available = row.quantity - row.reserved
          const days = product.dailyDemand > 0 ? available / product.dailyDemand : 99
          const warehouse = warehouses.find((item) => item.id === row.warehouseId)
          return {
            product,
            warehouse,
            available,
            days: Math.round(days * 10) / 10,
            belowMin: available < product.minStock,
          }
        })
      })
      .flat()
      .filter((item) => item.days <= 7 || item.belowMin)
      .sort((a, b) => a.days - b.days)
  },
}
