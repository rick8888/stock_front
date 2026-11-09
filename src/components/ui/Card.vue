<script setup lang="ts">
import { cn } from '@/lib/utils'
defineProps<{ class?: string }>()
</script>

<template>
  <div :class="cn('rounded-md border border-border/70 bg-card text-card-foreground', $props.class)">
    <slot />
  </div>
</template>
