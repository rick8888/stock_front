import { computed } from 'vue'
import { procurementService } from '@/services/procurement.service'
import { purchaseService } from '@/services/purchase.service'
import { receiptService } from '@/services/receipt.service'
import { productService } from '@/services/product.service'
import { warehouseService } from '@/services/warehouse.service'
import { stockService } from '@/services/stock.service'
import { userRepository } from '@/repositories'
import { supplierService } from '@/services/supplier.service'
import { buildRequestOverviews } from '@/services/request.overview'
import { buildSourcingOffersFor, isReadyToPurchase } from '@/services/sourcing.service'
import { buildReceiptOverviews } from '@/services/receipt.overview'
import { buildOrderOverviews } from '@/services/order.overview'
import { consultationService } from '@/services/consultation.service'
import { useAsyncList } from './useAsyncList'
import { useCurrentUser } from './useAuth'
import { usePermissions } from './usePermissions'
import type { ProcurementItem, QuoteFile, RequestPriority } from '@/types'

export function useProcurement() {
  const { currentUser } = useCurrentUser()
  const { scopedWarehouseIds } = usePermissions()
  const list = useAsyncList(() => procurementService.list())
  const products = useAsyncList(() => productService.list())
  const warehouses = useAsyncList(() => warehouseService.list())
  const users = useAsyncList(() => userRepository.list())
  const stock = useAsyncList(() => stockService.list())
  const orders = useAsyncList(() => purchaseService.list())
  const receipts = useAsyncList(() => receiptService.list())
  const suppliers = useAsyncList(() => supplierService.list())
  const consultations = useAsyncList(() => consultationService.list())

  const overviews = computed(() =>
    buildRequestOverviews({
      requests: list.data.value,
      products: products.data.value,
      warehouses: warehouses.data.value,
      users: users.data.value,
      stock: stock.data.value,
      orders: orders.data.value,
      receipts: receipts.data.value,
      consultations: consultations.data.value,
    }),
  )

  const orderOverviews = computed(() => {
    const ids = scopedWarehouseIds()
    const scoped = ids ? orders.data.value.filter((item) => ids.includes(item.warehouseId)) : orders.data.value
    return buildOrderOverviews({
      orders: scoped,
      products: products.data.value,
      warehouses: warehouses.data.value,
      suppliers: suppliers.data.value,
      receipts: receipts.data.value,
      requests: list.data.value,
    })
  })

  const receiptOverviews = computed(() => {
    const ids = scopedWarehouseIds()
    const scoped = ids ? receipts.data.value.filter((item) => ids.includes(item.warehouseId)) : receipts.data.value
    return buildReceiptOverviews({
      receipts: scoped,
      orders: orders.data.value,
      products: products.data.value,
      warehouses: warehouses.data.value,
      suppliers: suppliers.data.value,
      requests: list.data.value,
    })
  })

  const counts = computed(() => {
    const tally = {
      all: overviews.value.length,
      submitted: 0,
      in_review: 0,
      approved: 0,
      rejected: 0,
      ordered: 0,
    }
    overviews.value.forEach((item) => {
      const status = item.request.status === 'cancelled' ? 'rejected' : item.request.status
      if (status === 'submitted') tally.submitted += 1
      if (status === 'in_review') tally.in_review += 1
      if (status === 'approved') tally.approved += 1
      if (status === 'rejected') tally.rejected += 1
      if (status === 'ordered' || status === 'closed') tally.ordered += 1
    })
    return tally
  })

  async function createRequest(
    warehouseId: string,
    items: ProcurementItem[],
    note: string,
    extras?: { priority?: RequestPriority; service?: string; status?: 'draft' | 'submitted' },
  ) {
    if (!currentUser.value) throw new Error('Non connecté')
    await procurementService.create({
      requesterId: currentUser.value.id,
      warehouseId,
      items,
      note,
      priority: extras?.priority,
      service: extras?.service ?? currentUser.value.title,
      status: extras?.status ?? 'submitted',
    })
    await list.refresh(true)
  }

  async function approveRequest(id: string) {
    await procurementService.approve(id)
    await list.refresh(true)
  }

  async function takeCharge(id: string) {
    await procurementService.takeCharge(id)
    await list.refresh(true)
  }

  async function issueFromRequest(id: string) {
    if (!currentUser.value) throw new Error('Non connecté')
    await procurementService.issueFromRequest(id, currentUser.value.id)
    await list.refresh(true)
    await stock.refresh(true)
  }

  async function refreshAll() {
    await Promise.all([
      list.refresh(true),
      orders.refresh(true),
      receipts.refresh(true),
      stock.refresh(true),
      consultations.refresh(true),
    ])
  }

  async function createOrderFromOffer(requestIds: string | string[], supplierId: string) {
    await purchaseService.createFromOffer(requestIds, supplierId)
    await refreshAll()
  }

  async function launchConsultation(requestIds: string[], supplierIds: string[], note?: string) {
    await consultationService.launch(requestIds, supplierIds, note)
    await consultations.refresh(true)
    await list.refresh(true)
  }

  async function awardQuote(consultationId: string, quoteId: string) {
    await consultationService.award(consultationId, quoteId)
    await refreshAll()
  }

  async function cancelConsultation(id: string) {
    await consultationService.cancel(id)
    await consultations.refresh(true)
    await list.refresh(true)
  }

  async function attachQuoteFile(consultationId: string, quoteId: string, file: QuoteFile) {
    await consultationService.attachFile(consultationId, quoteId, file)
    await consultations.refresh(true)
    await list.refresh(true)
  }

  async function validateReceipt(id: string, lines: { productId: string; received: number }[]) {
    if (!currentUser.value) throw new Error('Non connecté')
    const received = lines.reduce((sum, line) => sum + line.received, 0)
    await receiptService.validate(id, received, currentUser.value.id, lines)
    await refreshAll()
  }

  async function confirmOrder(id: string) {
    await purchaseService.updateStatus(id, 'confirmed')
    await orders.refresh(true)
  }

  async function ensureOrderReceipt(orderId: string) {
    const order = orders.data.value.find((item) => item.id === orderId)
    if (!order) throw new Error('Commande introuvable')
    await receiptService.createFromOrder(order)
    await refreshAll()
  }

  function sourcingFor(requestIds: string | string[]) {
    const ids = Array.isArray(requestIds) ? requestIds : [requestIds]
    const selected = ids
      .map((id) => overviews.value.find((item) => item.request.id === id))
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
    return buildSourcingOffersFor(selected, products.data.value, suppliers.data.value)
  }

  function groupableWith(requestId: string) {
    const current = overviews.value.find((item) => item.request.id === requestId)
    if (!current || !isReadyToPurchase(current, currentUser.value?.id)) return []
    return overviews.value.filter(
      (item) =>
        item.request.id !== requestId &&
        item.request.warehouseId === current.request.warehouseId &&
        isReadyToPurchase(item, currentUser.value?.id),
    )
  }

  async function rejectRequest(id: string) {
    await procurementService.reject(id)
    await list.refresh(true)
  }

  async function requestChanges(id: string) {
    await procurementService.requestChanges(id)
    await list.refresh(true)
  }

  const loading = computed(() => list.loading.value || products.loading.value || orders.loading.value)

  return {
    requests: list.data,
    overviews,
    orderOverviews,
    receiptOverviews,
    orders: orders.data,
    counts,
    loading,
    error: list.error,
    createRequest,
    approveRequest,
    takeCharge,
    issueFromRequest,
    createOrderFromOffer,
    launchConsultation,
    awardQuote,
    cancelConsultation,
    attachQuoteFile,
    confirmOrder,
    ensureOrderReceipt,
    validateReceipt,
    sourcingFor,
    groupableWith,
    isReadyToPurchase: (overview: Parameters<typeof isReadyToPurchase>[0]) =>
      isReadyToPurchase(overview, currentUser.value?.id),
    rejectRequest,
    requestChanges,
    refresh: list.refresh,
  }
}

export function usePurchaseOrders() {
  const list = useAsyncList(() => purchaseService.list())
  return {
    orders: list.data,
    loading: list.loading,
    error: list.error,
    refresh: list.refresh,
    createOrder: purchaseService.create,
    updateStatus: purchaseService.updateStatus,
  }
}

export function useReceipts() {
  const { currentUser } = useCurrentUser()
  const list = useAsyncList(() => receiptService.list())

  async function validateReceipt(id: string, received: number, lines?: { productId: string; received: number }[]) {
    if (!currentUser.value) throw new Error('Non connecté')
    await receiptService.validate(id, received, currentUser.value.id, lines)
    await list.refresh(true)
  }

  return {
    receipts: list.data,
    loading: list.loading,
    error: list.error,
    validateReceipt,
    refresh: list.refresh,
  }
}
