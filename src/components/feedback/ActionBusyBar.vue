<script setup lang="ts">
import { useGlobalBusy } from '@/composables/useActionBusy'

const { busy } = useGlobalBusy()
</script>

<template>
  <div
    v-if="busy"
    class="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden bg-muted"
    role="progressbar"
    aria-busy="true"
    aria-label="Chargement"
  >
    <div class="h-full w-1/3 animate-[busy-bar_1s_ease-in-out_infinite] bg-button" />
  </div>
</template>

<style scoped>
@keyframes busy-bar {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(400%);
  }
}
</style>
