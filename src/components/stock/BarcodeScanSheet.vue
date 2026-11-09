<script setup lang="ts">
import { nextTick, onUnmounted, ref, watch } from 'vue'
import Sheet from '@/components/ui/Sheet.vue'
import Button from '@/components/ui/Button.vue'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: []; detect: [code: string] }>()

const video = ref<HTMLVideoElement | null>(null)
const error = ref('')
const hint = ref('Placez le code-barres devant la caméra, ou saisissez-le avec une douchette.')
let stream: MediaStream | null = null
let timer: number | null = null

watch(
  () => props.open,
  async (open) => {
    error.value = ''
    if (!open) {
      stop()
      return
    }
    await nextTick()
    await start()
  },
)

onUnmounted(stop)

function stop() {
  if (timer) window.clearInterval(timer)
  timer = null
  stream?.getTracks().forEach((track) => track.stop())
  stream = null
}

async function start() {
  if (!navigator.mediaDevices?.getUserMedia) {
    error.value = 'Caméra indisponible — utilisez une douchette ou saisissez le code.'
    return
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    if (video.value) {
      video.value.srcObject = stream
      await video.value.play()
    }
    const Detector = (window as unknown as { BarcodeDetector?: new (opts: { formats: string[] }) => {
      detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>>
    } }).BarcodeDetector
    if (!Detector || !video.value) {
      hint.value = 'Caméra ouverte. Si la détection auto n’est pas disponible, visez puis saisissez le code dans la recherche.'
      return
    }
    const detector = new Detector({ formats: ['ean_13', 'ean_8', 'code_128', 'qr_code'] })
    timer = window.setInterval(async () => {
      if (!video.value) return
      try {
        const codes = await detector.detect(video.value)
        const value = codes[0]?.rawValue?.trim()
        if (value) {
          emit('detect', value)
          emit('close')
        }
      } catch {
        /* frame skipped */
      }
    }, 400)
  } catch {
    error.value = 'Caméra refusée. Branchez une douchette : le code se tape dans la recherche.'
  }
}
</script>

<template>
  <Sheet :open="open" title="Scanner un code-barres" @close="emit('close')">
    <div class="space-y-3">
      <p class="text-sm text-muted-foreground">{{ hint }}</p>
      <video ref="video" class="w-full overflow-hidden rounded-xl bg-black" playsinline muted />
      <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
    </div>
    <template #footer>
      <Button class="w-full" variant="outline" @click="emit('close')">Fermer</Button>
    </template>
  </Sheet>
</template>
