import { computed, onMounted, ref } from 'vue'
import { procurementService } from '@/services/procurement.service'
import { purchaseService } from '@/services/purchase.service'
import { receiptService } from '@/services/receipt.service'
import { consultationService } from '@/services/consultation.service'
import { supplierService } from '@/services/supplier.service'
import { isReadyToPurchase } from '@/services/sourcing.service'
import { emitDataChanged } from '@/utils/events'
import { useAsyncList } from './useAsyncList'
import { useCurrentUser } from './useAuth'
import type { ProcurementBoard, ProcurementBoardQuery, SupplierInput } from '@/repositories/interfaces'
import type { RequestOverview } from '@/services/request.overview'
import type { OrderOverview } from '@/services/order.overview'
import type { ReceiptOverview } from '@/services/receipt.overview'
import type { SourcingOffer } from '@/services/sourcing.service'
import type { ProcurementItem, Product, QuoteFile, RequestPriority, Supplier, Warehouse } from '@/types'

const PAGE_SIZE = 8

export function useProcurement(options: { autoload?: boolean } = {}) {
  const { currentUser } = useCurrentUser()

  const board = ref<ProcurementBoard | null>(null)
  const loading = ref(options.autoload !== false)
  const error = ref<string | null>(null)
  const sourcingOffers = ref<SourcingOffer[]>([])
  const sourcingLoading = ref(false)
  const lastQuery = ref<ProcurementBoardQuery>({
    section: 'requests',
    filter: 'all',
    page: 1,
    pageSize: PAGE_SIZE,
  })

  let boardRequestId = 0

  async function loadBoard(query: ProcurementBoardQuery = {}, silent = true) {
    const requestId = ++boardRequestId
    lastQuery.value = {
      section: query.section ?? lastQuery.value.section ?? 'requests',
      filter: query.filter ?? lastQuery.value.filter ?? 'all',
      page: query.page ?? lastQuery.value.page ?? 1,
      pageSize: query.pageSize ?? lastQuery.value.pageSize ?? PAGE_SIZE,
      focusId: query.focusId,
    }
    if (!silent) loading.value = true
    error.value = null
    try {
      const next = await procurementService.board(lastQuery.value)
      // Ignore une réponse périmée si un autre loadBoard a démarré entre-temps
      // (ex. deep-link OA → BR pendant le chargement initial commandes).
      if (requestId !== boardRequestId) return
      board.value = next
      if (board.value.page !== lastQuery.value.page) {
        lastQuery.value.page = board.value.page
      }
    } catch (err) {
      if (requestId !== boardRequestId) return
      error.value = err instanceof Error ? err.message : 'Une erreur est survenue'
    } finally {
      if (requestId === boardRequestId) loading.value = false
    }
  }

  if (options.autoload !== false) {
    onMounted(() => {
      void loadBoard(lastQuery.value, false)
    })
  }

  const overviews = computed(() =>
    board.value?.section === 'requests' ? ((board.value.items as RequestOverview[]) ?? []) : [],
  )
  const orderOverviews = computed(() =>
    board.value?.section === 'orders' ? ((board.value.items as OrderOverview[]) ?? []) : [],
  )
  const receiptOverviews = computed(() =>
    board.value?.section === 'receipts' ? ((board.value.items as ReceiptOverview[]) ?? []) : [],
  )
  const supplierRows = computed(() =>
    board.value?.section === 'suppliers' ? ((board.value.items as Supplier[]) ?? []) : [],
  )
  const counts = computed(() => board.value?.counts ?? {})
  const readyToPurchase = computed(
    () => (board.value?.readyToPurchase as RequestOverview[] | undefined) ?? [],
  )
  const formOptions = computed(() => board.value?.formOptions)
  const products = computed(
    () => (formOptions.value?.products as Product[] | undefined) ?? [],
  )
  const warehouses = computed(
    () => (formOptions.value?.warehouses as Warehouse[] | undefined) ?? [],
  )
  const suppliers = computed(() => formOptions.value?.suppliers ?? [])
  const page = computed(() => board.value?.page ?? 1)
  const pages = computed(() => board.value?.pages ?? 1)
  const total = computed(() => board.value?.total ?? 0)
  const pageSize = computed(() => board.value?.pageSize ?? PAGE_SIZE)

  async function refreshAll() {
    await loadBoard(lastQuery.value, true)
    emitDataChanged()
  }

  async function loadSourcing(requestIds: string | string[]) {
    const ids = [...new Set(Array.isArray(requestIds) ? requestIds : [requestIds])].filter(Boolean)
    if (!ids.length) {
      sourcingOffers.value = []
      return []
    }
    sourcingLoading.value = true
    try {
      const result = await procurementService.sourcing(ids)
      sourcingOffers.value = result.offers
      return result.offers
    } catch (err) {
      sourcingOffers.value = []
      throw err
    } finally {
      sourcingLoading.value = false
    }
  }

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
    await refreshAll()
  }

  async function approveRequest(id: string) {
    await procurementService.approve(id)
    await refreshAll()
  }

  async function takeCharge(id: string) {
    await procurementService.takeCharge(id)
    await refreshAll()
  }

  async function issueFromRequest(id: string) {
    if (!currentUser.value) throw new Error('Non connecté')
    await procurementService.issueFromRequest(id, currentUser.value.id)
    await refreshAll()
  }

  async function createOrderFromOffer(requestIds: string | string[], supplierId: string) {
    await purchaseService.createFromOffer(requestIds, supplierId)
    await refreshAll()
  }

  async function launchConsultation(requestIds: string[], supplierIds: string[], note?: string) {
    await consultationService.launch(requestIds, supplierIds, note)
    await refreshAll()
  }

  async function awardQuote(consultationId: string, quoteId: string) {
    await consultationService.award(consultationId, quoteId)
    await refreshAll()
  }

  async function cancelConsultation(id: string) {
    await consultationService.cancel(id)
    await refreshAll()
  }

  async function attachQuoteFile(consultationId: string, quoteId: string, file: QuoteFile) {
    await consultationService.attachFile(consultationId, quoteId, file)
    await refreshAll()
  }

  async function validateReceipt(
    id: string,
    lines: { productId: string; received: number; lotCode?: string; expiryDate?: string; locationId?: string }[],
  ) {
    if (!currentUser.value) throw new Error('Non connecté')
    const received = lines.reduce((sum, line) => sum + line.received, 0)
    await receiptService.validate(id, received, currentUser.value.id, lines)
    await refreshAll()
  }

  async function confirmOrder(id: string) {
    await purchaseService.updateStatus(id, 'confirmed')
    await refreshAll()
  }

  async function ensureOrderReceipt(orderId: string) {
    const fromBoard = orderOverviews.value.find((item) => item.order.id === orderId)?.order
    const order = fromBoard ?? (await purchaseService.list()).find((item) => item.id === orderId)
    if (!order) throw new Error('Commande introuvable')
    await receiptService.createFromOrder(order)
    await refreshAll()
  }

  function groupableWith(requestId: string) {
    const current =
      overviews.value.find((item) => item.request.id === requestId) ??
      readyToPurchase.value.find((item) => item.request.id === requestId)
    if (!current || !isReadyToPurchase(current, currentUser.value?.id)) return []
    return readyToPurchase.value.filter(
      (item) =>
        item.request.id !== requestId && item.request.warehouseId === current.request.warehouseId,
    )
  }

  async function rejectRequest(id: string) {
    await procurementService.reject(id)
    await refreshAll()
  }

  async function requestChanges(id: string) {
    await procurementService.requestChanges(id)
    await refreshAll()
  }

  async function createSupplier(input: SupplierInput) {
    await supplierService.create(input)
    await refreshAll()
  }

  async function updateSupplier(id: string, input: Partial<SupplierInput>) {
    await supplierService.update(id, input)
    await refreshAll()
  }

  return {
    board,
    overviews,
    orderOverviews,
    receiptOverviews,
    supplierRows,
    counts,
    readyToPurchase,
    page,
    pages,
    total,
    pageSize,
    products,
    warehouses,
    suppliers,
    sourcingOffers,
    sourcingLoading,
    loading: computed(() => loading.value),
    error,
    loadBoard,
    loadSourcing,
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
    groupableWith,
    isReadyToPurchase: (overview: RequestOverview) => isReadyToPurchase(overview, currentUser.value?.id),
    rejectRequest,
    requestChanges,
    createSupplier,
    updateSupplier,
    refresh: () => loadBoard(lastQuery.value, true),
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

  async function validateReceipt(
    id: string,
    received: number,
    lines?: { productId: string; received: number; lotCode?: string; expiryDate?: string; locationId?: string }[],
  ) {
    if (!currentUser.value) throw new Error('Non connecté')
    await receiptService.validate(id, received, currentUser.value.id, lines)
  }

  return {
    receipts: list.data,
    loading: list.loading,
    error: list.error,
    validateReceipt,
    refresh: list.refresh,
  }
}
