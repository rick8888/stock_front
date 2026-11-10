import type { Product, PurchaseOrder, Receipt, ReceiptLine, Supplier, Warehouse, ProcurementRequest } from '@/types'
import { orderCode, receiptCode, requestCode } from '@/lib/utils'
import { orderRequestIds } from './request.overview'

export interface ReceiptLineView extends ReceiptLine {
  productName: string
  sku: string
  unit: string
  barcode?: string
  trackLots?: boolean
}

export interface ReceiptOverview {
  receipt: Receipt
  code: string
  orderCode: string
  requestCode?: string
  warehouseName: string
  supplierName: string
  supplierPhone?: string
  expectedDate: string
  lines: ReceiptLineView[]
  variance: number
}

export const RECEIPT_LABEL: Record<string, string> = {
  pending: 'À réceptionner',
  checking: 'En contrôle',
  partial: 'Écart',
  validated: 'Validée',
}

export function buildReceiptOverviews(input: {
  receipts: Receipt[]
  orders: PurchaseOrder[]
  products: Product[]
  warehouses: Warehouse[]
  suppliers: Supplier[]
  requests: ProcurementRequest[]
}): ReceiptOverview[] {
  return input.receipts
    .map((receipt) => {
      const order = input.orders.find((item) => item.id === receipt.purchaseOrderId)
      const warehouse = input.warehouses.find((item) => item.id === receipt.warehouseId)
      const supplier = input.suppliers.find((item) => item.id === order?.supplierId)
      const linkedIds = order ? orderRequestIds(order) : []
      const linkedRequests = input.requests.filter((item) => linkedIds.includes(item.id))
      const sourceLines: ReceiptLine[] = receipt.items?.length
        ? receipt.items
        : (order?.items ?? []).map((item) => ({
            productId: item.productId,
            expected: item.quantity,
            received:
              receipt.status === 'validated'
                ? item.quantity
                : order?.items.length === 1
                  ? receipt.received
                  : 0,
          }))
      const lines = sourceLines.map((line) => {
        const product = input.products.find((item) => item.id === line.productId)
        return {
          productId: line.productId,
          productName: product?.name ?? line.productId,
          sku: product?.sku ?? '',
          unit: product?.unit ?? 'unité',
          expected: line.expected,
          received: line.received,
          barcode: product?.barcode,
          trackLots: product?.trackLots,
          lotCode: line.lotCode,
          expiryDate: line.expiryDate,
          locationId: line.locationId,
        }
      })
      const expected = lines.reduce((sum, line) => sum + line.expected, 0) || receipt.expected
      const received = lines.reduce((sum, line) => sum + line.received, 0) || receipt.received
      return {
        receipt,
        code: receiptCode(receipt.id, receipt.code),
        orderCode: order ? orderCode(order.id, order.code) : receipt.purchaseOrderId.toUpperCase(),
        requestCode: linkedRequests.length
          ? linkedRequests.map((item) => requestCode(item.id, item.code)).join(' · ')
          : undefined,
        warehouseName: warehouse?.name ?? receipt.warehouseId,
        supplierName: supplier?.name ?? 'Fournisseur',
        supplierPhone: supplier?.phone,
        expectedDate: order?.expectedDate ?? receipt.date,
        lines,
        variance: received - expected,
      }
    })
    .sort((a, b) => {
      const rank: Record<string, number> = { pending: 0, checking: 1, partial: 2, validated: 3 }
      const diff = (rank[a.receipt.status] ?? 9) - (rank[b.receipt.status] ?? 9)
      if (diff) return diff
      return b.receipt.date.localeCompare(a.receipt.date)
    })
}
