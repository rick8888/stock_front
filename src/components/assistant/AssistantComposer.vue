<script setup lang="ts">
import { ref } from 'vue'
import { Send } from 'lucide-vue-next'
import Button from '@/components/ui/Button.vue'

defineProps<{ disabled?: boolean; placeholder?: string }>()
const emit = defineEmits<{ send: [text: string] }>()
const text = ref('')

function submit() {
  if (!text.value.trim()) return
  emit('send', text.value)
  text.value = ''
}
</script>

<template>
  <form class="flex items-end gap-2 rounded-md border bg-muted/30 p-2 pl-4 shadow-soft" @submit.prevent="submit">
    <input
      v-model="text"
      :disabled="disabled"
      class="min-h-10 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-60"
      :placeholder="placeholder ?? 'Demandez ce qui se passe, ou ce qu’il faut faire…'"
    />
    <Button type="submit" size="icon" class="shrink-0" :loading="disabled" :disabled="!text.trim()">
      <Send v-if="!disabled" class="size-4" />
    </Button>
  </form>
</template>
