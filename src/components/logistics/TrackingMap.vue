<script setup lang="ts">
import { computed, ref } from 'vue'
import { useElementSize } from '@vueuse/core'
import { fitView, project } from '@/utils/geo'
import type { GeoPoint, MapMarker } from '@/types'

const TILE = 256
const SUBS = ['a', 'b', 'c', 'd']

const props = defineProps<{
  path?: GeoPoint[]
  trail?: GeoPoint[]
  remaining?: GeoPoint[]
  vehicle?: GeoPoint | null
  markers?: MapMarker[]
}>()

const root = ref<HTMLElement | null>(null)
const { width, height } = useElementSize(root)

const allPoints = computed(() => {
  const points: GeoPoint[] = [
    ...(props.path ?? []),
    ...(props.trail ?? []),
    ...(props.remaining ?? []),
    ...(props.markers ?? []),
  ]
  if (props.vehicle) points.push(props.vehicle)
  return points
})

const view = computed(() => fitView(allPoints.value, width.value, height.value))

function toPx(point: GeoPoint) {
  const world = project(point.lat, point.lng, view.value.zoom)
  return { x: world.x - view.value.originX, y: world.y - view.value.originY }
}

const tiles = computed(() => {
  if (width.value < 8 || height.value < 8) return []
  const { zoom, originX, originY } = view.value
  const max = 2 ** zoom
  const startX = Math.floor(originX / TILE)
  const endX = Math.floor((originX + width.value) / TILE)
  const startY = Math.floor(originY / TILE)
  const endY = Math.floor((originY + height.value) / TILE)
  const list: { key: string; src: string; left: number; top: number }[] = []
  for (let x = startX; x <= endX; x++) {
    for (let y = startY; y <= endY; y++) {
      if (y < 0 || y >= max) continue
      const tx = ((x % max) + max) % max
      const sub = SUBS[(tx + y) % SUBS.length]
      list.push({
        key: `${zoom}-${tx}-${y}`,
        src: `https://${sub}.basemaps.cartocdn.com/rastertiles/voyager/${zoom}/${tx}/${y}@2x.png`,
        left: x * TILE - originX,
        top: y * TILE - originY,
      })
    }
  }
  return list
})

function poly(points?: GeoPoint[]) {
  if (!points?.length) return ''
  return points.map((point) => {
    const px = toPx(point)
    return `${px.x},${px.y}`
  }).join(' ')
}

const trailPoints = computed(() => poly(props.trail?.length ? props.trail : props.path))
const restPoints = computed(() => poly(props.remaining))
const vehiclePx = computed(() => (props.vehicle ? toPx(props.vehicle) : null))
const markerPx = computed(() =>
  (props.markers ?? [])
    .filter((marker) => marker.kind !== 'vehicle')
    .map((marker) => ({ marker, ...toPx(marker) })),
)

function markerFill(tone?: MapMarker['tone']) {
  if (tone === 'done') return '#059669'
  if (tone === 'risk') return '#d97706'
  if (tone === 'current') return '#E0A21A'
  if (tone === 'origin') return '#1F2A24'
  return '#94a3b8'
}
</script>

<template>
  <div ref="root" class="relative h-56 overflow-hidden rounded-xl border bg-muted sm:h-64">
    <img
      v-for="tile in tiles"
      :key="tile.key"
      :src="tile.src"
      alt=""
      class="pointer-events-none absolute size-[256px] max-w-none select-none"
      :style="{ left: `${tile.left}px`, top: `${tile.top}px` }"
      draggable="false"
    />
    <svg
      v-if="width && height"
      class="pointer-events-none absolute inset-0"
      :viewBox="`0 0 ${width} ${height}`"
      preserveAspectRatio="none"
    >
      <polyline
        v-if="restPoints"
        :points="restPoints"
        fill="none"
        stroke="#94a3b8"
        stroke-width="3.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-dasharray="7 6"
        opacity="0.9"
      />
      <polyline
        v-if="trailPoints"
        :points="trailPoints"
        fill="none"
        stroke="#111111"
        stroke-width="4"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <g v-for="item in markerPx" :key="item.marker.id">
        <circle :cx="item.x" :cy="item.y" r="9" :fill="markerFill(item.marker.tone)" stroke="#fff" stroke-width="2" />
        <text
          v-if="item.marker.sequence"
          :x="item.x"
          :y="item.y + 3.5"
          text-anchor="middle"
          fill="#fff"
          font-size="9"
          font-weight="700"
        >
          {{ item.marker.sequence }}
        </text>
      </g>
      <g v-if="vehiclePx">
        <circle :cx="vehiclePx.x" :cy="vehiclePx.y" r="16" fill="#111111" opacity="0.2">
          <animate attributeName="r" values="12;20;12" dur="2.2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.28;0.06;0.28" dur="2.2s" repeatCount="indefinite" />
        </circle>
        <circle :cx="vehiclePx.x" :cy="vehiclePx.y" r="10" fill="#111111" stroke="#E0A21A" stroke-width="3" />
        <circle :cx="vehiclePx.x" :cy="vehiclePx.y" r="3.5" fill="#fff" />
      </g>
    </svg>
    <p class="absolute bottom-1.5 right-2 text-[10px] text-slate-600/80">© OSM · CARTO</p>
  </div>
</template>
