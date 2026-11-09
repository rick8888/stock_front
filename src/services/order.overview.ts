import type { Product, PurchaseOrder, Receipt, Supplier, Warehouse, ProcurementRequest, TimelineStep } from '@/types'
import { orderCode, receiptCode, requestCode, formatDate } from '@/lib/utils'
import { todayIso } from '@/utils/helpers'
import { orderRequestIds } from './request.overview'

export interface OrderLineView {
  productId: string
  productName: string
  sku: string
  unit: string
  quantity: number
  unitPrice: number
  amount: number
}

export interface LinkedRequestView {
  id: string
  code: string
  note: string
}

export interface OrderOverview {
  order: PurchaseOrder
  code: string
  supplierName: string
  supplierPhone?: string
  warehouseName: string
  lines: OrderLineView[]
  requests: LinkedRequestView[]
  linkedReceipt?: Receipt
  receiptCode?: string
  late: boolean
  nextAction: string
  timeline: TimelineStep[]
}

export const ORDER_LABEL: Record<string, string> = {
  draft: 'Brouillon',
  sent: 'Envoyée',
  confirmed: 'Confirmée',
  partial: 'Partielle',
  received: 'Reçue',
  delayed: 'En retard',
  cancelled: 'Annulée',
}

export function isOrderLate(order: PurchaseOrder, today = todayIso()) {
  if (['received', 'cancelled'].includes(order.status)) return false
  if (order.status === 'delayed') return true
  return ['sent', 'confirmed', 'partial', 'draft'].includes(order.status) && order.expectedDate < today
}

export function orderEtaLabel(order: PurchaseOrder, late: boolean) {
  if (order.status === 'received') return 'Reçue'
  if (order.status === 'cancelled') return 'Annulée'
  const today = todayIso()
  const diff = Math.round(
    (Date.parse(`${order.expectedDate}T00:00:00`) - Date.parse(`${today}T00:00:00`)) / 86_400_000,
  )
  if (late || diff < 0) return `Retard ${Math.abs(diff)} j`
  if (diff === 0) return 'Aujourd’hui'
  return `Dans ${diff} j`
}

export function buildOrderOverviews(input: {
  orders: PurchaseOrder[]
  products: Product[]
  warehouses: Warehouse[]
  suppliers: Supplier[]
  receipts: Receipt[]
  requests: ProcurementRequest[]
}): OrderOverview[] {
  return input.orders
    .map((order) => {
      const warehouse = input.warehouses.find((item) => item.id === order.warehouseId)
      const supplier = input.suppliers.find((item) => item.id === order.supplierId)
      const linkedIds = orderRequestIds(order)
      const requests = input.requests
        .filter((item) => linkedIds.includes(item.id))
        .map((item) => ({
          id: item.id,
          code: requestCode(item.id, item.code),
          note: item.note,
        }))
      const linkedReceipt = input.receipts.find((item) => item.purchaseOrderId === order.id)
      const lines = order.items.map((line) => {
        const product = input.products.find((item) => item.id === line.productId)
        const unitPrice = product?.price ?? 0
        return {
          productId: line.productId,
          productName: product?.name ?? line.productId,
          sku: product?.sku ?? '',
          unit: product?.unit ?? 'unité',
          quantity: line.quantity,
          unitPrice,
          amount: unitPrice * line.quantity,
        }
      })
      const late = isOrderLate(order)
      return {
        order,
        code: orderCode(order.id, order.code),
        supplierName: supplier?.name ?? order.supplierId,
        supplierPhone: supplier?.phone,
        warehouseName: warehouse?.name ?? order.warehouseId,
        lines,
        requests,
        linkedReceipt,
        receiptCode: linkedReceipt ? receiptCode(linkedReceipt.id, linkedReceipt.code) : undefined,
        late,
        nextAction: nextActionLabel(order, late, linkedReceipt),
        timeline: buildTimeline(order, linkedReceipt, late),
      }
    })
    .sort((a, b) => {
      if (a.late !== b.late) return a.late ? -1 : 1
      const rank: Record<string, number> = {
        delayed: 0,
        sent: 1,
        confirmed: 2,
        partial: 3,
        draft: 4,
        received: 5,
        cancelled: 6,
      }
      const diff = (rank[a.order.status] ?? 9) - (rank[b.order.status] ?? 9)
      if (diff) return diff
      return a.order.expectedDate.localeCompare(b.order.expectedDate)
    })
}

function nextActionLabel(order: PurchaseOrder, late: boolean, receipt?: Receipt) {
  if (order.status === 'cancelled') return 'Annulée'
  if (order.status === 'received') return 'Clôturée'
  if (receipt && receipt.status !== 'validated') return 'À réceptionner'
  if (late) return 'Livraison en retard'
  if (order.status === 'sent') return 'En attente confirmation'
  if (order.status === 'partial') return 'Réception partielle'
  return 'En transit'
}

function buildTimeline(order: PurchaseOrder, receipt: Receipt | undefined, late: boolean): TimelineStep[] {
  const closed = order.status === 'received' || receipt?.status === 'validated'
  const cancelled = order.status === 'cancelled'
  const sent = order.status !== 'draft'
  const confirmed = ['confirmed', 'partial', 'received', 'delayed'].includes(order.status) || closed
  return [
    { id: 'created', label: 'Créée', state: 'done', date: order.createdAt },
    {
      id: 'sent',
      label: 'Envoyée au fournisseur',
      state: cancelled ? 'skipped' : sent ? 'done' : 'current',
      date: sent ? order.createdAt : undefined,
    },
    {
      id: 'confirmed',
      label: late && !closed ? 'En retard' : 'Confirmée',
      state: cancelled ? 'skipped' : confirmed ? 'done' : sent ? 'current' : 'upcoming',
      detail: late && !closed ? `Attendu le ${formatDate(order.expectedDate)}` : undefined,
    },
    {
      id: 'receipt',
      label: 'Réception',
      state: cancelled ? 'skipped' : closed ? 'done' : receipt ? 'current' : 'upcoming',
      date: receipt?.checkedAt ?? receipt?.date,
      detail: receipt ? receiptCode(receipt.id, receipt.code) : undefined,
    },
  ]
}
