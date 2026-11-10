import type { Delivery } from '@/types'
import type { DeliveryInput, DeliveryRepository } from '@/repositories/interfaces'
import { uid } from '@/utils/helpers'
import { releaseNoteStock, reserveNoteStock } from '@/utils/stockReserve'
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
      // Ne force pas « done » (réception stock inbound côté API) — seulement le transit.
      if (route.status === 'in_progress' && shipment.status === 'preparing') shipment.status = 'in_transit'
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
      const note = db().shippingNotes.find((item) => item.id === delivery.shippingNoteId)
      if (note && delivery.status !== 'delivered') reserveNoteStock(note)
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
      const previousNoteId = delivery.shippingNoteId
      Object.assign(delivery, assembleDelivery(merged, ctx(), delivery), { id: delivery.id })
      if (previousNoteId && previousNoteId !== delivery.shippingNoteId) {
        const previous = db().shippingNotes.find((item) => item.id === previousNoteId)
        if (previous) releaseNoteStock(previous)
      }
      bindDeliveryNote(delivery, ctx())
      const note = db().shippingNotes.find((item) => item.id === delivery.shippingNoteId)
      if (note && delivery.status !== 'delivered') reserveNoteStock(note)
      afterDelivery(delivery.routeId)
      if (previousRoute !== delivery.routeId) afterDelivery(previousRoute)
      return delivery
    })
  }

  updateStatus(
    id: string,
    status: Delivery['status'],
    note?: string,
    signedBy?: string,
    proof?: import('@/repositories/interfaces').DeliveryProofInput,
  ) {
    return mutate(() => {
      const delivery = db().deliveries.find((item) => item.id === id)
      if (!delivery) throw new Error('Livraison introuvable')
      delivery.status = status
      if (note) delivery.notes = note
      if (status === 'delivered') {
        const hasSignature = Boolean(proof?.signatureDataUrl)
        const hasCoords = proof?.lat != null && proof?.lng != null
        if (!hasSignature && !hasCoords) {
          throw new Error('Preuve de livraison requise : signature ou coordonnées GPS.')
        }
        const now = proof?.signedAt || new Date().toISOString()
        delivery.progress = 100
        delivery.signedAt = now
        delivery.signedBy = signedBy || proof?.signedBy || delivery.signedBy || 'Destinataire'
        if (hasSignature) delivery.signatureDataUrl = proof!.signatureDataUrl
        if (hasCoords) {
          delivery.podLocation = { lat: proof!.lat!, lng: proof!.lng!, at: now }
        }
        const shippingNote = db().shippingNotes.find(
          (item) => item.id === delivery.shippingNoteId || item.deliveryId === delivery.id,
        )
        if (shippingNote) {
          if (!shippingNote.loadedAt && shippingNote.stockReserved) {
            for (const line of shippingNote.lines) {
              const stock = db().stock.find(
                (row) => row.productId === line.productId && row.warehouseId === shippingNote.warehouseId,
              )
              if (stock) {
                stock.reserved = Math.max(0, (stock.reserved ?? 0) - line.quantity)
                stock.quantity = Math.max(0, stock.quantity - line.quantity)
              }
            }
            shippingNote.loadedAt = now
            shippingNote.stockReserved = false
          } else if (!shippingNote.loadedAt && shippingNote.lines.length) {
            throw new Error(`Le bon ${shippingNote.code} doit être chargé avant la preuve de livraison.`)
          }
          shippingNote.status = 'delivered'
        }
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
        const shippingNote = db().shippingNotes.find(
          (item) => item.id === delivery.shippingNoteId || item.deliveryId === delivery.id,
        )
        if (shippingNote && shippingNote.status !== 'delivered') {
          if (shippingNote.loadedAt) {
            for (const line of shippingNote.lines) {
              const stock = db().stock.find(
                (row) => row.productId === line.productId && row.warehouseId === shippingNote.warehouseId,
              )
              if (stock) stock.quantity += line.quantity
              db().stockMovements.unshift({
                id: uid('mov'),
                productId: line.productId,
                type: 'return',
                quantity: line.quantity,
                toWarehouseId: shippingNote.warehouseId,
                userId: delivery.driverId,
                date: now,
                note: `Retour échec ${shippingNote.code}`,
                reference: delivery.id,
              })
            }
            shippingNote.loadedAt = undefined
            shippingNote.stockReserved = false
          } else {
            releaseNoteStock(shippingNote)
          }
          shippingNote.deliveryId = undefined
          shippingNote.status = 'ready'
          delivery.shippingNoteId = undefined
        }
      }
      afterDelivery(delivery.routeId)
      return delivery
    })
  }
}
