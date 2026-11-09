<script setup lang="ts">
import { Loader2 } from 'lucide-vue-next'
import { cn } from '@/lib/utils'

defineProps<{ checked?: boolean; class?: string; loading?: boolean; disabled?: boolean }>()
const emit = defineEmits<{ 'update:checked': [value: boolean] }>()
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="checked"
    :aria-busy="loading"
    :disabled="disabled || loading"
    :class="
      cn(
        'relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-150 disabled:opacity-50',
        checked ? 'bg-primary' : 'bg-muted',
        $props.class,
      )
    "
    @click="!(disabled || loading) && emit('update:checked', !checked)"
  >
    <Loader2 v-if="loading" class="absolute inset-0 m-auto size-3.5 animate-spin text-primary-foreground" />
    <span
      v-else
      class="inline-block size-4 rounded-full bg-white shadow-sm transition-transform duration-150"
      :class="checked ? 'translate-x-4' : 'translate-x-0.5'"
    />
  </button>
</template>
