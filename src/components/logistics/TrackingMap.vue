<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { pointAlong, splitPath } from '@/utils/geo'
import { roadRoute } from '@/utils/routing'
import type { GeoPoint, MapMarker } from '@/types'

const props = defineProps<{
  path?: GeoPoint[]
  trail?: GeoPoint[]
  remaining?: GeoPoint[]
  vehicle?: GeoPoint | null
  markers?: MapMarker[]
  progress?: number
}>()

const root = ref<HTMLElement | null>(null)
const map = shallowRef<L.Map | null>(null)
const routeLayer = shallowRef<L.LayerGroup | null>(null)
const loading = ref(true)
const usingRoads = ref(false)
const roadPath = shallowRef<GeoPoint[]>([])
const displayProgress = ref(0)
let animFrame = 0
let animFrom = 0
let animTo = 0
let animStart = 0

const waypoints = computed(() => {
  const stops = (props.markers ?? [])
    .filter((marker) => marker.kind !== 'vehicle')
    .sort((a, b) => {
      const order = (kind?: MapMarker['kind']) =>
        kind === 'origin' ? 0 : kind === 'stop' ? 1 : kind === 'destination' ? 2 : 3
      const byKind = order(a.kind) - order(b.kind)
      if (byKind) return byKind
      return (a.sequence ?? 0) - (b.sequence ?? 0)
    })
  if (stops.length >= 2) {
    return stops.map((marker) => ({ lat: marker.lat, lng: marker.lng, label: marker.label }))
  }
  if ((props.path?.length ?? 0) >= 2) {
    // Ancien path Bézier : on ne garde que début / fin (+ points intermédiaires espacés).
    const source = props.path!
    const picked = [source[0]]
    for (let i = 1; i < source.length - 1; i += Math.max(1, Math.floor(source.length / 4))) {
      picked.push(source[i])
    }
    picked.push(source[source.length - 1])
    return picked
  }
  return []
})

const targetProgress = computed(() => {
  if (typeof props.progress === 'number' && Number.isFinite(props.progress)) {
    return Math.min(100, Math.max(0, props.progress))
  }
  if ((props.path?.length ?? 0) >= 2 && props.vehicle) {
    // Approx si progress absent.
    return 50
  }
  return 0
})

function markerColor(tone?: MapMarker['tone']) {
  if (tone === 'done') return '#059669'
  if (tone === 'risk') return '#d97706'
  if (tone === 'current') return '#E0A21A'
  if (tone === 'origin') return '#1F2A24'
  return '#64748b'
}

function stopIcon(marker: MapMarker) {
  const fill = markerColor(marker.tone)
  const label = marker.sequence
    ? `<span style="color:#fff;font:700 11px/1 system-ui,sans-serif">${marker.sequence}</span>`
    : `<span style="display:block;width:6px;height:6px;border-radius:999px;background:#fff"></span>`
  return L.divIcon({
    className: 'tracking-marker',
    html: `<div style="
      width:28px;height:28px;border-radius:999px;background:${fill};
      border:2px solid #fff;box-shadow:0 8px 18px rgba(15,23,42,.28);
      display:grid;place-items:center;
    ">${label}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}

function truckIcon() {
  return L.divIcon({
    className: 'tracking-vehicle',
    html: `<div style="
      width:42px;height:42px;border-radius:14px;background:#111;
      border:2px solid #E0A21A;box-shadow:0 10px 24px rgba(15,23,42,.35);
      display:grid;place-items:center;position:relative;
    ">
      <span style="
        position:absolute;inset:-6px;border-radius:18px;border:2px solid rgba(224,162,26,.45);
        animation:tracking-pulse 2s ease-in-out infinite;
      "></span>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M3 7h11v8H3V7Z" fill="#fff"/>
        <path d="M14 10h4l3 3v2h-7v-5Z" fill="#E0A21A"/>
        <circle cx="7" cy="17" r="2.2" fill="#E0A21A"/>
        <circle cx="17" cy="17" r="2.2" fill="#E0A21A"/>
      </svg>
    </div>`,
    iconSize: [42, 42],
    iconAnchor: [21, 21],
  })
}

function ensureMap() {
  if (map.value || !root.value) return
  const instance = L.map(root.value, {
    zoomControl: true,
    attributionControl: true,
    scrollWheelZoom: false,
  }).setView([33.5731, -7.5898], 11)

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(instance)

  routeLayer.value = L.layerGroup().addTo(instance)
  map.value = instance
  requestAnimationFrame(() => instance.invalidateSize())
}

function paint() {
  const instance = map.value
  const layer = routeLayer.value
  if (!instance || !layer) return
  layer.clearLayers()

  const path = roadPath.value
  if (path.length < 2) {
    const fallback = waypoints.value
    if (fallback.length) {
      instance.fitBounds(
        L.latLngBounds(fallback.map((point) => [point.lat, point.lng] as [number, number])),
        { padding: [36, 36], maxZoom: 14 },
      )
    }
    return
  }

  const ratio = displayProgress.value / 100
  const { done, rest } = splitPath(path, ratio)
  const vehicle = pointAlong(path, ratio)

  if (rest.length > 1) {
    L.polyline(
      rest.map((point) => [point.lat, point.lng] as [number, number]),
      {
        color: '#94a3b8',
        weight: 5,
        opacity: 0.85,
        dashArray: '8 10',
        lineCap: 'round',
        lineJoin: 'round',
      },
    ).addTo(layer)
  }

  if (done.length > 1) {
    L.polyline(
      done.map((point) => [point.lat, point.lng] as [number, number]),
      {
        color: '#111111',
        weight: 6,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
      },
    ).addTo(layer)
  }

  for (const marker of props.markers ?? []) {
    if (marker.kind === 'vehicle') continue
    L.marker([marker.lat, marker.lng], { icon: stopIcon(marker), title: marker.label ?? '' }).addTo(layer)
  }

  L.marker([vehicle.lat, vehicle.lng], { icon: truckIcon(), zIndexOffset: 1000, title: 'Véhicule' }).addTo(layer)

  const bounds = L.latLngBounds(path.map((point) => [point.lat, point.lng] as [number, number]))
  instance.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 })
}

async function resolveRoute() {
  ensureMap()
  const points = waypoints.value
  if (points.length < 2) {
    roadPath.value = [...points]
    loading.value = false
    usingRoads.value = false
    paint()
    return
  }
  loading.value = true
  const routed = await roadRoute(points)
  // Évite d’écraser si les waypoints ont changé pendant le fetch.
  if (cacheKeyNow() !== cacheKeyOf(points)) return
  roadPath.value = routed
  usingRoads.value = routed.length > points.length + 4
  loading.value = false
  paint()
}

function cacheKeyOf(points: GeoPoint[]) {
  return points.map((point) => `${point.lng.toFixed(5)},${point.lat.toFixed(5)}`).join(';')
}

function cacheKeyNow() {
  return cacheKeyOf(waypoints.value)
}

function animateProgress(next: number) {
  cancelAnimationFrame(animFrame)
  animFrom = displayProgress.value
  animTo = next
  animStart = performance.now()
  const duration = 900
  const step = (now: number) => {
    const t = Math.min(1, (now - animStart) / duration)
    const eased = 1 - (1 - t) ** 3
    displayProgress.value = animFrom + (animTo - animFrom) * eased
    paint()
    if (t < 1) animFrame = requestAnimationFrame(step)
  }
  animFrame = requestAnimationFrame(step)
}

onMounted(() => {
  ensureMap()
  displayProgress.value = targetProgress.value
  void resolveRoute()
})

onBeforeUnmount(() => {
  cancelAnimationFrame(animFrame)
  map.value?.remove()
  map.value = null
  routeLayer.value = null
})

watch(waypoints, () => {
  void resolveRoute()
}, { deep: true })

watch(targetProgress, (value) => {
  animateProgress(value)
})

watch(
  () => props.markers,
  () => paint(),
  { deep: true },
)
</script>

<template>
  <div class="relative h-64 overflow-hidden rounded-xl border bg-[#e8eef3] sm:h-72">
    <div ref="root" class="absolute inset-0 z-0" />
    <div
      v-if="loading"
      class="pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-background/80 to-transparent px-3 py-2 text-[11px] text-muted-foreground"
    >
      Calcul de l’itinéraire routier…
    </div>
    <p class="pointer-events-none absolute bottom-2 left-2 z-10 rounded-md bg-background/85 px-2 py-1 text-[10px] text-muted-foreground shadow-sm">
      {{ usingRoads ? 'Itinéraire routier OSM · OSRM' : 'Itinéraire approximatif' }}
    </p>
  </div>
</template>

<style>
@keyframes tracking-pulse {
  0%,
  100% {
    opacity: 0.15;
    transform: scale(0.92);
  }
  50% {
    opacity: 0.55;
    transform: scale(1.08);
  }
}

.tracking-marker,
.tracking-vehicle {
  background: transparent !important;
  border: none !important;
}

.leaflet-container {
  font: inherit;
  background: #e8eef3;
}
</style>
