<script setup lang="ts">
import Badge from '@/components/ui/Badge.vue'
import type { StockHealth } from '@/types'

const props = defineProps<{ status: StockHealth; onOrder?: boolean }>()

const labels: Record<StockHealth, string> = {
  critical: 'Critique',
  watch: 'À surveiller',
  on_order: 'Commande en cours',
  normal: 'Normal',
}

const variants: Record<StockHealth, 'critical' | 'warning' | 'onorder' | 'success'> = {
  critical: 'critical',
  watch: 'warning',
  on_order: 'onorder',
  normal: 'success',
}
</script>

<template>
  <span class="inline-flex flex-wrap items-center gap-1">
    <Badge :variant="variants[status]">{{ labels[status] }}</Badge>
    <Badge v-if="onOrder && status !== 'on_order'" variant="onorder">Commande en cours</Badge>
  </span>
</template>
