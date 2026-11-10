import { computed, onUnmounted, ref, watch, type Ref } from 'vue'
import { trackingService } from '@/services/tracking.service'
import type { Route } from '@/types'

const PING_EVERY_MS = 20_000
const MIN_MOVE_M = 25

/**
 * Envoie la position GPS du chauffeur pendant qu'une tournée est en cours.
 * S'appuie sur watchPosition + un filet périodique si le téléphone bouge peu.
 */
export function useDriverGps(activeRoutes: Ref<Route[]>) {
  const enabled = ref(false)
  const lastError = ref<string | null>(null)
  const lastPingAt = ref<string | null>(null)
  const sending = ref(false)
  let watchId: number | null = null
  let timer: ReturnType<typeof setInterval> | null = null
  let lastSent: { lat: number; lng: number; at: number } | null = null

  const routeId = computed(() => {
    const active = activeRoutes.value.find((item) => item.status === 'in_progress')
      ?? activeRoutes.value.find((item) => item.status === 'planned')
    return active?.id ?? null
  })

  async function send(coords: GeolocationCoordinates, eventType: 'ping' | 'departed' = 'ping') {
    if (!routeId.value || sending.value) return
    const now = Date.now()
    if (
      lastSent &&
      eventType === 'ping' &&
      now - lastSent.at < PING_EVERY_MS &&
      distanceMeters(lastSent, coords) < MIN_MOVE_M
    ) {
      return
    }
    sending.value = true
    try {
      await trackingService.ping({
        routeId: routeId.value,
        lat: coords.latitude,
        lng: coords.longitude,
        accuracyM: coords.accuracy,
        speedKmh: coords.speed != null && coords.speed >= 0 ? coords.speed * 3.6 : undefined,
        heading: coords.heading != null && coords.heading >= 0 ? coords.heading : undefined,
        eventType,
        source: 'driver_app',
      })
      lastSent = { lat: coords.latitude, lng: coords.longitude, at: now }
      lastPingAt.value = new Date().toISOString()
      lastError.value = null
    } catch (err) {
      lastError.value = err instanceof Error ? err.message : 'Envoi GPS impossible'
    } finally {
      sending.value = false
    }
  }

  function onPosition(position: GeolocationPosition) {
    void send(position.coords, lastSent ? 'ping' : 'departed')
  }

  function start() {
    if (!navigator.geolocation) {
      lastError.value = 'GPS indisponible sur cet appareil'
      return
    }
    enabled.value = true
    if (watchId != null) navigator.geolocation.clearWatch(watchId)
    watchId = navigator.geolocation.watchPosition(onPosition, (err) => {
      lastError.value = err.message || 'GPS refusé'
    }, {
      enableHighAccuracy: true,
      maximumAge: 10_000,
      timeout: 20_000,
    })
    if (timer) clearInterval(timer)
    timer = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (position) => void send(position.coords),
        () => undefined,
        { enableHighAccuracy: true, maximumAge: 15_000, timeout: 15_000 },
      )
    }, PING_EVERY_MS)
  }

  function stop() {
    enabled.value = false
    if (watchId != null) {
      navigator.geolocation.clearWatch(watchId)
      watchId = null
    }
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  watch(
    routeId,
    (id) => {
      if (id) start()
      else stop()
    },
    { immediate: true },
  )

  onUnmounted(stop)

  return { enabled, lastError, lastPingAt, sending, routeId }
}

function distanceMeters(
  a: { lat: number; lng: number },
  coords: { latitude: number; longitude: number },
) {
  const toRad = (value: number) => (value * Math.PI) / 180
  const dLat = toRad(coords.latitude - a.lat)
  const dLng = toRad(coords.longitude - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(coords.latitude)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h)))
}
