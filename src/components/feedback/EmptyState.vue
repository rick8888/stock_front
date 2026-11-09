<script setup lang="ts">
defineProps<{ title: string; description?: string }>()
</script>

<template>
  <div class="flex flex-col items-center justify-center rounded-md border border-dashed border-border/80 px-6 py-10 text-center">
    <p class="text-[13px] font-medium">{{ title }}</p>
    <p v-if="description" class="mt-1 text-[12px] text-muted-foreground">{{ description }}</p>
    <div v-if="$slots.default" class="mt-3"><slot /></div>
  </div>
</template>
