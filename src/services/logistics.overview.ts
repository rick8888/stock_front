import { DELIVERY_LABEL, ROUTE_LABEL, SHIPMENT_LABEL } from '@/config/logistics'
import { deliveryCode, routeCode, shipmentCode } from '@/lib/utils'
import type {
  Delivery,
  DeliveryNoteLine,
  Driver,
  GeoPoint,
  MapMarker,
  Route,
  Shipment,
  User,
  Vehicle,
  Warehouse,
} from '@/types'
import { chainPath, pointAlong, splitPath } from '@/utils/geo'

export interface LogisticsContext {
  warehouses: Warehouse[]
  drivers: Driver[]
  users: User[]
  vehicles: Vehicle[]
  routes: Route[]
  deliveries: Delivery[]
}

export interface TrackingView {
  path: GeoPoint[]
  trail: GeoPoint[]
  remaining: GeoPoint[]
  vehicle: GeoPoint | null
  markers: MapMarker[]
  progress: number
}

export interface DeliveryOverview extends TrackingView {
  delivery: Delivery
  code: string
  statusLabel: string
  driverName: string
  driverPhone?: string
  vehicleLabel: string
  warehouseName: string
  warehouseAddress: string
  routeName: string
  lines: DeliveryNoteLine[]
}

export interface ShipmentOverview extends TrackingView {
  shipment: Shipment
  code: string
  statusLabel: string
  driverName: string
  driverPhone?: string
  vehicleLabel: string
  originName: string
  originAddress: string
  destinationName: string
  destinationAddress: string
  routeName?: string
  lines: DeliveryNoteLine[]
  stops: Delivery[]
}

export interface RouteOverview extends TrackingView {
  route: Route
  code: string
  statusLabel: string
  driverName: string
  driverPhone?: string
  vehicleLabel: string
  warehouseName: string
  warehouseAddress: string
  stops: Delivery[]
  doneCount: number
  remainingCount: number
}

function personName(ctx: LogisticsContext, driverId: string) {
  const driver = ctx.drivers.find((item) => item.id === driverId)
  const user = ctx.users.find((item) => item.id === driver?.userId)
  if (user) return `${user.firstName} ${user.lastName}`
  return driverId
}

function driverPhone(ctx: LogisticsContext, driverId: string) {
  return ctx.drivers.find((item) => item.id === driverId)?.phone ?? ''
}

function vehicleLabel(ctx: LogisticsContext, vehicleId: string) {
  const vehicle = ctx.vehicles.find((item) => item.id === vehicleId)
  if (!vehicle) return vehicleId
  return `${vehicle.name} · ${vehicle.plate}`
}

function warehouseOf(ctx: LogisticsContext, id: string) {
  return ctx.warehouses.find((item) => item.id === id)
}

function warehousePoint(ctx: LogisticsContext, id: string): GeoPoint {
  const warehouse = ctx.warehouses.find((item) => item.id === id)
  if (warehouse?.lat != null && warehouse.lng != null) {
    return { lat: warehouse.lat, lng: warehouse.lng, label: `Entrepôt ${warehouse.name}` }
  }
  return { lat: 33.5731, lng: -7.5898, label: warehouse?.name ?? 'Entrepôt' }
}

function trackingFrom(path: GeoPoint[], progress: number, vehicle?: GeoPoint | null): TrackingView {
  const ratio = Math.min(1, Math.max(0, progress / 100))
  const safePath = path.length ? path : vehicle ? [vehicle] : []
  const { done, rest } = splitPath(safePath, ratio)
  const position = vehicle ?? (safePath.length ? pointAlong(safePath, ratio) : null)
  return {
    path: safePath,
    trail: done,
    remaining: rest,
    vehicle: position,
    markers: [],
    progress,
  }
}

function stopTone(delivery: Delivery): MapMarker['tone'] {
  if (delivery.status === 'delivered') return 'done'
  if (delivery.status === 'at_risk' || delivery.status === 'failed') return 'risk'
  if (delivery.status === 'in_transit') return 'current'
  return 'pending'
}

export function deliveryOverview(delivery: Delivery, ctx: LogisticsContext): DeliveryOverview {
  const warehouse = warehouseOf(ctx, delivery.warehouseId)
  const origin = warehousePoint(ctx, delivery.warehouseId)
  const path = delivery.path?.length ? delivery.path : chainPath([origin, delivery.location])
  const tracking = trackingFrom(path, delivery.progress, delivery.currentPosition)
  const route = ctx.routes.find((item) => item.id === delivery.routeId)
  return {
    ...tracking,
    delivery,
    code: deliveryCode(delivery.id, delivery.code),
    statusLabel: DELIVERY_LABEL[delivery.status],
    driverName: personName(ctx, delivery.driverId),
    driverPhone: driverPhone(ctx, delivery.driverId),
    vehicleLabel: vehicleLabel(ctx, delivery.vehicleId),
    warehouseName: warehouse?.name ?? origin.label ?? 'Entrepôt',
    warehouseAddress: warehouse?.address ?? '',
    routeName: route?.name ?? delivery.routeId,
    lines: delivery.lines ?? [],
    markers: [
      { id: 'origin', ...origin, kind: 'origin', label: origin.label ?? warehouse?.name, tone: 'origin' },
      {
        id: delivery.id,
        ...delivery.location,
        kind: 'destination',
        label: delivery.client,
        tone: stopTone(delivery),
      },
      ...(tracking.vehicle
        ? [{ id: 'vehicle', ...tracking.vehicle, kind: 'vehicle' as const, label: 'Véhicule' }]
        : []),
    ],
  }
}

export function shipmentOverview(shipment: Shipment, ctx: LogisticsContext): ShipmentOverview {
  const originWh = warehouseOf(ctx, shipment.originWarehouseId)
  const destWh = shipment.destinationWarehouseId
    ? warehouseOf(ctx, shipment.destinationWarehouseId)
    : undefined
  const stops = ctx.deliveries
    .filter((item) => item.routeId && item.routeId === shipment.routeId)
    .sort((a, b) => a.sequence - b.sequence)
  const route = ctx.routes.find((item) => item.id === shipment.routeId)
  const origin = shipment.origin ?? warehousePoint(ctx, shipment.originWarehouseId)
  const destination = shipment.destinationLocation
  const path =
    shipment.path?.length
      ? shipment.path
      : route?.path?.length
        ? route.path
        : chainPath([origin, ...stops.map((item) => item.location), destination].filter(Boolean))
  const progress = shipment.progress ?? route?.progress ?? 0
  const tracking = trackingFrom(path, progress, shipment.currentPosition ?? route?.currentPosition)
  const stopMarkers: MapMarker[] = stops.map((stop) => ({
    id: stop.id,
    ...stop.location,
    kind: 'stop',
    label: stop.client,
    sequence: stop.sequence,
    tone: stopTone(stop),
  }))
  return {
    ...tracking,
    shipment,
    code: shipmentCode(shipment.id, shipment.code),
    statusLabel: SHIPMENT_LABEL[shipment.status],
    driverName: personName(ctx, shipment.driverId),
    driverPhone: driverPhone(ctx, shipment.driverId),
    vehicleLabel: vehicleLabel(ctx, shipment.vehicleId),
    originName: originWh?.name ?? origin.label ?? 'Départ',
    originAddress: originWh?.address ?? '',
    destinationName: destWh?.name ?? shipment.destination,
    destinationAddress: destWh?.address ?? (stops.length ? stops[stops.length - 1].address : ''),
    routeName: route?.name,
    lines: shipment.lines ?? [],
    stops,
    markers: [
      { id: 'origin', ...origin, kind: 'origin', label: origin.label ?? originWh?.name, tone: 'origin' },
      ...stopMarkers,
      ...(stops.length
        ? []
        : [
            {
              id: 'destination',
              ...destination,
              kind: 'destination' as const,
              label: shipment.destination,
              tone: 'pending' as const,
            },
          ]),
      ...(tracking.vehicle
        ? [{ id: 'vehicle', ...tracking.vehicle, kind: 'vehicle' as const, label: 'Véhicule' }]
        : []),
    ],
  }
}

export function routeOverview(route: Route, ctx: LogisticsContext): RouteOverview {
  const warehouse = warehouseOf(ctx, route.warehouseId)
  const origin = warehousePoint(ctx, route.warehouseId)
  const stops = ctx.deliveries
    .filter((item) => item.routeId === route.id)
    .sort((a, b) => a.sequence - b.sequence)
  const path = route.path?.length ? route.path : chainPath([origin, ...stops.map((item) => item.location)])
  const active = stops.find((item) => item.status === 'in_transit' || item.status === 'at_risk')
  const doneCount = stops.filter((item) => item.status === 'delivered').length
  const progress =
    route.progress ||
    (stops.length ? Math.round((doneCount / stops.length) * 100) : 0)
  const tracking = trackingFrom(path, progress, route.currentPosition ?? active?.currentPosition)
  return {
    ...tracking,
    route,
    code: routeCode(route.id),
    statusLabel: ROUTE_LABEL[route.status],
    driverName: personName(ctx, route.driverId),
    driverPhone: driverPhone(ctx, route.driverId),
    vehicleLabel: vehicleLabel(ctx, route.vehicleId),
    warehouseName: warehouse?.name ?? origin.label ?? 'Entrepôt',
    warehouseAddress: warehouse?.address ?? '',
    stops,
    doneCount,
    remainingCount: stops.length - doneCount,
    markers: [
      { id: 'origin', ...origin, kind: 'origin', label: origin.label ?? warehouse?.name, tone: 'origin' },
      ...stops.map((stop) => ({
        id: stop.id,
        ...stop.location,
        kind: 'stop' as const,
        label: stop.client,
        sequence: stop.sequence,
        tone: stopTone(stop),
      })),
      ...(tracking.vehicle
        ? [{ id: 'vehicle', ...tracking.vehicle, kind: 'vehicle' as const, label: 'Véhicule' }]
        : []),
    ],
  }
}
