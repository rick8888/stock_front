import type { Receipt } from '@/types'
import type { ReceiptRepository } from '@/repositories/interfaces'
import { uid } from '@/utils/helpers'
import { db, mutate, withLatency } from './db'
import { ALERT_ROLES } from '@/config/alerts'
import { receiveLot } from '@/utils/stockLots'
import { putawayPlacement } from '@/utils/placements'

export class MockReceiptRepository implements ReceiptRepository {
  list() {
    return withLatency(() => db().receipts)
  }

  create(input: Omit<Receipt, 'id'>) {
    return mutate(() => {
      const seq = 10 + db().receipts.length + 1
      const now = new Date().toISOString()
      const receipt: Receipt = {
        ...input,
        id: uid('rcp'),
        code: input.code ?? `BR-2026-${String(seq).padStart(5, '0')}`,
        date: input.date ?? now,
      }
      db().receipts.unshift(receipt)
      const order = db().purchaseOrders.find((item) => item.id === receipt.purchaseOrderId)
      db().alerts.unshift({
        id: uid('al'),
        title: `${receipt.code} à réceptionner`,
        message: `Arrivage prévu pour ${order?.code ?? receipt.purchaseOrderId.toUpperCase()}.`,
        severity: 'warning',
        createdAt: now,
        read: false,
        domain: 'stock',
        relatedId: receipt.id,
        warehouseId: receipt.warehouseId,
        roles: ALERT_ROLES.receipt,
      })
      db().notifications.unshift({
        id: uid('ntf'),
        title: 'Réception à faire',
        message: `${receipt.code} — contrôler puis valider l’arrivage.`,
        createdAt: now,
        read: false,
        type: 'warning',
      })
      return receipt
    })
  }

  validate(
    id: string,
    received: number,
    userId: string,
    lines?: { productId: string; received: number; lotCode?: string; expiryDate?: string; locationId?: string }[],
  ) {
    return mutate(() => {
      const receipt = db().receipts.find((item) => item.id === id)
      if (!receipt) throw new Error('Réception introuvable')
      const order = db().purchaseOrders.find((item) => item.id === receipt.purchaseOrderId)
      const previous = new Map((receipt.items ?? []).map((line) => [line.productId, line.received]))
      const nextItems = (order?.items ?? receipt.items ?? []).map((item) => {
        const productId = 'productId' in item ? item.productId : ''
        const expected = 'expected' in item ? item.expected : item.quantity
        const incoming = lines?.find((line) => line.productId === productId)
        const receivedQty = incoming?.received ?? expected
        return {
          productId,
          expected,
          received: receivedQty,
          lotCode: incoming?.lotCode,
          expiryDate: incoming?.expiryDate,
          locationId: incoming?.locationId,
        }
      })
      if (lines?.length && !nextItems.length) {
        nextItems.push(
          ...lines.map((line) => ({
            productId: line.productId,
            expected: line.received,
            received: line.received,
            lotCode: line.lotCode,
            expiryDate: line.expiryDate,
            locationId: line.locationId,
          })),
        )
      }
      receipt.items = nextItems
      receipt.received = nextItems.reduce((sum, line) => sum + line.received, 0) || received
      receipt.expected = nextItems.reduce((sum, line) => sum + line.expected, 0) || receipt.expected
      receipt.status = receipt.received >= receipt.expected && receipt.expected > 0 ? 'validated' : 'partial'
      receipt.userId = userId
      receipt.checkedAt = new Date().toISOString()
      receipt.date = receipt.checkedAt
      if (order) {
        order.status = receipt.status === 'validated' ? 'received' : 'partial'
        if (receipt.status === 'validated') {
          const requestIds = order.procurementRequestIds?.length
            ? order.procurementRequestIds
            : order.procurementRequestId
              ? [order.procurementRequestId]
              : []
          db().procurementRequests.forEach((request) => {
            if (requestIds.includes(request.id)) request.status = 'closed'
          })
        }
      }
      for (const line of nextItems) {
        const delta = line.received - (previous.get(line.productId) ?? 0)
        if (delta <= 0) continue
        const stock = db().stock.find(
          (row) => row.productId === line.productId && row.warehouseId === receipt.warehouseId,
        )
        if (stock) stock.quantity += delta
        const product = db().products.find((item) => item.id === line.productId)
        let lotId: string | undefined
        if (line.lotCode || line.expiryDate || product?.trackLots) {
          lotId = receiveLot(
            line.productId,
            receipt.warehouseId,
            delta,
            line.lotCode,
            line.expiryDate,
            line.locationId,
          ).id
        }
        putawayPlacement(line.productId, receipt.warehouseId, delta, line.locationId, lotId)
        db().stockMovements.unshift({
          id: uid('mov'),
          productId: line.productId,
          type: 'receive',
          quantity: delta,
          toWarehouseId: receipt.warehouseId,
          userId,
          date: new Date().toISOString(),
          note: `Réception ${receipt.code ?? receipt.id}`,
          reference: receipt.code ?? receipt.id,
        })
      }
      db().alerts.unshift({
        id: uid('al'),
        title: receipt.status === 'validated' ? `${receipt.code} validé` : `${receipt.code} partiel`,
        message:
          receipt.status === 'validated'
            ? 'Stock mis à jour, demande clôturée.'
            : 'Écart constaté — le reste reste attendu.',
        severity: receipt.status === 'validated' ? 'info' : 'warning',
        createdAt: new Date().toISOString(),
        read: false,
        domain: 'stock',
        relatedId: receipt.id,
        warehouseId: receipt.warehouseId,
        roles: ALERT_ROLES.receiptDone,
      })
      return receipt
    })
  }
}
