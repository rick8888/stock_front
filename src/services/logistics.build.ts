import type { DeliveryInput, RouteInput, RouteStopInput, ShipmentInput, ShippingNoteInput } from '@/repositories/interfaces'
import type {
  Delivery,
  DeliveryNoteLine,
  GeoPoint,
  Product,
  Route,
  Shipment,
  ShippingNote,
  Task,
  Warehouse,
} from '@/types'
import { getCarrier } from '@/services/carriers.stub'
import { haversineKm, locationFor, pointAlong } from '@/utils/geo'
import { uid } from '@/utils/helpers'

/** Waypoints bruts (pas de courbe) — le routage routier est calculé dans TrackingMap. */
function waypointPath(points: GeoPoint[]): GeoPoint[] {
  return points.filter(Boolean)
}

export interface LogisticsBuildCtx {
  routes: Route[]
  warehouses: Warehouse[]
  products: Product[]
  deliveries: Delivery[]
  shippingNotes: ShippingNote[]
  tasks: Task[]
}

function warehousePoint(warehouse?: Warehouse): GeoPoint {
  if (warehouse?.lat != null && warehouse.lng != null) {
    return { lat: warehouse.lat, lng: warehouse.lng, label: `Entrepôt ${warehouse.name}` }
  }
  return { lat: 33.5731, lng: -7.5898, label: warehouse?.name ?? 'Entrepôt' }
}

function progressFor(status: Delivery['status']) {
  if (status === 'delivered') return 100
  if (status === 'in_transit') return 62
  if (status === 'at_risk') return 38
  if (status === 'failed') return 55
  return 0
}

function noteLines(products: Product[], lines: { productId: string; quantity: number }[]): DeliveryNoteLine[] {
  const result: DeliveryNoteLine[] = []
  for (const line of lines) {
    const product = products.find((item) => item.id === line.productId)
    if (!product || line.quantity <= 0) continue
    result.push({
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      quantity: line.quantity,
      unit: product.unit,
    })
  }
  return result
}

function pathDistance(path: GeoPoint[]) {
  let km = 0
  for (let i = 0; i < path.length - 1; i++) km += haversineKm(path[i], path[i + 1])
  return Math.max(1, Math.round(km))
}

export function completeShippingNoteTasks(noteIds: string[], ctx: LogisticsBuildCtx) {
  const ids = new Set(noteIds.filter(Boolean))
  ctx.tasks.forEach((task) => {
    if (task.relatedType === 'shipping_note' && task.relatedId && ids.has(task.relatedId) && task.status !== 'done') {
      task.status = 'done'
    }
  })
}

export function nextShippingNoteCode(notes: ShippingNote[]) {
  const numbers = notes.map((note) => Number(note.code.slice(-5))).filter((value) => Number.isFinite(value) && value > 0)
  const next = Math.max(900, ...numbers, 0) + 1
  return `BL-2026-${String(next).padStart(5, '0')}`
}

export function assembleShippingNote(
  input: ShippingNoteInput,
  ctx: LogisticsBuildCtx,
  existing?: ShippingNote,
): Omit<ShippingNote, 'id'> {
  const warehouse = ctx.warehouses.find((item) => item.id === input.warehouseId)
  if (!warehouse) throw new Error('Entrepôt introuvable')
  const client = input.client.trim()
  const address = input.address.trim()
  const city = (input.city.trim() || warehouse.city).trim()
  if (client.length < 2 || address.length < 2 || !city) throw new Error('Client et adresse sont requis')
  const lines = noteLines(ctx.products, input.lines)
  if (!lines.length) throw new Error('Ajoutez au moins un article')
  const carrierId = input.carrierId !== undefined ? input.carrierId || undefined : existing?.carrierId
  const carrier = getCarrier(carrierId)
  const trackingNumber =
    input.trackingNumber !== undefined
      ? input.trackingNumber.trim() || undefined
      : existing?.trackingNumber
  return {
    code: existing?.code ?? nextShippingNoteCode(ctx.shippingNotes),
    warehouseId: warehouse.id,
    customerId: input.customerId || existing?.customerId,
    addressId: input.addressId || existing?.addressId,
    client,
    address,
    city,
    lines,
    status: existing?.status ?? 'ready',
    deliveryId: existing?.deliveryId,
    shipmentId: existing?.shipmentId,
    notes: input.notes?.trim() || existing?.notes,
    carrierId,
    carrierName: carrier?.name,
    trackingNumber,
    labelPrintedAt: existing?.labelPrintedAt,
    bookedAt: existing?.bookedAt,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    createdByUserId: existing?.createdByUserId ?? input.createdByUserId,
  }
}

function resolveNote(id: string | undefined, ctx: LogisticsBuildCtx) {
  if (!id) return undefined
  return ctx.shippingNotes.find((item) => item.id === id)
}

function aggregateNoteLines(notes: ShippingNote[]): DeliveryNoteLine[] {
  const aggregated = new Map<string, DeliveryNoteLine>()
  notes.forEach((note) => {
    note.lines.forEach((line) => {
      const current = aggregated.get(line.productId)
      if (current) current.quantity += line.quantity
      else aggregated.set(line.productId, { ...line })
    })
  })
  return [...aggregated.values()]
}

export function bindDeliveryNote(delivery: Delivery, ctx: LogisticsBuildCtx) {
  ctx.shippingNotes.forEach((note) => {
    if (note.deliveryId === delivery.id && note.id !== delivery.shippingNoteId) {
      note.deliveryId = undefined
      if (note.status === 'assigned' && !note.shipmentId) note.status = 'ready'
    }
  })
  const note = resolveNote(delivery.shippingNoteId, ctx)
  if (!note) return
  note.deliveryId = delivery.id
  note.status = delivery.status === 'delivered' ? 'delivered' : 'assigned'
  completeShippingNoteTasks([note.id], ctx)
}

export function releaseDeliveryNote(delivery: Delivery, ctx: LogisticsBuildCtx) {
  ctx.shippingNotes.forEach((note) => {
    if (note.deliveryId !== delivery.id && note.id !== delivery.shippingNoteId) return
    note.deliveryId = undefined
    if (note.status !== 'delivered' && !note.shipmentId) note.status = 'ready'
  })
}

export function bindShipmentNotes(shipment: Shipment, ctx: LogisticsBuildCtx) {
  const ids = new Set(shipment.shippingNoteIds ?? [])
  ctx.shippingNotes.forEach((note) => {
    if (note.shipmentId === shipment.id && !ids.has(note.id)) {
      note.shipmentId = undefined
      if (note.status === 'assigned' && !note.deliveryId) note.status = 'ready'
    }
  })
  ids.forEach((id) => {
    const note = resolveNote(id, ctx)
    if (!note) return
    note.shipmentId = shipment.id
    if (shipment.status === 'done') {
      if (!note.deliveryId) note.status = 'delivered'
      return
    }
    if (note.status === 'ready') note.status = 'assigned'
  })
  completeShippingNoteTasks([...ids], ctx)
}

export function assembleDelivery(
  input: DeliveryInput,
  ctx: LogisticsBuildCtx,
  existing?: Delivery,
): Omit<Delivery, 'id'> {
  const route = ctx.routes.find((item) => item.id === input.routeId)
  if (!route) throw new Error('Tournée introuvable')
  const noteId = input.shippingNoteId || existing?.shippingNoteId
  const note = resolveNote(noteId, ctx)
  if (noteId && !note) throw new Error('Bon de livraison introuvable')
  if (note?.deliveryId && note.deliveryId !== existing?.id) {
    throw new Error('Ce bon de livraison est déjà affecté à un autre point')
  }
  const client = (note?.client ?? input.client ?? '').trim()
  const address = (note?.address ?? input.address ?? '').trim()
  const city = (note?.city ?? input.city ?? '').trim()
  if (!client || !address || !city) throw new Error('Bon de livraison requis')
  const warehouse = ctx.warehouses.find((item) => item.id === route.warehouseId)
  const origin = warehousePoint(warehouse)
  const status = input.status ?? existing?.status ?? 'prepared'
  const samePlace =
    existing && existing.address === address && existing.city === city && existing.client === client
  // Coords fournies (adresse client) > position déjà connue > approximation ville.
  const location = input.lat != null && input.lng != null
    ? { lat: input.lat, lng: input.lng, label: client }
    : samePlace
      ? existing.location
      : locationFor(city, address, client, origin)
  const siblings = ctx.deliveries.filter((item) => item.routeId === input.routeId && item.id !== existing?.id)
  const sequence = input.sequence ?? existing?.sequence ?? Math.max(0, ...siblings.map((item) => item.sequence)) + 1
  const path = waypointPath([origin, location])
  const progress = existing && status === existing.status ? existing.progress : progressFor(status)
  const currentPosition = pointAlong(path, progress / 100)
  return {
    client,
    address,
    city,
    scheduledAt: input.scheduledAt,
    status,
    driverId: route.driverId,
    vehicleId: route.vehicleId,
    routeId: route.id,
    sequence,
    notes: input.notes?.trim() || note?.notes || undefined,
    warehouseId: route.warehouseId,
    location,
    path,
    currentPosition,
    progress,
    lines: note ? note.lines.map((line) => ({ ...line })) : noteLines(ctx.products, input.lines ?? []),
    signedAt: status === 'delivered' ? existing?.signedAt ?? new Date().toISOString() : undefined,
    signedBy: status === 'delivered' ? existing?.signedBy ?? 'Réception magasin' : undefined,
    eta: input.scheduledAt,
    shippingNoteId: note?.id,
    code: note?.code,
  }
}

export function assembleRoute(input: RouteInput, ctx: LogisticsBuildCtx, existing?: Route): Omit<Route, 'id'> {
  const warehouse = ctx.warehouses.find((item) => item.id === input.warehouseId)
  const origin = warehousePoint(warehouse)
  const stops = ctx.deliveries
    .filter((item) => item.routeId === existing?.id)
    .sort((a, b) => a.sequence - b.sequence)
  const path = stops.length ? waypointPath([origin, ...stops.map((item) => item.location)]) : [origin]
  const delivered = stops.filter((item) => item.status === 'delivered').length
  const active = stops.find((item) => item.status === 'in_transit' || item.status === 'at_risk')
  let status = input.status ?? existing?.status ?? 'planned'
  if (stops.length && delivered === stops.length) status = 'done'
  else if (active || delivered) status = status === 'planned' ? 'in_progress' : status
  const progress = stops.length
    ? Math.round(
        (((active?.sequence ?? delivered) - (active ? 1 - active.progress / 100 : 0)) / stops.length) * 100,
      )
    : 0
  return {
    name: input.name.trim(),
    date: input.date,
    driverId: input.driverId,
    vehicleId: input.vehicleId,
    warehouseId: input.warehouseId,
    status,
    distanceKm: pathDistance(path),
    path,
    currentPosition: active?.currentPosition ?? (path.length ? pointAlong(path, Math.min(1, Math.max(0, progress / 100))) : origin),
    progress: Math.min(100, Math.max(0, progress)),
  }
}

export function assembleShipment(
  input: ShipmentInput,
  ctx: LogisticsBuildCtx,
  existing?: Shipment,
): Omit<Shipment, 'id'> {
  const originWh = ctx.warehouses.find((item) => item.id === input.originWarehouseId)
  const destWh = input.destinationWarehouseId
    ? ctx.warehouses.find((item) => item.id === input.destinationWarehouseId)
    : undefined
  const route = input.routeId ? ctx.routes.find((item) => item.id === input.routeId) : undefined
  const stops = ctx.deliveries
    .filter((item) => item.routeId && item.routeId === input.routeId)
    .sort((a, b) => a.sequence - b.sequence)
  const origin = warehousePoint(originWh)
  const notes = (input.shippingNoteIds ?? existing?.shippingNoteIds ?? [])
    .map((id) => resolveNote(id, ctx))
    .filter((item): item is ShippingNote => Boolean(item))
  const destinationLocation = destWh
    ? warehousePoint(destWh)
    : notes[notes.length - 1]
      ? locationFor(notes[notes.length - 1].city, notes[notes.length - 1].address, notes[notes.length - 1].client, origin)
      : stops[stops.length - 1]?.location ?? origin
  const destination =
    input.destination?.trim() ||
    destWh?.name ||
    route?.name ||
    notes[0]?.client ||
    stops[stops.length - 1]?.client ||
    'Destination'
  const path = route?.path?.length
    ? route.path
    : waypointPath([origin, ...(stops.map((item) => item.location) ?? []), destinationLocation].filter(Boolean))
  const fromNotes = aggregateNoteLines(notes)
  const fromCatalog = noteLines(ctx.products, input.lines ?? [])
  const aggregated = new Map<string, DeliveryNoteLine>()
  if (!fromNotes.length && !fromCatalog.length && stops.length) {
    stops.forEach((stop) => {
      stop.lines.forEach((line) => {
        const current = aggregated.get(line.productId)
        if (current) current.quantity += line.quantity
        else aggregated.set(line.productId, { ...line })
      })
    })
  }
  const status = input.status ?? existing?.status ?? 'preparing'
  const progress = route?.progress ?? (status === 'done' ? 100 : status === 'in_transit' || status === 'delayed' ? 40 : 0)
  return {
    originWarehouseId: input.originWarehouseId,
    destination,
    destinationWarehouseId: input.destinationWarehouseId,
    vehicleId: input.vehicleId,
    driverId: input.driverId,
    routeId: input.routeId,
    date: input.date,
    status,
    origin,
    destinationLocation,
    path,
    currentPosition: route?.currentPosition ?? pointAlong(path, progress / 100),
    progress,
    lines: fromNotes.length ? fromNotes : fromCatalog.length ? fromCatalog : [...aggregated.values()],
    eta: input.eta,
    notes: input.notes?.trim() || undefined,
    shippingNoteIds: notes.map((item) => item.id),
  }
}

export function refreshRouteTracking(route: Route, ctx: LogisticsBuildCtx) {
  Object.assign(route, assembleRoute({
    name: route.name,
    date: route.date,
    driverId: route.driverId,
    vehicleId: route.vehicleId,
    warehouseId: route.warehouseId,
    status: route.status,
  }, ctx, route))
}

export function relinkRouteDeliveries(route: Route, ctx: LogisticsBuildCtx) {
  const origin = warehousePoint(ctx.warehouses.find((item) => item.id === route.warehouseId))
  ctx.deliveries
    .filter((item) => item.routeId === route.id)
    .forEach((item) => {
      if (item.status !== 'delivered') {
        item.driverId = route.driverId
        item.vehicleId = route.vehicleId
      }
      item.warehouseId = route.warehouseId
      item.path = waypointPath([origin, item.location])
      item.currentPosition = pointAlong(item.path, item.progress / 100)
    })
}

export function syncRouteStops(route: Route, stops: RouteStopInput[], ctx: LogisticsBuildCtx) {
  const keep = new Set(stops.map((stop) => stop.id).filter((id): id is string => Boolean(id)))
  for (let index = ctx.deliveries.length - 1; index >= 0; index--) {
    const item = ctx.deliveries[index]
    if (item.routeId === route.id && !keep.has(item.id)) {
      releaseDeliveryNote(item, ctx)
      ctx.deliveries.splice(index, 1)
    }
  }
  stops.forEach((stop, index) => {
    const existing = stop.id ? ctx.deliveries.find((item) => item.id === stop.id) : undefined
    const input: DeliveryInput = {
      shippingNoteId: stop.shippingNoteId,
      client: stop.client,
      address: stop.address,
      city: stop.city,
      scheduledAt: stop.scheduledAt,
      routeId: route.id,
      status: stop.status ?? existing?.status ?? 'prepared',
      sequence: index + 1,
      notes: stop.notes,
    }
    const assembled = assembleDelivery(input, ctx, existing)
    if (existing) {
      Object.assign(existing, assembled, { id: existing.id })
      bindDeliveryNote(existing, ctx)
    } else {
      const delivery: Delivery = { id: uid('dlv'), ...assembled }
      ctx.deliveries.push(delivery)
      bindDeliveryNote(delivery, ctx)
    }
  })
}
