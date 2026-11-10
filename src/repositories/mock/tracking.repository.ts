import type { LiveRouteTracking, RouteTrackingSnapshot, TrackingEvent, TrackingPingInput } from '@/types'
import type { TrackingRepository } from '@/repositories/interfaces'
import { projectOntoPath } from '@/utils/geo'
import { uid } from '@/utils/helpers'
import { db, mutate, withLatency } from './db'

const DEFAULT_SPEED_KMH = 30

/**
 * Hors ligne uniquement : projette le ping GPS sur le path mock, sans journal durable.
 * La progression vient de la projection (pas d’incrément artificiel +5 %).
 */
export class MockTrackingRepository implements TrackingRepository {
  live() {
    return withLatency((): LiveRouteTracking[] =>
      db()
        .routes.filter((route) => route.status === 'in_progress' || route.status === 'planned')
        .map((route) => ({
          routeId: route.id,
          name: route.name,
          status: route.status,
          progress: route.progress,
          eta: route.eta ?? null,
          lastPosition: route.currentPosition ?? null,
          vehicleId: route.vehicleId,
          driverId: route.driverId,
          warehouseId: route.warehouseId,
        })),
    )
  }

  route(id: string) {
    return withLatency((): RouteTrackingSnapshot => {
      const route = db().routes.find((item) => item.id === id)
      if (!route) throw new Error('Tournée introuvable')
      const stops = db()
        .deliveries.filter((item) => item.routeId === id)
        .sort((a, b) => a.sequence - b.sequence)
        .map((stop) => ({
          id: stop.id,
          client: stop.client,
          status: stop.status,
          sequence: stop.sequence,
          progress: stop.progress,
          location: stop.location,
          currentPosition: stop.currentPosition,
          eta: stop.eta,
        }))
      return {
        routeId: id,
        route,
        lastPosition: route.currentPosition ?? null,
        progress: route.progress,
        eta: route.eta ?? null,
        events: [],
        stops,
      }
    })
  }

  ping(input: TrackingPingInput) {
    return mutate(() => {
      const route = db().routes.find((item) => item.id === input.routeId)
      if (!route) throw new Error('Tournée introuvable')
      const path = route.path?.length ? route.path : []
      const projection = path.length >= 2
        ? projectOntoPath(path, input.lat, input.lng)
        : { progress: route.progress, remainingKm: 0, lat: input.lat, lng: input.lng }
      const progress = Math.min(100, Math.max(0, Math.round(projection.progress)))
      const now = input.recordedAt ?? new Date().toISOString()
      const speed = input.speedKmh != null && input.speedKmh >= 5 ? input.speedKmh : DEFAULT_SPEED_KMH
      const etaMs = projection.remainingKm > 0
        ? Date.now() + (projection.remainingKm / speed) * 3600_000
        : Date.now()
      const position = {
        lat: input.lat,
        lng: input.lng,
        at: now,
        label: 'Position véhicule',
      }
      route.progress = progress
      route.currentPosition = position
      route.status = progress >= 100 ? 'done' : route.status === 'planned' ? 'in_progress' : route.status
      route.eta = new Date(etaMs).toISOString()

      const active = db()
        .deliveries.filter((item) => item.routeId === route.id && !['delivered', 'failed'].includes(item.status))
        .sort((a, b) => a.sequence - b.sequence)[0]
      if (active) {
        active.status = active.status === 'prepared' ? 'in_transit' : active.status
        active.progress = Math.min(95, Math.max(active.progress, progress))
        active.currentPosition = position
        active.eta = route.eta
      }

      // Alignement shipment ↔ tournée (même règle que l’API).
      db().shipments
        .filter((item) => item.routeId === route.id)
        .forEach((shipment) => {
          shipment.progress = route.progress
          shipment.currentPosition = route.currentPosition
          if (route.path?.length) shipment.path = route.path
          if (route.eta) shipment.eta = route.eta
          if (route.status === 'in_progress' && shipment.status === 'preparing') {
            shipment.status = 'in_transit'
          }
        })

      const event: TrackingEvent = {
        id: uid('trk'),
        subjectType: 'route',
        subjectId: route.id,
        routeId: route.id,
        vehicleId: route.vehicleId,
        driverId: route.driverId,
        lat: input.lat,
        lng: input.lng,
        accuracyM: input.accuracyM,
        speedKmh: input.speedKmh,
        heading: input.heading,
        progress,
        eventType: input.eventType ?? 'ping',
        source: input.source ?? 'driver_app',
        recordedAt: now,
      }

      return { event, route, etaAt: route.eta, projection }
    })
  }
}
