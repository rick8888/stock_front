<script setup lang="ts">
defineProps<{ open: boolean; title?: string }>()
defineEmits<{ close: [] }>()
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/40 backdrop-blur-[1px]" @click="$emit('close')" />
      <div class="relative z-10 w-full max-w-md rounded-md border border-border/70 bg-card p-4 shadow-pop">
        <h2 v-if="title" class="mb-3 text-sm font-semibold tracking-tight">{{ title }}</h2>
        <slot />
      </div>
    </div>
  </Teleport>
</template>
