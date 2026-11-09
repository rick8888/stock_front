<script setup lang="ts">
import { cn } from '@/lib/utils'
defineProps<{ variant?: 'default' | 'destructive'; class?: string }>()
</script>

<template>
  <div
    :class="
      cn(
        'rounded-md border px-3 py-2.5 text-[13px]',
        variant === 'destructive'
          ? 'border-red-500/20 bg-red-500/10 text-red-800 dark:text-red-300'
          : 'border-border/70 bg-card text-foreground',
        $props.class,
      )
    "
  >
    <slot />
  </div>
</template>
