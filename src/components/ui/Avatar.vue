<script setup lang="ts">
import { computed } from 'vue'
import { cn, initials } from '@/lib/utils'

const props = defineProps<{ firstName: string; lastName: string; hue?: number; class?: string }>()
const label = computed(() => initials(props.firstName, props.lastName))
</script>

<template>
  <div
    :class="
      cn(
        'flex size-7 items-center justify-center rounded-full text-[10px] font-semibold text-white ring-1 ring-black/5 dark:ring-white/10',
        $props.class,
      )
    "
    :style="{ background: `hsl(${hue ?? 222} 42% 42%)` }"
  >
    {{ label }}
  </div>
</template>
