import type { GeoPoint } from '@/types'
import { chainPath, haversineKm } from '@/utils/geo'

const cache = new Map<string, GeoPoint[]>()
const inflight = new Map<string, Promise<GeoPoint[]>>()

const OSRM_URL = 'https://router.project-osrm.org/route/v1/driving'

function cacheKey(points: GeoPoint[]) {
  return points.map((point) => `${point.lng.toFixed(5)},${point.lat.toFixed(5)}`).join(';')
}

function fallbackRoute(points: GeoPoint[]): GeoPoint[] {
  if (points.length < 2) return [...points]
  // Densifie la Bézier pour un rendu moins « ligne droite » si OSRM est indisponible.
  return chainPath(points, 24)
}

function decodeOsrm(coordinates: [number, number][], labels: GeoPoint[]): GeoPoint[] {
  if (!coordinates.length) return fallbackRoute(labels)
  return coordinates.map(([lng, lat], index) => ({
    lat,
    lng,
    label:
      index === 0
        ? labels[0]?.label
        : index === coordinates.length - 1
          ? labels[labels.length - 1]?.label
          : undefined,
  }))
}

/** Trace routier réel (OSRM public). Fallback Bézier densifiée hors-ligne. */
export async function roadRoute(waypoints: GeoPoint[]): Promise<GeoPoint[]> {
  const points = waypoints.filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng))
  if (points.length < 2) return [...points]

  // Fusionne les points trop proches (évite les erreurs OSRM).
  const cleaned: GeoPoint[] = [points[0]]
  for (let i = 1; i < points.length; i++) {
    if (haversineKm(cleaned[cleaned.length - 1], points[i]) >= 0.05) cleaned.push(points[i])
    else cleaned[cleaned.length - 1] = { ...cleaned[cleaned.length - 1], ...points[i] }
  }
  if (cleaned.length < 2) return [...cleaned]

  const key = cacheKey(cleaned)
  const hit = cache.get(key)
  if (hit) return hit.map((point) => ({ ...point }))

  const pending = inflight.get(key)
  if (pending) return pending.then((path) => path.map((point) => ({ ...point })))

  const coords = cleaned.map((point) => `${point.lng},${point.lat}`).join(';')
  const request = (async () => {
    try {
      const response = await fetch(`${OSRM_URL}/${coords}?overview=full&geometries=geojson&steps=false`, {
        headers: { Accept: 'application/json' },
      })
      if (!response.ok) throw new Error(`OSRM ${response.status}`)
      const payload = (await response.json()) as {
        code?: string
        routes?: { geometry?: { coordinates?: [number, number][] } }[]
      }
      if (payload.code !== 'Ok' || !payload.routes?.[0]?.geometry?.coordinates?.length) {
        throw new Error('OSRM empty')
      }
      const path = decodeOsrm(payload.routes[0].geometry.coordinates, cleaned)
      cache.set(key, path)
      return path
    } catch {
      const path = fallbackRoute(cleaned)
      cache.set(key, path)
      return path
    } finally {
      inflight.delete(key)
    }
  })()

  inflight.set(key, request)
  return request.then((path) => path.map((point) => ({ ...point })))
}

export function routeDistanceKm(path: GeoPoint[]) {
  let km = 0
  for (let i = 0; i < path.length - 1; i++) km += haversineKm(path[i], path[i + 1])
  return km
}
