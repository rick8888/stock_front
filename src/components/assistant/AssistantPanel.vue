<script setup lang="ts">
import { useAssistant } from '@/composables/useAssistant'
import { useCurrentUser } from '@/composables/useAuth'
import AssistantThread from './AssistantThread.vue'
import AssistantComposer from './AssistantComposer.vue'
import { assistantPlaceholder } from '@/config/assistant'

defineProps<{ placeholder?: string }>()

const { messages, loading, send, confirmAction, cancelAction } = useAssistant()
const { currentUser } = useCurrentUser()
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <AssistantThread
      :messages="messages"
      :loading="loading"
      @send="send"
      @confirm="confirmAction"
      @cancel="cancelAction"
      @suggestion="send"
    />
    <div class="mt-4 shrink-0">
      <AssistantComposer
        :disabled="loading"
        :placeholder="placeholder ?? assistantPlaceholder(currentUser?.role)"
        @send="send"
      />
    </div>
  </div>
</template>
