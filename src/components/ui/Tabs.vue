<script setup lang="ts">
defineProps<{ tabs: { id: string; label: string }[]; modelValue: string }>()
defineEmits<{ 'update:modelValue': [id: string] }>()
</script>

<template>
  <div class="flex gap-0.5 overflow-x-auto border-b border-border/70">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      class="relative shrink-0 px-3 py-2 text-[13px] transition-colors duration-150"
      :class="
        modelValue === tab.id
          ? 'font-medium text-foreground'
          : 'text-muted-foreground hover:text-foreground'
      "
      @click="$emit('update:modelValue', tab.id)"
    >
      {{ tab.label }}
      <span
        v-if="modelValue === tab.id"
        class="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-foreground"
      />
    </button>
  </div>
</template>
