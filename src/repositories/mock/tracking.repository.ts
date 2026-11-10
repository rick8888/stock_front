import type { LiveRouteTracking, RouteTrackingSnapshot, TrackingEvent, TrackingPingInput } from '@/types'
import type { TrackingRepository } from '@/repositories/interfaces'
import { pointAlong } from '@/utils/geo'
import { uid } from '@/utils/helpers'
import { db, mutate, withLatency } from './db'

/**
 * Hors ligne : projette le ping sur le path mock de la tournée, sans journal durable.
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
      const progress = path.length
        ? Math.min(100, Math.max(route.progress, Math.round(((route.progress || 10) + 5))))
        : route.progress
      const position = path.length
        ? { ...pointAlong(path, progress / 100), at: new Date().toISOString(), label: 'Position véhicule' }
        : { lat: input.lat, lng: input.lng, at: new Date().toISOString(), label: 'Position véhicule' }
      route.progress = progress
      route.currentPosition = position
      route.status = progress >= 100 ? 'done' : route.status === 'planned' ? 'in_progress' : route.status
      route.eta = new Date(Date.now() + 40 * 60_000).toISOString()

      const active = db()
        .deliveries.filter((item) => item.routeId === route.id && !['delivered', 'failed'].includes(item.status))
        .sort((a, b) => a.sequence - b.sequence)[0]
      if (active) {
        active.status = active.status === 'prepared' ? 'in_transit' : active.status
        active.progress = Math.min(95, Math.max(active.progress, progress))
        active.currentPosition = position
        active.eta = route.eta
      }

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
        recordedAt: input.recordedAt ?? new Date().toISOString(),
      }

      return { event, route, etaAt: route.eta }
    })
  }
}
