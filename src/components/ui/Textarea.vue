<script setup lang="ts">
import { cn } from '@/lib/utils'
defineProps<{ class?: string; placeholder?: string; modelValue?: string; rows?: number }>()
defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <textarea
    :rows="rows ?? 3"
    :placeholder="placeholder"
    :value="modelValue"
    :class="
      cn(
        'flex min-h-[72px] w-full rounded-md border border-input bg-card px-2.5 py-2 text-[13px] transition-shadow duration-150 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
        $props.class,
      )
    "
    @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
  />
</template>
