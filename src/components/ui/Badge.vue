<script setup lang="ts">
import { cn } from '@/lib/utils'
withDefaults(
  defineProps<{
    variant?: 'default' | 'secondary' | 'outline' | 'critical' | 'warning' | 'success' | 'info' | 'onorder'
    class?: string
  }>(),
  { variant: 'default' },
)
</script>

<template>
  <span
    :class="
      cn(
        'inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium leading-none tracking-tight',
        {
          'bg-secondary text-secondary-foreground': variant === 'default' || variant === 'secondary',
          'border border-border/80 bg-transparent text-muted-foreground': variant === 'outline',
          'bg-red-500/10 text-red-700 dark:text-red-400': variant === 'critical',
          'bg-amber-500/10 text-amber-800 dark:text-amber-400': variant === 'warning',
          'bg-emerald-500/10 text-emerald-800 dark:text-emerald-400': variant === 'success',
          'bg-sky-500/10 text-sky-800 dark:text-sky-400': variant === 'info',
          'bg-blue-500/10 text-blue-800 dark:text-blue-400': variant === 'onorder',
        },
        $props.class,
      )
    "
  >
    <slot />
  </span>
</template>
