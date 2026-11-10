import type { GeoPoint } from '@/types'

export const CITY_GEO: Record<string, GeoPoint> = {
  casablanca: { lat: 33.5731, lng: -7.5898, label: 'Casablanca' },
  rabat: { lat: 34.0209, lng: -6.8416, label: 'Rabat' },
  marrakech: { lat: 31.6295, lng: -7.9811, label: 'Marrakech' },
  tanger: { lat: 35.7595, lng: -5.834, label: 'Tanger' },
  salé: { lat: 34.0531, lng: -6.798, label: 'Salé' },
}

export function locationFor(city: string, address: string, label: string, fallback?: GeoPoint): GeoPoint {
  const key = city
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  const base = CITY_GEO[key] ?? fallback ?? CITY_GEO.casablanca
  const n = hashCode(`${address}|${label}|${city}`)
  return {
    lat: base.lat + ((n % 80) - 40) * 0.0004,
    lng: base.lng + (((Math.floor(n / 80) % 80) - 40) * 0.0005),
    label,
  }
}

function hashCode(value: string) {
  let hash = 0
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  return hash
}

const EARTH_KM = 6371

export function haversineKm(a: GeoPoint, b: GeoPoint) {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function lerpPoint(a: GeoPoint, b: GeoPoint, t: number): GeoPoint {
  return {
    lat: a.lat + (b.lat - a.lat) * t,
    lng: a.lng + (b.lng - a.lng) * t,
    label: t >= 1 ? b.label : a.label,
  }
}

export function curvePoints(from: GeoPoint, to: GeoPoint, steps = 8): GeoPoint[] {
  const control = controlPoint(from, to)
  const points: GeoPoint[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    points.push(quadratic(from, control, to, t))
  }
  if (to.label) points[points.length - 1] = { ...points[points.length - 1], label: to.label }
  if (from.label) points[0] = { ...points[0], label: from.label }
  return points
}

export function chainPath(points: GeoPoint[], stepsPerLeg = 8): GeoPoint[] {
  if (points.length < 2) return [...points]
  const path: GeoPoint[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const leg = curvePoints(points[i], points[i + 1], stepsPerLeg)
    if (i > 0) path.pop()
    path.push(...leg)
  }
  return path
}

export function pointAlong(path: GeoPoint[], t: number): GeoPoint {
  if (!path.length) return { lat: 0, lng: 0 }
  if (path.length === 1 || t <= 0) return { ...path[0] }
  if (t >= 1) return { ...path[path.length - 1] }
  const lengths = legLengths(path)
  const total = lengths.reduce((sum, value) => sum + value, 0) || 1
  let remaining = total * t
  for (let i = 0; i < lengths.length; i++) {
    const length = lengths[i] || 1
    if (remaining <= length) return lerpPoint(path[i], path[i + 1], remaining / length)
    remaining -= length
  }
  return { ...path[path.length - 1] }
}

/** Projette un GPS sur le tracé le plus proche (aligné sur bravo-api Geo::projectOntoPath). */
export function projectOntoPath(path: GeoPoint[], lat: number, lng: number) {
  if (!path.length) {
    return { lat, lng, progress: 0, distanceAlongKm: 0, remainingKm: 0, totalKm: 0, segmentIndex: 0 }
  }
  if (path.length === 1) {
    return {
      lat: path[0].lat,
      lng: path[0].lng,
      progress: 0,
      distanceAlongKm: 0,
      remainingKm: 0,
      totalKm: 0,
      segmentIndex: 0,
    }
  }
  const point = { lat, lng }
  let best: GeoPoint | null = null
  let bestDistance = Number.POSITIVE_INFINITY
  let prefix = 0
  let atPrefix = 0
  let segmentIndex = 0
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]
    const b = path[i + 1]
    const leg = haversineKm(a, b)
    const projected = closestOnSegment(a, b, point)
    const dist = haversineKm(point, projected)
    if (dist < bestDistance) {
      bestDistance = dist
      best = projected
      atPrefix = prefix + leg * projected.t
      segmentIndex = i
    }
    prefix += leg
  }
  const total = Math.max(prefix, 0.0001)
  const along = Math.min(total, Math.max(0, atPrefix))
  return {
    lat: best?.lat ?? lat,
    lng: best?.lng ?? lng,
    progress: Math.round((along / total) * 10000) / 100,
    distanceAlongKm: Math.round(along * 1000) / 1000,
    remainingKm: Math.round(Math.max(0, total - along) * 1000) / 1000,
    totalKm: Math.round(total * 1000) / 1000,
    segmentIndex,
  }
}

function closestOnSegment(a: GeoPoint, b: GeoPoint, p: GeoPoint) {
  const ax = a.lng
  const ay = a.lat
  const bx = b.lng
  const by = b.lat
  const px = p.lng
  const py = p.lat
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  if (len2 <= 0) return { lat: ay, lng: ax, t: 0 }
  const t = Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / len2))
  return { lat: ay + t * dy, lng: ax + t * dx, t }
}

export function splitPath(path: GeoPoint[], t: number): { done: GeoPoint[]; rest: GeoPoint[] } {
  if (path.length < 2) return { done: [...path], rest: [] }
  const clamped = Math.min(1, Math.max(0, t))
  const current = pointAlong(path, clamped)
  const lengths = legLengths(path)
  const total = lengths.reduce((sum, value) => sum + value, 0) || 1
  let remaining = total * clamped
  let index = 0
  for (; index < lengths.length; index++) {
    const length = lengths[index] || 1
    if (remaining <= length) break
    remaining -= length
  }
  const done = [...path.slice(0, index + 1), current]
  const rest = [current, ...path.slice(index + 1)]
  return { done, rest }
}

export function project(lat: number, lng: number, zoom: number) {
  const scale = 256 * 2 ** zoom
  const x = ((lng + 180) / 360) * scale
  const latRad = clamp((lat * Math.PI) / 180, -Math.PI / 2 + 1e-6, Math.PI / 2 - 1e-6)
  const y = (0.5 - Math.log(Math.tan(Math.PI / 4 + latRad / 2)) / (2 * Math.PI)) * scale
  return { x, y }
}

export function fitView(points: GeoPoint[], width: number, height: number, padding = 48) {
  const fallback = points[0] ?? { lat: 33.5731, lng: -7.5898 }
  const safeWidth = Math.max(width, 1)
  const safeHeight = Math.max(height, 1)
  for (let zoom = 16; zoom >= 5; zoom--) {
    const projected = (points.length ? points : [fallback]).map((point) => project(point.lat, point.lng, zoom))
    const minX = Math.min(...projected.map((point) => point.x)) - padding
    const maxX = Math.max(...projected.map((point) => point.x)) + padding
    const minY = Math.min(...projected.map((point) => point.y)) - padding
    const maxY = Math.max(...projected.map((point) => point.y)) + padding
    if (maxX - minX <= safeWidth && maxY - minY <= safeHeight) {
      return {
        zoom,
        originX: minX - (safeWidth - (maxX - minX)) / 2,
        originY: minY - (safeHeight - (maxY - minY)) / 2,
      }
    }
  }
  const center = project(fallback.lat, fallback.lng, 6)
  return { zoom: 6, originX: center.x - safeWidth / 2, originY: center.y - safeHeight / 2 }
}

function controlPoint(from: GeoPoint, to: GeoPoint): GeoPoint {
  const dx = to.lng - from.lng
  const dy = to.lat - from.lat
  const bend = 0.18
  return {
    lat: (from.lat + to.lat) / 2 + dx * bend,
    lng: (from.lng + to.lng) / 2 - dy * bend,
  }
}

function quadratic(p0: GeoPoint, p1: GeoPoint, p2: GeoPoint, t: number): GeoPoint {
  const u = 1 - t
  return {
    lat: u * u * p0.lat + 2 * u * t * p1.lat + t * t * p2.lat,
    lng: u * u * p0.lng + 2 * u * t * p1.lng + t * t * p2.lng,
  }
}

function legLengths(path: GeoPoint[]) {
  const lengths: number[] = []
  for (let i = 0; i < path.length - 1; i++) lengths.push(haversineKm(path[i], path[i + 1]))
  return lengths
}

function toRad(value: number) {
  return (value * Math.PI) / 180
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
