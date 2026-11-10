<script setup lang="ts">
import { computed } from 'vue'
import Badge from '@/components/ui/Badge.vue'
import { STATUS_LABEL, normalizeStatus } from '@/services/request.overview'

const props = defineProps<{ status: string }>()
const key = computed(() => normalizeStatus(props.status))
const variant = computed(() =>
  key.value === 'rejected'
    ? 'critical'
    : key.value === 'submitted' || key.value === 'in_review'
      ? 'warning'
      : key.value === 'approved' || key.value === 'ordered' || key.value === 'closed'
        ? 'success'
        : // Une demande périmée n'est pas un refus : elle s'est éteinte d'elle-même.
          'outline',
)
</script>

<template>
  <Badge :variant="variant">{{ STATUS_LABEL[key] ?? status }}</Badge>
</template>
