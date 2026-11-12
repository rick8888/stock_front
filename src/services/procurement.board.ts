import type { MockDatabase } from '@/types'
import type { ProcurementBoard, ProcurementBoardQuery } from '@/repositories/interfaces'
import { buildRequestOverviews, normalizeStatus } from '@/services/request.overview'
import { buildOrderOverviews } from '@/services/order.overview'
import { buildReceiptOverviews } from '@/services/receipt.overview'
import { isReadyToPurchase } from '@/services/sourcing.service'
import type { RequestOverview } from '@/services/request.overview'
import type { OrderOverview } from '@/services/order.overview'
import type { ReceiptOverview } from '@/services/receipt.overview'

function paginate<T>(
  items: T[],
  page: number,
  pageSize: number,
  focusId: string | undefined,
  idOf: (item: T) => string,
): Pick<ProcurementBoard, 'page' | 'pageSize' | 'total' | 'pages' | 'items' | 'focused'> {
  const total = items.length
  const size = Math.max(1, Math.min(50, pageSize))
  let pages = Math.max(1, Math.ceil(total / size))
  let current = Math.max(1, Math.min(page, pages))
  let focused: T | null = null
  if (focusId) {
    const index = items.findIndex((item) => idOf(item) === focusId)
    if (index >= 0) {
      focused = items[index]!
      current = Math.floor(index / size) + 1
      pages = Math.max(1, Math.ceil(total / size))
    }
  }
  return {
    page: current,
    pageSize: size,
    total,
    pages,
    items: items.slice((current - 1) * size, current * size),
    focused,
  }
}

export function buildProcurementBoard(
  db: MockDatabase,
  query: ProcurementBoardQuery = {},
  options: { warehouseIds?: string[]; userId?: string } = {},
): ProcurementBoard {
  const section = query.section ?? 'requests'
  const page = query.page ?? 1
  const pageSize = query.pageSize ?? 8
  const focusId = query.focusId
  const warehouseIds = options.warehouseIds

  if (section === 'orders') {
    const filter = query.filter ?? 'open'
    let orders = db.purchaseOrders
    if (warehouseIds?.length) orders = orders.filter((item) => warehouseIds.includes(item.warehouseId))
    const rows = buildOrderOverviews({
      orders,
      products: db.products,
      warehouses: db.warehouses,
      suppliers: db.suppliers,
      receipts: db.receipts,
      requests: db.procurementRequests,
    })
    const counts = {
      open: rows.filter((item) => !['received', 'cancelled'].includes(item.order.status)).length,
      delayed: rows.filter((item) => item.late).length,
      received: rows.filter((item) => item.order.status === 'received').length,
      all: rows.length,
    }
    const filtered = rows.filter((item) => {
      if (filter === 'all') return true
      if (filter === 'delayed') return item.late
      if (filter === 'received') return item.order.status === 'received'
      return !['received', 'cancelled'].includes(item.order.status)
    })
    return {
      section: 'orders',
      filter,
      counts,
      formOptions: formOptionsFromDb(db, warehouseIds),
      ...paginate(filtered, page, pageSize, focusId, (item: OrderOverview) => item.order.id),
    }
  }

  if (section === 'receipts') {
    const filter = query.filter ?? 'pending'
    let receipts = db.receipts
    if (warehouseIds?.length) receipts = receipts.filter((item) => warehouseIds.includes(item.warehouseId))
    const rows = buildReceiptOverviews({
      receipts,
      orders: db.purchaseOrders,
      products: db.products,
      warehouses: db.warehouses,
      suppliers: db.suppliers,
      requests: db.procurementRequests,
    })
    const counts = {
      pending: rows.filter((item) => item.receipt.status === 'pending' || item.receipt.status === 'checking').length,
      partial: rows.filter((item) => item.receipt.status === 'partial').length,
      validated: rows.filter((item) => item.receipt.status === 'validated').length,
      all: rows.length,
    }
    const filtered = rows.filter((item) => {
      if (filter === 'all') return true
      if (filter === 'pending') return item.receipt.status === 'pending' || item.receipt.status === 'checking'
      return item.receipt.status === filter
    })
    return {
      section: 'receipts',
      filter,
      counts,
      formOptions: formOptionsFromDb(db, warehouseIds),
      ...paginate(filtered, page, pageSize, focusId, (item: ReceiptOverview) => item.receipt.id),
    }
  }

  if (section === 'suppliers') {
    const filter = query.filter ?? 'all'
    const rows = [...db.suppliers].sort((a, b) => a.name.localeCompare(b.name, 'fr'))
    const counts = {
      all: rows.length,
      active: rows.filter((item) => item.status === 'active').length,
      pending: rows.filter((item) => item.status !== 'active').length,
    }
    const filtered = rows.filter((item) => {
      if (filter === 'active') return item.status === 'active'
      if (filter === 'pending') return item.status !== 'active'
      return true
    })
    return {
      section: 'suppliers',
      filter,
      counts,
      formOptions: formOptionsFromDb(db, warehouseIds),
      ...paginate(filtered, page, pageSize, focusId, (item) => item.id),
    }
  }

  const filter = query.filter ?? 'all'
  let requests = db.procurementRequests
  if (warehouseIds?.length) requests = requests.filter((item) => warehouseIds.includes(item.warehouseId))
  const rows = buildRequestOverviews({
    requests,
    products: db.products.filter((item) => !item.archived),
    warehouses: db.warehouses,
    users: db.users,
    stock: db.stock,
    orders: db.purchaseOrders,
    receipts: db.receipts,
    consultations: db.consultations,
  })
  const counts = {
    all: rows.length,
    submitted: 0,
    in_review: 0,
    approved: 0,
    rejected: 0,
    ordered: 0,
    expired: 0,
  }
  for (const item of rows) {
    const status = normalizeStatus(item.request.status)
    if (status === 'submitted') counts.submitted += 1
    if (status === 'in_review') counts.in_review += 1
    if (status === 'approved') counts.approved += 1
    if (status === 'rejected') counts.rejected += 1
    if (status === 'ordered' || status === 'closed') counts.ordered += 1
    if (status === 'expired') counts.expired += 1
  }
  const filtered = rows.filter((item) => {
    if (filter === 'all') return true
    const status = normalizeStatus(item.request.status)
    if (filter === 'ordered') return status === 'ordered' || status === 'closed'
    if (filter === 'submitted') return status === 'submitted'
    return status === filter
  })
  const readyToPurchase = rows.filter((item) => isReadyToPurchase(item, options.userId))

  return {
    section: 'requests',
    filter,
    counts,
    readyToPurchase,
    formOptions: formOptionsFromDb(db, warehouseIds),
    ...paginate(filtered, page, pageSize, focusId, (item: RequestOverview) => item.request.id),
  }
}

function formOptionsFromDb(db: MockDatabase, warehouseIds?: string[]) {
  const warehouses = db.warehouses
    .filter((item) => item.active !== false)
    .filter((item) => !warehouseIds?.length || warehouseIds.includes(item.id))
    .map((item) => ({ id: item.id, name: item.name }))
  const products = db.products
    .filter((item) => !item.archived)
    .map((item) => ({
      id: item.id,
      name: item.name,
      sku: item.sku,
      unit: item.unit,
      price: item.price ?? 0,
      barcode: item.barcode ?? null,
      supplierId: item.supplierId ?? null,
      archived: false,
    }))
  const suppliers = [...db.suppliers].sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  return { products, warehouses, suppliers }
}
