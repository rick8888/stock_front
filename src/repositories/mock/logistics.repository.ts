import type { Driver, Route, Shipment, ShippingNote, Vehicle } from '@/types'
import type {
  DriverInput,
  LogisticsRepository,
  RouteInput,
  ShipmentInput,
  ShippingNoteCarrierInput,
  ShippingNoteInput,
  VehicleInput,
} from '@/repositories/interfaces'
import { bookTrackingNumber, getCarrier } from '@/services/carriers.stub'
import { uid, opsToday } from '@/utils/helpers'
import { consumeNoteReservation, releaseNoteStock, reserveNoteStock } from '@/utils/stockReserve'
import { consumeLotsFefo } from '@/utils/stockLots'
import { consumePlacementPath } from '@/utils/placements'
import { db, mutate, withLatency } from './db'
import { ALERT_ROLES } from '@/config/alerts'
import {
  assembleRoute,
  assembleShipment,
  assembleShippingNote,
  bindShipmentNotes,
  refreshRouteTracking,
  relinkRouteDeliveries,
  syncRouteStops,
  type LogisticsBuildCtx,
} from '@/services/logistics.build'

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

function emailFromName(firstName: string, lastName: string) {
  const slug = `${firstName}.${lastName}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '')
  const base = `${slug || 'chauffeur'}@bravo.stock`
  if (!db().users.some((user) => user.email.toLowerCase() === base)) return base
  return `${slug || 'chauffeur'}.${uid('n')}@bravo.stock`
}

function logisticsAssignees(warehouseId: string) {
  const dispatchers = db().users.filter((user) => user.role === 'DISPATCHER')
  const scoped = dispatchers.filter((user) => !user.warehouseIds.length || user.warehouseIds.includes(warehouseId))
  return scoped.length ? scoped : dispatchers
}

function notifyLogisticsOfNote(note: ShippingNote) {
  const warehouse = db().warehouses.find((item) => item.id === note.warehouseId)
  const warehouseName = warehouse?.name ?? 'entrepôt'
  const now = new Date().toISOString()
  const dueAt = `${opsToday()}T17:00:00.000Z`
  db().alerts.unshift({
    id: uid('al'),
    title: `${note.code} prêt à expédier`,
    message: `${note.client} — ${note.city}. Bon préparé à ${warehouseName}.`,
    severity: 'info',
    createdAt: now,
    read: false,
    domain: 'logistics',
    relatedId: note.id,
    warehouseId: note.warehouseId,
    roles: ALERT_ROLES.shippingNote,
  })
  logisticsAssignees(note.warehouseId).forEach((user) => {
    const taskId = uid('tsk')
    db().tasks.unshift({
      id: taskId,
      title: `Affecter ${note.code}`,
      description: `${note.client} — ${note.city}. Bon prêt à ${warehouseName}, à placer sur une tournée ou une expédition.`,
      assigneeId: user.id,
      dueAt,
      status: 'todo',
      priority: 'medium',
      relatedType: 'shipping_note',
      relatedId: note.id,
    })
    db().planning.unshift({
      id: uid('pl'),
      title: `Affecter ${note.code}`,
      date: dueAt,
      type: 'task',
      relatedId: taskId,
    })
    db().notifications.unshift({
      id: uid('ntf'),
      title: 'Bon de livraison prêt',
      message: `${note.code} · ${note.client} (${warehouseName})`,
      createdAt: now,
      read: false,
      type: 'info',
      userId: user.id,
    })
  })
}

function assignVehicle(driverId: string | undefined, vehicleId: string | undefined) {
  if (vehicleId) {
    db().drivers.forEach((driver) => {
      if (driver.vehicleId === vehicleId && driver.id !== driverId) driver.vehicleId = undefined
    })
  }
  if (!driverId) return
  const driver = db().drivers.find((item) => item.id === driverId)
  if (!driver) return
  driver.vehicleId = vehicleId || undefined
}

export class MockLogisticsRepository implements LogisticsRepository {
  shipments() {
    return withLatency(() => db().shipments)
  }

  routes() {
    return withLatency(() => db().routes)
  }

  vehicles() {
    return withLatency(() => db().vehicles)
  }

  drivers() {
    return withLatency(() => db().drivers)
  }

  shippingNotes() {
    return withLatency(() => db().shippingNotes ?? [])
  }

  createShippingNote(input: ShippingNoteInput) {
    return mutate(() => {
      const note: ShippingNote = { id: uid('bl'), ...assembleShippingNote(input, ctx()) }
      db().shippingNotes.unshift(note)
      notifyLogisticsOfNote(note)
      db().auditLogs.unshift({
        id: uid('aud'),
        userId: input.createdByUserId ?? '',
        action: 'Bon de livraison préparé',
        entity: 'shipping_note',
        entityId: note.id,
        createdAt: note.createdAt ?? new Date().toISOString(),
      })
      return note
    })
  }

  updateShippingNote(id: string, input: Partial<ShippingNoteInput>) {
    return mutate(() => {
      const note = db().shippingNotes.find((item) => item.id === id)
      if (!note) throw new Error('Bon de livraison introuvable')
      if (note.status !== 'ready' && note.status !== 'picking') {
        throw new Error('Ce bon est déjà affecté')
      }
      const merged: ShippingNoteInput = {
        warehouseId: input.warehouseId ?? note.warehouseId,
        customerId: input.customerId ?? note.customerId,
        addressId: input.addressId ?? note.addressId,
        client: input.client ?? note.client,
        address: input.address ?? note.address,
        city: input.city ?? note.city,
        notes: input.notes ?? note.notes,
        carrierId: input.carrierId ?? note.carrierId,
        trackingNumber: input.trackingNumber ?? note.trackingNumber,
        createdByUserId: note.createdByUserId,
        lines: input.lines ?? note.lines.map((line) => ({ productId: line.productId, quantity: line.quantity })),
      }
      Object.assign(note, assembleShippingNote(merged, ctx(), note), { id: note.id })
      return note
    })
  }

  assignCarrier(id: string, input: ShippingNoteCarrierInput) {
    return mutate(() => {
      const note = db().shippingNotes.find((item) => item.id === id)
      if (!note) throw new Error('Bon de livraison introuvable')
      const carrier = getCarrier(input.carrierId)
      if (!carrier || carrier.active === false) throw new Error('Transporteur introuvable')
      note.carrierId = carrier.id
      note.carrierName = carrier.name
      if (input.trackingNumber?.trim()) {
        note.trackingNumber = input.trackingNumber.trim()
      } else if (input.book !== false && !note.trackingNumber) {
        note.trackingNumber = bookTrackingNumber(carrier, note.code)
        note.bookedAt = new Date().toISOString()
      } else if (input.book) {
        note.trackingNumber = bookTrackingNumber(carrier, note.code)
        note.bookedAt = new Date().toISOString()
      }
      db().auditLogs.unshift({
        id: uid('aud'),
        userId: '',
        action: 'Transporteur affecté',
        entity: 'shipping_note',
        entityId: note.id,
        createdAt: new Date().toISOString(),
      })
      return note
    })
  }

  markLabelPrinted(id: string) {
    return mutate(() => {
      const note = db().shippingNotes.find((item) => item.id === id)
      if (!note) throw new Error('Bon de livraison introuvable')
      note.labelPrintedAt = new Date().toISOString()
      return note
    })
  }

  startPicking(id: string) {
    return mutate(() => {
      const note = db().shippingNotes.find((item) => item.id === id)
      if (!note) throw new Error('Bon de livraison introuvable')
      if (note.status !== 'ready' && note.status !== 'picking') {
        throw new Error('Seuls les bons disponibles peuvent entrer en préparation.')
      }
      note.status = 'picking'
      return note
    })
  }

  updateVehicle(id: string, input: Partial<VehicleInput>) {
    return mutate(() => {
      const vehicle = db().vehicles.find((item) => item.id === id)
      if (!vehicle) throw new Error('Véhicule introuvable')
      if (input.name) vehicle.name = input.name.trim()
      if (input.plate) vehicle.plate = input.plate.trim().toUpperCase()
      if (input.warehouseId) vehicle.warehouseId = input.warehouseId
      if (input.status) vehicle.status = input.status
      if ('driverId' in input) assignVehicle(input.driverId || undefined, vehicle.id)
      return vehicle
    })
  }

  createVehicle(input: VehicleInput) {
    return mutate(() => {
      const vehicle: Vehicle = {
        id: uid('veh'),
        name: input.name.trim(),
        plate: input.plate.trim().toUpperCase(),
        warehouseId: input.warehouseId,
        status: input.status ?? 'available',
      }
      db().vehicles.push(vehicle)
      if (input.driverId) assignVehicle(input.driverId, vehicle.id)
      return vehicle
    })
  }

  createDriver(input: DriverInput) {
    return mutate(() => {
      const driverId = uid('drv')
      const warehouseId = input.warehouseId ?? db().warehouses[0]?.id ?? 'wh-casa'
      const user = {
        id: uid('usr'),
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        email: input.email?.trim() || emailFromName(input.firstName, input.lastName),
        password: 'demo',
        role: 'DRIVER' as const,
        title: 'Chauffeur',
        avatarHue: 10 + (db().users.length % 40),
        warehouseIds: warehouseId ? [warehouseId] : [],
        productIds: [],
        regionIds: [],
        driverId,
      }
      const driver: Driver = {
        id: driverId,
        userId: user.id,
        phone: input.phone.trim(),
        status: input.status ?? 'available',
        vehicleId: input.vehicleId || undefined,
      }
      db().users.push(user)
      db().drivers.push(driver)
      if (input.vehicleId) assignVehicle(driver.id, input.vehicleId)
      return driver
    })
  }

  updateDriver(id: string, input: Partial<DriverInput>) {
    return mutate(() => {
      const driver = db().drivers.find((item) => item.id === id)
      if (!driver) throw new Error('Chauffeur introuvable')
      const user = db().users.find((item) => item.id === driver.userId)
      if (input.firstName && user) user.firstName = input.firstName.trim()
      if (input.lastName && user) user.lastName = input.lastName.trim()
      if (input.email && user) user.email = input.email.trim()
      if (input.warehouseId && user) user.warehouseIds = [input.warehouseId]
      if (input.phone) driver.phone = input.phone.trim()
      if (input.status) driver.status = input.status
      if ('vehicleId' in input) assignVehicle(driver.id, input.vehicleId || undefined)
      return driver
    })
  }

  createRoute(input: RouteInput) {
    return mutate(() => {
      const route: Route = { id: uid('rt'), ...assembleRoute(input, ctx()) }
      db().routes.push(route)
      if (input.stops) {
        syncRouteStops(route, input.stops, ctx())
        refreshRouteTracking(route, ctx())
      }
      return route
    })
  }

  updateRoute(id: string, input: Partial<RouteInput>) {
    return mutate(() => {
      const route = db().routes.find((item) => item.id === id)
      if (!route) throw new Error('Tournée introuvable')
      const merged: RouteInput = {
        name: input.name ?? route.name,
        date: input.date ?? route.date,
        driverId: input.driverId ?? route.driverId,
        vehicleId: input.vehicleId ?? route.vehicleId,
        warehouseId: input.warehouseId ?? route.warehouseId,
        status: input.status ?? route.status,
        stops: input.stops,
      }
      Object.assign(route, assembleRoute(merged, ctx(), route), { id: route.id })
      relinkRouteDeliveries(route, ctx())
      if (input.stops) syncRouteStops(route, input.stops, ctx())
      refreshRouteTracking(route, ctx())
      return route
    })
  }

  createShipment(input: ShipmentInput) {
    return mutate(() => {
      const shipment: Shipment = { id: uid('shp'), ...assembleShipment(input, ctx()) }
      db().shipments.push(shipment)
      bindShipmentNotes(shipment, ctx())
      syncShipmentReservations(shipment)
      return shipment
    })
  }

  updateShipment(id: string, input: Partial<ShipmentInput>) {
    return mutate(() => {
      const shipment = db().shipments.find((item) => item.id === id)
      if (!shipment) throw new Error('Expédition introuvable')
      const previousStatus = shipment.status
      const merged: ShipmentInput = {
        originWarehouseId: input.originWarehouseId ?? shipment.originWarehouseId,
        destinationWarehouseId: input.destinationWarehouseId ?? shipment.destinationWarehouseId,
        destination: input.destination ?? shipment.destination,
        vehicleId: input.vehicleId ?? shipment.vehicleId,
        driverId: input.driverId ?? shipment.driverId,
        routeId: input.routeId ?? shipment.routeId,
        date: input.date ?? shipment.date,
        eta: input.eta ?? shipment.eta,
        notes: input.notes ?? shipment.notes,
        shippingNoteIds: input.shippingNoteIds ?? shipment.shippingNoteIds ?? [],
        lines: input.lines ?? shipment.lines.map((line) => ({ productId: line.productId, quantity: line.quantity })),
        status: input.status ?? shipment.status,
      }
      Object.assign(shipment, assembleShipment(merged, ctx(), shipment), { id: shipment.id })
      if (shipment.status === 'done' && previousStatus !== 'done' && shipment.destinationWarehouseId) {
        receiveTransferShipment(shipment)
      }
      bindShipmentNotes(shipment, ctx())
      syncShipmentReservations(shipment)
      return shipment
    })
  }

  loadShippingNote(id: string, userId: string) {
    return mutate(() => {
      const note = db().shippingNotes.find((item) => item.id === id)
      if (!note) throw new Error('Bon introuvable')
      if (note.loadedAt) throw new Error('Ce bon est déjà chargé.')
      if (!['ready', 'picking', 'loaded', 'assigned'].includes(note.status)) {
        throw new Error('Ce bon ne peut plus être chargé.')
      }
      const now = new Date().toISOString()
      const shipment = note.shipmentId ? db().shipments.find((item) => item.id === note.shipmentId) : undefined
      const destinationWarehouseId = shipment?.destinationWarehouseId
      consumeNoteReservation(note)
      for (const line of note.lines) {
        const product = db().products.find((item) => item.id === line.productId)
        if (product?.trackLots) {
          consumeLotsFefo(line.productId, note.warehouseId, line.quantity)
        }
        consumePlacementPath(line.productId, note.warehouseId, line.quantity)
        db().stockMovements.unshift({
          id: uid('mov'),
          productId: line.productId,
          type: destinationWarehouseId ? 'transfer' : 'issue',
          quantity: line.quantity,
          fromWarehouseId: note.warehouseId,
          toWarehouseId: destinationWarehouseId,
          userId,
          date: now,
          note: destinationWarehouseId ? `Chargement transfert ${note.code}` : `Chargement ${note.code}`,
          reference: note.code,
        })
      }
      note.loadedAt = now
      note.loadedByUserId = userId
      if (['ready', 'picking', 'loaded'].includes(note.status) && !note.deliveryId && !note.shipmentId) {
        note.status = 'loaded'
      }
      if (destinationWarehouseId) {
        note.inTransitToWarehouseId = destinationWarehouseId
      }
      db().auditLogs.unshift({
        id: uid('aud'),
        userId,
        action: 'Bon chargé',
        entity: 'shipping_note',
        entityId: note.id,
        createdAt: now,
      })
      return note
    })
  }
}

function syncShipmentReservations(shipment: Shipment) {
  const bound = new Set(shipment.shippingNoteIds ?? [])
  for (const note of db().shippingNotes) {
    if (!bound.has(note.id) && note.stockReserved && !note.deliveryId && !note.loadedAt) {
      releaseNoteStock(note)
    }
  }
  if (shipment.status === 'done') return
  for (const noteId of bound) {
    const note = db().shippingNotes.find((item) => item.id === noteId)
    if (note) reserveNoteStock(note)
  }
}

function receiveTransferShipment(shipment: Shipment) {
  if (!shipment.destinationWarehouseId || (shipment as { stockReceivedAt?: string }).stockReceivedAt) return
  const now = new Date().toISOString()
  for (const noteId of shipment.shippingNoteIds ?? []) {
    const note = db().shippingNotes.find((item) => item.id === noteId)
    if (!note?.loadedAt || (note as { stockReceivedAt?: string }).stockReceivedAt) continue
    for (const line of note.lines) {
      let stock = db().stock.find(
        (row) => row.productId === line.productId && row.warehouseId === shipment.destinationWarehouseId,
      )
      if (!stock) {
        stock = {
          id: uid('stk'),
          productId: line.productId,
          warehouseId: shipment.destinationWarehouseId!,
          quantity: 0,
          reserved: 0,
          enabled: true,
        }
        db().stock.push(stock)
      }
      stock.quantity += line.quantity
      db().stockMovements.unshift({
        id: uid('mov'),
        productId: line.productId,
        type: 'receive',
        quantity: line.quantity,
        fromWarehouseId: note.warehouseId,
        toWarehouseId: shipment.destinationWarehouseId,
        userId: note.loadedByUserId ?? '',
        date: now,
        note: `Réception transfert ${note.code}`,
        reference: note.code,
      })
    }
    ;(note as { stockReceivedAt?: string }).stockReceivedAt = now
    note.status = 'delivered'
  }
  ;(shipment as { stockReceivedAt?: string }).stockReceivedAt = now
  shipment.progress = 100
}
