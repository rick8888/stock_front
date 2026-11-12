import type { DeliveryStatus, Driver, Route, ShippingNote, Vehicle, Warehouse } from '@/types'
import { DEMO_TODAY } from '@/utils/helpers'

export interface RouteAssistStopInput {
  key: string
  shippingNoteId: string
  client?: string
  city?: string
  address?: string
  scheduledAt?: string
  status?: DeliveryStatus
  lat?: number
  lng?: number
}

export interface RouteAssistStop extends RouteAssistStopInput {
  sequence: number
  score: number
  reasons: string[]
  distanceFromPrevKm?: number
  lat: number
  lng: number
}

export interface RouteAssistDriver {
  driverId: string
  name: string
  status: Driver['status']
  vehicleId?: string | null
  score: number
  recommended: boolean
  reasons: string[]
}

export interface RouteAssistVehicle {
  vehicleId: string
  name: string
  plate: string
  status: Vehicle['status']
  warehouseId: string
  score: number
  recommended: boolean
  reasons: string[]
}

export interface RouteAssistResult {
  warehouseId: string
  stops: RouteAssistStop[]
  distanceKm: number
  previousDistanceKm: number | null
  drivers: RouteAssistDriver[]
  vehicles: RouteAssistVehicle[]
  reasons: string[]
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)))
}

function pathLengthKm(path: { lat: number; lng: number }[]) {
  let total = 0
  for (let i = 0; i < path.length - 1; i++) total += haversineKm(path[i], path[i + 1])
  return total
}

function minutesOfDay(iso: string) {
  const value = new Date(iso)
  if (Number.isNaN(value.getTime())) return 12 * 60
  return value.getHours() * 60 + value.getMinutes()
}

function resolvePoint(
  stop: RouteAssistStopInput,
  note: ShippingNote | undefined,
  warehouse: Warehouse | undefined,
) {
  if (stop.lat != null && stop.lng != null) return { lat: stop.lat, lng: stop.lng }
  return {
    lat: warehouse?.lat ?? 33.5731,
    lng: warehouse?.lng ?? -7.5898,
  }
}

function enrichStop(
  stop: RouteAssistStopInput,
  index: number,
  notes: ShippingNote[],
  warehouse: Warehouse | undefined,
): RouteAssistStop {
  const note = notes.find((item) => item.id === stop.shippingNoteId)
  const point = resolvePoint(stop, note, warehouse)
  return {
    ...stop,
    client: stop.client ?? note?.client ?? '',
    city: stop.city ?? note?.city ?? '',
    address: stop.address ?? note?.address ?? '',
    status: stop.status ?? 'prepared',
    scheduledAt: stop.scheduledAt ?? '',
    lat: point.lat,
    lng: point.lng,
    sequence: index + 1,
    score: 0,
    reasons: [],
  }
}

function orderStops(stops: RouteAssistStop[], origin: { lat: number; lng: number }): RouteAssistStop[] {
  const remaining = [...stops]
  const ordered: RouteAssistStop[] = []
  let cursor = origin
  let prevCity: string | null = null

  while (remaining.length) {
    let bestIndex = 0
    let bestScore = Number.NEGATIVE_INFINITY
    remaining.forEach((candidate, i) => {
      const dist = haversineKm(cursor, candidate)
      let urgency = candidate.status === 'at_risk' ? 40 : 0
      if (candidate.scheduledAt) urgency += Math.max(0, (18 * 60 - minutesOfDay(candidate.scheduledAt)) / 30)
      const sameCity = prevCity != null && candidate.city?.localeCompare(prevCity, undefined, { sensitivity: 'accent' }) === 0
      const score = urgency + (sameCity ? 25 : 0) - dist * 2.5
      if (score > bestScore) {
        bestScore = score
        bestIndex = i
      }
    })
    const picked = remaining.splice(bestIndex, 1)[0]
    const distFromPrev = haversineKm(cursor, picked)
    const reasons: string[] = []
    if (picked.status === 'at_risk') reasons.push('Priorité risque')
    if (prevCity != null && picked.city?.localeCompare(prevCity, undefined, { sensitivity: 'accent' }) === 0) {
      reasons.push('Même ville que l’arrêt précédent')
    } else if (picked.city) {
      reasons.push(`Secteur ${picked.city}`)
    }
    reasons.push(`À ${distFromPrev.toFixed(1)} km du point précédent`)
    ordered.push({
      ...picked,
      score: Math.round(Math.max(0, bestScore)),
      reasons,
      distanceFromPrevKm: Math.round(distFromPrev * 10) / 10,
      sequence: ordered.length + 1,
    })
    cursor = { lat: picked.lat, lng: picked.lng }
    prevCity = picked.city || prevCity
  }
  return ordered
}

function driverName(driver: Driver, users: { id: string; firstName?: string; lastName?: string; name?: string }[]) {
  if ((driver as { name?: string }).name) return (driver as { name?: string }).name as string
  const user = users.find((item) => item.id === driver.userId)
  if (user?.name) return user.name
  if (user) return `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || driver.id
  return driver.id
}

function rankDrivers(input: {
  drivers: Driver[]
  users: { id: string; firstName?: string; lastName?: string; name?: string; warehouseIds?: string[] }[]
  routes: Route[]
  warehouseId: string
  date: string
  currentId?: string
}): RouteAssistDriver[] {
  const busy = new Set(
    input.routes
      .filter((route) => route.date === input.date && route.status !== 'done')
      .map((route) => route.driverId),
  )
  const ranked = input.drivers.map((driver) => {
    const user = input.users.find((item) => item.id === driver.userId)
    const warehouses = user?.warehouseIds ?? []
    const sameWh = !input.warehouseId || warehouses.includes(input.warehouseId) || !warehouses.length
    const reasons: string[] = []
    let score = 50
    if (driver.status === 'available') {
      score += 30
      reasons.push('Disponible')
    } else if (driver.status === 'on_route') {
      score -= 25
      reasons.push('Déjà en tournée')
    } else {
      score -= 40
      reasons.push('Indisponible')
    }
    if (sameWh) {
      score += 20
      reasons.push('Rattaché à l’entrepôt')
    } else {
      score -= 15
      reasons.push('Autre entrepôt')
    }
    if (busy.has(driver.id)) {
      score -= 35
      reasons.push('Déjà planifié ce jour')
    }
    if (driver.vehicleId) {
      score += 10
      reasons.push('Véhicule habituel lié')
    }
    if (input.currentId && driver.id === input.currentId) {
      score += 5
      reasons.push('Sélection actuelle')
    }
    return {
      driverId: driver.id,
      name: driverName(driver, input.users),
      status: driver.status,
      vehicleId: driver.vehicleId ?? null,
      score,
      recommended: false,
      reasons,
    }
  })
  ranked.sort((a, b) => b.score - a.score)
  if (ranked[0]) {
    ranked[0].recommended = true
    ranked[0].reasons.push('Meilleure dispo pour cette tournée')
  }
  return ranked.slice(0, 5)
}

function rankVehicles(input: {
  vehicles: Vehicle[]
  drivers: RouteAssistDriver[]
  warehouseId: string
  currentId?: string
}): RouteAssistVehicle[] {
  const preferred = input.drivers.find((item) => item.recommended)?.vehicleId ?? null
  const ranked = input.vehicles.map((vehicle) => {
    const reasons: string[] = []
    let score = 50
    if (vehicle.status === 'available') {
      score += 30
      reasons.push('Disponible')
    } else {
      score -= 30
      reasons.push(`Statut ${vehicle.status}`)
    }
    if (!input.warehouseId || vehicle.warehouseId === input.warehouseId) {
      score += 20
      reasons.push('Basé sur l’entrepôt')
    } else {
      score -= 15
      reasons.push('Autre entrepôt')
    }
    if (preferred && vehicle.id === preferred) {
      score += 25
      reasons.push('Lié au chauffeur recommandé')
    }
    if (input.currentId && vehicle.id === input.currentId) {
      score += 5
      reasons.push('Sélection actuelle')
    }
    return {
      vehicleId: vehicle.id,
      name: vehicle.name,
      plate: vehicle.plate,
      status: vehicle.status,
      warehouseId: vehicle.warehouseId,
      score,
      recommended: false,
      reasons,
    }
  })
  ranked.sort((a, b) => b.score - a.score)
  if (ranked[0]) {
    ranked[0].recommended = true
    ranked[0].reasons.push('Meilleure affectation flotte')
  }
  return ranked.slice(0, 5)
}

/** Suggestion locale (mock) — miroir de RouteAssistService PHP. */
export function buildRouteAssist(input: {
  warehouseId: string
  date?: string
  stops: RouteAssistStopInput[]
  driverId?: string
  vehicleId?: string
  warehouses: Warehouse[]
  shippingNotes: ShippingNote[]
  drivers: Driver[]
  vehicles: Vehicle[]
  routes: Route[]
  users?: { id: string; firstName?: string; lastName?: string; name?: string; warehouseIds?: string[] }[]
}): RouteAssistResult {
  const warehouse = input.warehouses.find((item) => item.id === input.warehouseId)
  const origin = {
    lat: warehouse?.lat ?? 33.5731,
    lng: warehouse?.lng ?? -7.5898,
  }
  const enriched = input.stops.map((stop, index) => enrichStop(stop, index, input.shippingNotes, warehouse))
  const previousDistanceKm = enriched.length
    ? Math.round(pathLengthKm([origin, ...enriched]) * 10) / 10
    : null
  const ordered = orderStops(enriched, origin)
  const distanceKm = ordered.length ? Math.round(pathLengthKm([origin, ...ordered]) * 10) / 10 : 0
  const drivers = rankDrivers({
    drivers: input.drivers,
    users: input.users ?? [],
    routes: input.routes,
    warehouseId: input.warehouseId,
    date: input.date ?? DEMO_TODAY,
    currentId: input.driverId,
  })
  const vehicles = rankVehicles({
    vehicles: input.vehicles,
    drivers,
    warehouseId: input.warehouseId,
    currentId: input.vehicleId,
  })

  const reasons: string[] = []
  if (ordered.length) {
    const cities = [...new Set(ordered.map((item) => item.city).filter(Boolean))]
    if (cities.length > 1) reasons.push(`Arrêts regroupés par ville (${cities.join(' → ')})`)
    else if (cities[0]) reasons.push(`Tous les arrêts sur ${cities[0]}`)
    const urgent = ordered.filter((item) => item.status === 'at_risk').length
    if (urgent) reasons.push(`${urgent} arrêt(s) à risque placés en priorité`)
    if (previousDistanceKm != null && distanceKm < previousDistanceKm) {
      reasons.push(`Distance indicative ${distanceKm} km (avant ${previousDistanceKm} km)`)
    } else {
      reasons.push(`Distance indicative ${distanceKm} km (ordre proposé)`)
    }
  } else {
    reasons.push('Aucun arrêt à classer — suggestion flotte uniquement')
  }

  return {
    warehouseId: input.warehouseId,
    stops: ordered,
    distanceKm,
    previousDistanceKm,
    drivers,
    vehicles,
    reasons,
  }
}
