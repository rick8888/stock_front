<script setup lang="ts">
import Button from '@/components/ui/Button.vue'
import type { ProposedAction } from '@/types'

defineProps<{ action: ProposedAction; loading?: boolean }>()
defineEmits<{ confirm: []; cancel: [] }>()
</script>

<template>
  <div class="mt-3 rounded-xl border border-primary/20 bg-card p-3">
    <p class="text-[11px] font-semibold uppercase tracking-wide text-primary">Action proposée</p>
    <p class="mt-1 text-sm font-medium">{{ action.summary }}</p>
    <dl class="mt-2 space-y-1.5 text-sm">
      <div v-for="field in action.fields" :key="field.key" class="flex justify-between gap-4">
        <dt class="text-muted-foreground">{{ field.label }}</dt>
        <dd class="text-right font-medium">{{ field.value }}</dd>
      </div>
    </dl>
    <div class="mt-3 flex gap-2">
      <Button size="sm" variant="outline" :disabled="loading" @click="$emit('cancel')">Annuler</Button>
      <Button size="sm" :loading="loading" @click="$emit('confirm')">Confirmer</Button>
    </div>
  </div>
</template>
