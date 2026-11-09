<script setup lang="ts">
import { computed } from 'vue'
import Badge from '@/components/ui/Badge.vue'
import { ORDER_LABEL } from '@/services/order.overview'

const props = defineProps<{ status: string; late?: boolean }>()
const key = computed(() => (props.late && !['received', 'cancelled'].includes(props.status) ? 'delayed' : props.status))
const variant = computed(() =>
  key.value === 'delayed' || key.value === 'cancelled'
    ? 'critical'
    : key.value === 'sent' || key.value === 'partial'
      ? 'warning'
      : key.value === 'confirmed'
        ? 'onorder'
        : key.value === 'received'
          ? 'success'
          : 'outline',
)
</script>

<template>
  <Badge :variant="variant">{{ ORDER_LABEL[key] ?? status }}</Badge>
</template>
