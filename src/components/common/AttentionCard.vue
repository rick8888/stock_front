<script setup lang="ts">
import Badge from '@/components/ui/Badge.vue'
import type { AlertSeverity } from '@/types'
import { AlertTriangle, Info, AlertCircle } from 'lucide-vue-next'

const props = defineProps<{
  title: string
  detail: string
  tone?: AlertSeverity
  actionLabel?: string
  secondaryLabel?: string
}>()
defineEmits<{ action: []; secondary: [] }>()

function badgeLabel(tone?: AlertSeverity) {
  if (tone === 'critical') return 'Critique'
  if (tone === 'warning') return 'Élevé'
  return 'Info'
}
</script>

<template>
  <article class="flex items-start gap-3 py-3">
    <div
      class="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md"
      :class="{
        'bg-red-500/10 text-red-600 dark:text-red-400': tone === 'critical',
        'bg-amber-500/10 text-amber-700 dark:text-amber-400': tone === 'warning',
        'bg-sky-500/10 text-sky-700 dark:text-sky-400': !tone || tone === 'info',
      }"
    >
      <AlertCircle v-if="tone === 'critical'" class="size-3.5" />
      <AlertTriangle v-else-if="tone === 'warning'" class="size-3.5" />
      <Info v-else class="size-3.5" />
    </div>
    <div class="min-w-0 flex-1">
      <div class="flex flex-wrap items-center gap-2">
        <h3 class="text-[13px] font-medium leading-tight">{{ title }}</h3>
        <Badge :variant="props.tone === 'critical' ? 'critical' : props.tone === 'warning' ? 'warning' : 'info'">
          {{ badgeLabel(tone) }}
        </Badge>
      </div>
      <p class="mt-1 text-[12px] leading-relaxed text-muted-foreground">{{ detail }}</p>
    </div>
    <div class="flex shrink-0 flex-col items-end gap-1 pt-0.5">
      <button
        v-if="actionLabel"
        class="text-[12px] font-medium text-foreground/80 transition-colors hover:text-foreground"
        @click="$emit('action')"
      >
        {{ actionLabel }}
      </button>
      <button
        v-if="secondaryLabel"
        class="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        @click="$emit('secondary')"
      >
        {{ secondaryLabel }}
      </button>
    </div>
  </article>
</template>
