<script setup lang="ts">
defineProps<{
  bars: { label: string; value: number; color?: string }[]
}>()
</script>

<template>
  <div class="flex h-40 items-end gap-4">
    <div v-for="bar in bars" :key="bar.label" class="flex min-w-0 flex-1 flex-col items-center gap-2">
      <div class="flex h-32 w-full items-end justify-center">
        <div
          class="w-9 rounded-t-md"
          :style="{
            height: `${Math.max(8, bar.value)}%`,
            background: bar.color ?? 'hsl(var(--primary))',
          }"
        />
      </div>
      <span class="w-full truncate text-center text-[11px] text-muted-foreground">{{ bar.label }}</span>
    </div>
  </div>
</template>
