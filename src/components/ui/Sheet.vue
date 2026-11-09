<script setup lang="ts">
import { computed, inject, provide, type Ref } from 'vue'
import { Loader2, X } from 'lucide-vue-next'
import { ACTION_BUSY_KEY } from '@/composables/useActionBusy'

const props = defineProps<{ open: boolean; title?: string; wide?: boolean; xl?: boolean; busy?: boolean }>()
const emit = defineEmits<{ close: [] }>()

const injectedBusy = inject<Ref<boolean> | undefined>(ACTION_BUSY_KEY, undefined)
const busy = computed(() => props.busy === true || injectedBusy?.value === true)
provide('sheetBusy', busy)

function onClose() {
  if (busy.value) return
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50">
      <div class="absolute inset-0 bg-black/40 backdrop-blur-[1px] transition-opacity" @click="onClose" />
      <div
        class="absolute inset-y-0 right-0 flex w-full flex-col border-l border-border/70 bg-card shadow-pop animate-in slide-in-from-right duration-200"
        :class="xl ? 'max-w-2xl' : wide ? 'max-w-xl' : 'max-w-md'"
      >
        <header v-if="title" class="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border/70 px-4">
          <h2 class="text-sm font-semibold tracking-tight">{{ title }}</h2>
          <button
            type="button"
            class="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
            aria-label="Fermer"
            :disabled="busy"
            @click="onClose"
          >
            <X class="size-3.5" />
          </button>
        </header>
        <div class="relative flex min-h-0 flex-1 flex-col">
          <div class="flex-1 overflow-y-auto p-4" :class="busy ? 'pointer-events-none' : ''">
            <slot />
          </div>
          <footer v-if="$slots.footer" class="border-t border-border/70 px-4 py-3" :class="busy ? 'pointer-events-none' : ''">
            <slot name="footer" />
          </footer>
          <div
            v-if="busy"
            class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-card/80 backdrop-blur-[2px]"
          >
            <Loader2 class="size-6 animate-spin text-muted-foreground" />
            <p class="text-[13px] font-medium text-muted-foreground">Enregistrement…</p>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
