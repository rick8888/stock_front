import type { Route } from '@/types'
import { pointAlong } from '../utils/geo'
import { deliveries } from './deliveries'
import { WAREHOUSE_GEO } from './geo'

function buildRoute(
  route: Omit<Route, 'path' | 'currentPosition' | 'progress'> & { progress?: number },
): Route {
  const warehouse = WAREHOUSE_GEO[route.warehouseId]
  const stops = deliveries
    .filter((item) => item.routeId === route.id)
    .sort((a, b) => a.sequence - b.sequence)
    .map((item) => item.location)
  const path = [warehouse, ...stops]
  const delivered = stops.length
    ? deliveries.filter((item) => item.routeId === route.id && item.status === 'delivered').length
    : 0
  const active = deliveries.find(
    (item) => item.routeId === route.id && (item.status === 'in_transit' || item.status === 'at_risk'),
  )
  const progress =
    route.progress ??
    (stops.length
      ? Math.round((((active?.sequence ?? delivered) - (active ? 1 - active.progress / 100 : 0)) / stops.length) * 100)
      : 0)
  const currentPosition = active?.currentPosition ?? (path.length ? pointAlong(path, progress / 100) : warehouse)
  return { ...route, path, currentPosition, progress: Math.min(100, Math.max(0, progress)) }
}

export const routes: Route[] = [
  buildRoute({
    id: 'rt-26a',
    name: 'Casa centre — 26 août',
    date: '2026-08-26',
    driverId: 'drv-mehdi',
    vehicleId: 'veh-12',
    warehouseId: 'wh-casa',
    status: 'in_progress',
    distanceKm: 42,
  }),
  buildRoute({
    id: 'rt-26b',
    name: 'Casa sud — 26 août',
    date: '2026-08-26',
    driverId: 'drv-hassan',
    vehicleId: 'veh-07',
    warehouseId: 'wh-casa',
    status: 'in_progress',
    distanceKm: 28,
  }),
  buildRoute({
    id: 'rt-27b',
    name: 'Rabat nord — 27 août',
    date: '2026-08-27',
    driverId: 'drv-hassan',
    vehicleId: 'veh-03',
    warehouseId: 'wh-rabat',
    status: 'planned',
    distanceKm: 31,
    progress: 0,
  }),
]
