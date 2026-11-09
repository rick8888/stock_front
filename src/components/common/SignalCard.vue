<script setup lang="ts">
import { cn } from '@/lib/utils'
import type { AlertSeverity } from '@/types'
import type { Component } from 'vue'

defineProps<{
  label: string
  value: number | string
  trend?: string
  trendUp?: boolean
  tone?: AlertSeverity | 'success'
  icon?: Component
  class?: string
}>()
</script>

<template>
  <article :class="cn('metric-item', $props.class)">
    <div class="flex items-center justify-between gap-2">
      <p class="metric-label">{{ label }}</p>
      <component :is="icon" v-if="icon" class="size-3.5 shrink-0 text-muted-foreground/60" />
    </div>
    <p
      class="metric-value tabular-nums"
      :class="{
        'text-red-600 dark:text-red-400': tone === 'critical',
        'text-amber-700 dark:text-amber-400': tone === 'warning',
        'text-emerald-700 dark:text-emerald-400': tone === 'success',
      }"
    >
      {{ value }}
    </p>
    <p
      v-if="trend"
      class="text-[11px] text-muted-foreground"
      :class="trendUp ? 'text-emerald-600 dark:text-emerald-400' : ''"
    >
      {{ trend }}
    </p>
  </article>
</template>
