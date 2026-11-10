import type {
  ProcurementRequest,
  Product,
  Warehouse,
  User,
  StockItem,
  PurchaseOrder,
  PurchaseStatus,
  Receipt,
  TimelineStep,
  RequestPriority,
  Consultation,
} from '@/types'
import { requestCode } from '@/lib/utils'

export interface RequestLineView {
  productId: string
  productName: string
  sku: string
  unit: string
  quantity: number
  unitPrice: number
  amount: number
  available: number
  inTransit: number
}

export interface RequestOverview {
  request: ProcurementRequest
  code: string
  requesterName: string
  warehouseName: string
  service: string
  priority: RequestPriority
  total: number
  lines: RequestLineView[]
  decision: 'issue' | 'purchase' | 'mixed'
  timeline: TimelineStep[]
  linkedOrder?: PurchaseOrder
  linkedReceipt?: Receipt
  linkedConsultation?: Consultation
  assigneeName?: string
  nextOwner: string
}

export const STATUS_LABEL: Record<string, string> = {
  draft: 'Brouillon',
  submitted: 'Soumise',
  in_review: 'En validation',
  approved: 'Validée',
  rejected: 'Rejetée',
  cancelled: 'Rejetée',
  expired: 'Périmée',
  ordered: 'Commandée',
  closed: 'Clôturée',
  sent: 'Envoyée',
  confirmed: 'Confirmée',
  delayed: 'En retard',
  received: 'Reçue',
  pending: 'À réceptionner',
  checking: 'En contrôle',
  partial: 'Partielle',
  validated: 'Validée',
}

export function orderRequestIds(order: PurchaseOrder): string[] {
  if (order.procurementRequestIds?.length) return order.procurementRequestIds
  return order.procurementRequestId ? [order.procurementRequestId] : []
}

export function orderForRequest(orders: PurchaseOrder[], requestId: string) {
  return orders.find((order) => orderRequestIds(order).includes(requestId))
}

/** Statuts d'une commande dont la marchandise est encore attendue en réception. */
export const OPEN_PURCHASE_STATUSES: PurchaseStatus[] = ['draft', 'sent', 'confirmed', 'partial', 'delayed']

/** Quantité déjà commandée et pas encore réceptionnée pour un article sur un entrepôt. */
export function inTransitFor(orders: PurchaseOrder[], productId: string, warehouseId: string) {
  return orders
    .filter((order) => order.warehouseId === warehouseId && OPEN_PURCHASE_STATUSES.includes(order.status))
    .reduce(
      (sum, order) =>
        sum +
        order.items
          .filter((item) => item.productId === productId)
          .reduce((lineSum, item) => lineSum + item.quantity, 0),
      0,
    )
}

export function normalizeStatus(status: string) {
  return status === 'cancelled' ? 'rejected' : status
}

export function buildRequestOverviews(input: {
  requests: ProcurementRequest[]
  products: Product[]
  warehouses: Warehouse[]
  users: User[]
  stock: StockItem[]
  orders: PurchaseOrder[]
  receipts: Receipt[]
  consultations?: Consultation[]
}): RequestOverview[] {
  return input.requests
    .map((request) => {
      const warehouse = input.warehouses.find((item) => item.id === request.warehouseId)
      const requester = input.users.find((item) => item.id === request.requesterId)
      const lines = request.items.map((line) => {
        const product = input.products.find((item) => item.id === line.productId)
        const stockRow = input.stock.find(
          (item) => item.productId === line.productId && item.warehouseId === request.warehouseId && item.enabled !== false,
        )
        const available = stockRow ? Math.max(0, stockRow.quantity - stockRow.reserved) : 0
        const unitPrice = product?.price ?? 0
        return {
          productId: line.productId,
          productName: product?.name ?? line.productId,
          sku: product?.sku ?? '',
          unit: product?.unit ?? 'unité',
          quantity: line.quantity,
          unitPrice,
          amount: unitPrice * line.quantity,
          available,
          inTransit: inTransitFor(input.orders, line.productId, request.warehouseId),
        }
      })
      const total = lines.reduce((sum, line) => sum + line.amount, 0)
      const short = lines.filter((line) => line.available < line.quantity).length
      const covered = lines.filter((line) => line.available >= line.quantity).length
      const decision: RequestOverview['decision'] =
        short === 0 ? 'issue' : covered === 0 ? 'purchase' : 'mixed'
      const linkedOrder = orderForRequest(input.orders, request.id)
      const linkedReceipt = linkedOrder
        ? input.receipts.find((item) => item.purchaseOrderId === linkedOrder.id)
        : undefined
      const linkedConsultation = (input.consultations ?? []).find(
        (item) =>
          item.procurementRequestIds.includes(request.id) && !['cancelled'].includes(item.status),
      )
      const assignee = input.users.find((item) => item.id === request.assigneeId)
      const assigneeName = assignee ? `${assignee.firstName} ${assignee.lastName}` : undefined
      return {
        request,
        code: requestCode(request.id, request.code),
        requesterName: requester ? `${requester.firstName} ${requester.lastName}` : request.requesterId,
        warehouseName: warehouse?.name ?? request.warehouseId,
        service: request.service ?? warehouse?.name ?? 'Opérations',
        priority: request.priority ?? 'medium',
        total,
        lines,
        decision,
        timeline: buildTimeline(request, linkedOrder, linkedReceipt, decision, assigneeName, linkedConsultation),
        linkedOrder,
        linkedReceipt,
        linkedConsultation,
        assigneeName,
        nextOwner: nextOwnerLabel(request, decision),
      }
    })
    .sort((a, b) => b.request.createdAt.localeCompare(a.request.createdAt))
}

function nextOwnerLabel(request: ProcurementRequest, decision: RequestOverview['decision']) {
  const status = normalizeStatus(request.status)
  if (['rejected', 'closed', 'expired'].includes(status)) return ''
  if (status === 'ordered') return 'Magasin'
  if (request.assignedRole === 'WAREHOUSE_MANAGER') return 'Magasin'
  if (request.assignedRole === 'PROCUREMENT') return 'Achats'
  if (['submitted', 'in_review'].includes(status)) return decision === 'issue' ? 'Magasin' : 'Achats'
  return decision === 'issue' ? 'Magasin' : 'Achats'
}

function buildTimeline(
  request: ProcurementRequest,
  order: PurchaseOrder | undefined,
  receipt: Receipt | undefined,
  decision: RequestOverview['decision'],
  assigneeName?: string,
  consultation?: Consultation,
): TimelineStep[] {
  const status = normalizeStatus(request.status)
  const rejected = status === 'rejected'
  const expired = status === 'expired'
  // Rejet et péremption arrêtent tous deux le parcours : les étapes suivantes
  // n'auront pas lieu.
  const stopped = rejected || expired
  const toStore = request.assignedRole === 'WAREHOUSE_MANAGER' || (decision === 'issue' && !request.assignedRole)
  const pastSubmit = !['draft'].includes(status)
  // La décision se lit aussi à sa date : une demande validée puis périmée a bien
  // été tranchée, même si son statut ne le dit plus.
  const pastReview =
    ['approved', 'ordered', 'closed', 'rejected'].includes(status) || Boolean(request.decidedAt)
  const pastSupply = ['ordered', 'closed'].includes(status)
  const consultState: TimelineStep['state'] = stopped || toStore
    ? 'skipped'
    : consultation?.status === 'awarded'
      ? 'done'
      : order && !consultation
        ? 'skipped'
        : consultation
          ? consultation.status === 'quoted'
            ? 'current'
            : 'current'
          : request.takenAt && !order
            ? 'upcoming'
            : 'upcoming'

  return [
    { id: 'created', label: 'Créée', state: 'done', date: request.createdAt },
    {
      id: 'submitted',
      label: 'Soumise',
      state: pastSubmit ? 'done' : status === 'draft' ? 'upcoming' : 'current',
      date: request.submittedAt,
    },
    {
      id: 'review',
      label: rejected ? 'Rejetée' : expired ? 'Périmée' : 'Validée',
      state: stopped ? 'current' : pastReview ? 'done' : status === 'in_review' ? 'current' : 'upcoming',
      date: request.decidedAt,
      detail: request.decisionNote,
    },
    {
      id: 'stock',
      label: 'Analyse stock',
      state: stopped ? 'skipped' : pastReview ? 'done' : 'upcoming',
    },
    {
      id: 'supply',
      label: toStore ? 'Sortie de stock' : 'Approvisionnement',
      state: stopped ? 'skipped' : pastSupply || request.takenAt ? 'done' : status === 'approved' ? 'current' : 'upcoming',
      date: request.handedOffAt ?? request.takenAt,
      detail: assigneeName
        ? request.takenAt
          ? `${assigneeName} a pris en charge`
          : `Transmise à ${assigneeName}`
        : undefined,
    },
    {
      id: 'consultation',
      label: 'Consultation',
      state: consultState,
      date: consultation?.quotedAt ?? consultation?.sentAt,
      detail: consultation
        ? consultation.status === 'awarded'
          ? consultation.code
          : consultation.status === 'quoted'
            ? 'Devis reçus'
            : 'Envoyée aux fournisseurs'
        : request.takenAt && !order
          ? 'Optionnelle'
          : undefined,
    },
    {
      id: 'order',
      label: 'Commande',
      state: stopped || toStore ? 'skipped' : order ? 'done' : request.takenAt ? 'current' : pastSupply ? 'current' : 'upcoming',
      date: order?.createdAt,
      detail: order
        ? order.code ?? order.id.toUpperCase()
        : consultation?.status === 'quoted'
          ? 'Retenir un devis ou commander'
          : request.takenAt
            ? 'Comparer ou consulter'
            : undefined,
    },
    {
      id: 'receipt',
      label: 'Réception',
      state: stopped || toStore ? 'skipped' : receipt?.status === 'validated' ? 'done' : order ? 'current' : 'upcoming',
      date: receipt?.date,
      detail: receipt ? receipt.code ?? receipt.id.toUpperCase() : order ? 'En attente magasin' : undefined,
    },
  ]
}
