import type { Delivery } from '@/types'
import type { DeliveryInput, DeliveryRepository } from '@/repositories/interfaces'
import { uid } from '@/utils/helpers'
import { db, mutate, withLatency } from './db'
import { assembleDelivery, bindDeliveryNote, refreshRouteTracking, type LogisticsBuildCtx } from '@/services/logistics.build'

function ctx(): LogisticsBuildCtx {
  return {
    routes: db().routes,
    warehouses: db().warehouses,
    products: db().products,
    deliveries: db().deliveries,
    shippingNotes: db().shippingNotes ?? [],
    tasks: db().tasks ?? [],
  }
}

function afterDelivery(routeId: string) {
  const route = db().routes.find((item) => item.id === routeId)
  if (!route) return
  refreshRouteTracking(route, ctx())
  db().shipments
    .filter((item) => item.routeId === routeId)
    .forEach((shipment) => {
      shipment.path = route.path
      shipment.progress = route.progress
      shipment.currentPosition = route.currentPosition
      if (route.status === 'done') shipment.status = 'done'
      else if (route.status === 'in_progress' && shipment.status === 'preparing') shipment.status = 'in_transit'
    })
}

export class MockDeliveryRepository implements DeliveryRepository {
  list() {
    return withLatency(() => db().deliveries)
  }

  create(input: DeliveryInput) {
    return mutate(() => {
      const delivery: Delivery = { id: uid('dlv'), ...assembleDelivery(input, ctx()) }
      db().deliveries.push(delivery)
      bindDeliveryNote(delivery, ctx())
      afterDelivery(delivery.routeId)
      return delivery
    })
  }

  update(id: string, input: Partial<DeliveryInput>) {
    return mutate(() => {
      const delivery = db().deliveries.find((item) => item.id === id)
      if (!delivery) throw new Error('Livraison introuvable')
      const merged: DeliveryInput = {
        shippingNoteId: input.shippingNoteId ?? delivery.shippingNoteId ?? '',
        client: input.client ?? delivery.client,
        address: input.address ?? delivery.address,
        city: input.city ?? delivery.city,
        scheduledAt: input.scheduledAt ?? delivery.scheduledAt,
        routeId: input.routeId ?? delivery.routeId,
        notes: input.notes ?? delivery.notes,
        lines: input.lines ?? delivery.lines.map((line) => ({ productId: line.productId, quantity: line.quantity })),
        sequence: input.sequence ?? delivery.sequence,
        status: input.status ?? delivery.status,
      }
      const previousRoute = delivery.routeId
      Object.assign(delivery, assembleDelivery(merged, ctx(), delivery), { id: delivery.id })
      bindDeliveryNote(delivery, ctx())
      afterDelivery(delivery.routeId)
      if (previousRoute !== delivery.routeId) afterDelivery(previousRoute)
      return delivery
    })
  }

  updateStatus(id: string, status: Delivery['status'], note?: string, signedBy?: string) {
    return mutate(() => {
      const delivery = db().deliveries.find((item) => item.id === id)
      if (!delivery) throw new Error('Livraison introuvable')
      delivery.status = status
      if (note) delivery.notes = note
      if (status === 'delivered') {
        const now = new Date().toISOString()
        delivery.progress = 100
        delivery.signedAt = now
        delivery.signedBy = signedBy || delivery.signedBy || 'Destinataire'
        const note = db().shippingNotes.find((item) => item.id === delivery.shippingNoteId || item.deliveryId === delivery.id)
        if (note) note.status = 'delivered'
        if (delivery.location) {
          delivery.currentPosition = { ...delivery.location, at: now }
        }
        db().notifications.unshift({
          id: uid('ntf'),
          title: 'Livraison effectuée',
          message: `${delivery.client} — ${delivery.city}`,
          createdAt: now,
          read: false,
          type: 'info',
        })
      }
      if (status === 'failed') {
        const now = new Date().toISOString()
        const note = db().shippingNotes.find((item) => item.id === delivery.shippingNoteId || item.deliveryId === delivery.id)
        if (note?.loadedAt && note.status !== 'delivered') {
          for (const line of note.lines) {
            const stock = db().stock.find(
              (row) => row.productId === line.productId && row.warehouseId === note.warehouseId,
            )
            if (stock) stock.quantity += line.quantity
            db().stockMovements.unshift({
              id: uid('mov'),
              productId: line.productId,
              type: 'return',
              quantity: line.quantity,
              toWarehouseId: note.warehouseId,
              userId: delivery.driverId,
              date: now,
              note: `Retour échec ${note.code}`,
              reference: delivery.id,
            })
          }
          note.loadedAt = undefined
        }
      }
      afterDelivery(delivery.routeId)
      return delivery
    })
  }
}
