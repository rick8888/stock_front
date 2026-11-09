<script setup lang="ts">
import { cn } from '@/lib/utils'
defineProps<{ class?: string }>()
</script>

<template>
  <label :class="cn('text-[13px] font-medium leading-none text-foreground', $props.class)"><slot /></label>
</template>
