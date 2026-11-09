<script setup lang="ts">
defineProps<{ title: string; actionLabel?: string }>()
defineEmits<{ action: [] }>()
</script>

<template>
  <section class="section-panel">
    <div class="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-2.5">
      <h2 class="text-[13px] font-semibold tracking-tight">{{ title }}</h2>
      <button
        v-if="actionLabel"
        class="text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        @click="$emit('action')"
      >
        {{ actionLabel }}
      </button>
    </div>
    <div class="px-4 py-3">
      <slot />
    </div>
  </section>
</template>
