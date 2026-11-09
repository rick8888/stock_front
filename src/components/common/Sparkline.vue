<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  points?: string
  class?: string
}>()

const coords = computed(() => {
  const raw = props.points ?? '0,22 12,18 24,20 36,14 48,16 60,10 72,13 84,8 100,11'
  return raw.split(' ').map((pair) => {
    const [x, y] = pair.split(',').map(Number)
    return { x, y }
  })
})

const line = computed(() => coords.value.map((point) => `${point.x},${point.y}`).join(' '))
const area = computed(() => {
  const body = coords.value.map((point) => `${point.x},${point.y}`).join(' ')
  return `0,32 ${body} 100,32`
})
const uid = `spark-${Math.random().toString(36).slice(2, 8)}`
</script>

<template>
  <svg viewBox="0 0 100 32" class="h-10 w-28" :class="$props.class" aria-hidden="true">
    <defs>
      <linearGradient :id="uid" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="currentColor" stop-opacity="0.28" />
        <stop offset="100%" stop-color="currentColor" stop-opacity="0.02" />
      </linearGradient>
    </defs>
    <polygon :points="area" :fill="`url(#${uid})`" />
    <polyline
      :points="line"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</template>
