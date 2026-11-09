import type { PurchaseOrder } from '@/types'
import type { PurchaseRepository } from '@/repositories/interfaces'
import { uid } from '@/utils/helpers'
import { db, mutate, withLatency } from './db'
import { ALERT_ROLES } from '@/config/alerts'

export class MockPurchaseRepository implements PurchaseRepository {
  list() {
    return withLatency(() => db().purchaseOrders)
  }

  create(input: Omit<PurchaseOrder, 'id' | 'createdAt'>) {
    return mutate(() => {
      const seq = 1030 + db().purchaseOrders.length + 1
      const order: PurchaseOrder = {
        id: uid('po'),
        createdAt: new Date().toISOString(),
        ...input,
        code: input.code ?? `OA-2026-${String(seq).padStart(5, '0')}`,
      }
      db().purchaseOrders.unshift(order)
      const supplier = db().suppliers.find((item) => item.id === order.supplierId)
      db().alerts.unshift({
        id: uid('al'),
        title: `${order.code} envoyée`,
        message: (order.procurementRequestIds?.length ?? 1) > 1
          ? `${order.procurementRequestIds?.length} demandes regroupées — transmise à ${supplier?.name ?? 'le fournisseur'}.`
          : `Commande transmise à ${supplier?.name ?? 'le fournisseur'}.`,
        severity: 'info',
        createdAt: order.createdAt,
        read: false,
        domain: 'procurement',
        relatedId: order.id,
        warehouseId: order.warehouseId,
        roles: ALERT_ROLES.purchase,
      })
      db().notifications.unshift({
        id: uid('ntf'),
        title: 'Ordre d’achat créé',
        message: `${order.code} — ${supplier?.name ?? 'fournisseur'}.`,
        createdAt: order.createdAt,
        read: false,
        type: 'info',
      })
      return order
    })
  }

  updateStatus(id: string, status: PurchaseOrder['status']) {
    return mutate(() => {
      const order = db().purchaseOrders.find((item) => item.id === id)
      if (!order) throw new Error('Commande introuvable')
      order.status = status
      return order
    })
  }
}
