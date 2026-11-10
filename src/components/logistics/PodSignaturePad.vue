<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import Button from '@/components/ui/Button.vue'

const model = defineModel<string>({ default: '' })

const canvasRef = ref<HTMLCanvasElement | null>(null)
const drawing = ref(false)

function ctx() {
  const canvas = canvasRef.value
  if (!canvas) return null
  const context = canvas.getContext('2d')
  if (!context) return null
  return { canvas, context }
}

function resize() {
  const pair = ctx()
  if (!pair) return
  const { canvas, context } = pair
  const ratio = window.devicePixelRatio || 1
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  canvas.width = Math.floor(width * ratio)
  canvas.height = Math.floor(height * ratio)
  context.setTransform(ratio, 0, 0, ratio, 0, 0)
  context.lineWidth = 2
  context.lineCap = 'round'
  context.strokeStyle = '#0f172a'
  if (model.value) {
    const image = new Image()
    image.onload = () => context.drawImage(image, 0, 0, width, height)
    image.src = model.value
  }
}

function point(event: PointerEvent) {
  const canvas = canvasRef.value
  if (!canvas) return { x: 0, y: 0 }
  const rect = canvas.getBoundingClientRect()
  return { x: event.clientX - rect.left, y: event.clientY - rect.top }
}

function start(event: PointerEvent) {
  const pair = ctx()
  if (!pair) return
  drawing.value = true
  const { context } = pair
  const { x, y } = point(event)
  context.beginPath()
  context.moveTo(x, y)
  canvasRef.value?.setPointerCapture(event.pointerId)
}

function move(event: PointerEvent) {
  if (!drawing.value) return
  const pair = ctx()
  if (!pair) return
  const { x, y } = point(event)
  pair.context.lineTo(x, y)
  pair.context.stroke()
}

function end() {
  if (!drawing.value) return
  drawing.value = false
  const canvas = canvasRef.value
  if (!canvas) return
  model.value = canvas.toDataURL('image/png')
}

function clear() {
  const pair = ctx()
  if (!pair) return
  pair.context.clearRect(0, 0, pair.canvas.clientWidth, pair.canvas.clientHeight)
  model.value = ''
}

onMounted(() => {
  resize()
  window.addEventListener('resize', resize)
})

onUnmounted(() => {
  window.removeEventListener('resize', resize)
})

watch(model, (value) => {
  if (!value) {
    const pair = ctx()
    pair?.context.clearRect(0, 0, pair.canvas.clientWidth, pair.canvas.clientHeight)
  }
})
</script>

<template>
  <div class="space-y-2">
    <canvas
      ref="canvasRef"
      class="h-36 w-full touch-none rounded-lg border bg-white"
      @pointerdown.prevent="start"
      @pointermove.prevent="move"
      @pointerup.prevent="end"
      @pointerleave.prevent="end"
    />
    <div class="flex justify-end">
      <Button type="button" size="sm" variant="ghost" @click="clear">Effacer</Button>
    </div>
  </div>
</template>
