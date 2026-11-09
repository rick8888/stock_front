<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { Sparkles } from 'lucide-vue-next'
import ProposedActionCard from './ProposedActionCard.vue'
import Avatar from '@/components/ui/Avatar.vue'
import Badge from '@/components/ui/Badge.vue'
import { formatTime } from '@/lib/utils'
import { useCurrentUser } from '@/composables/useAuth'
import type { AssistantInsight, AssistantMessage, ProposedAction } from '@/types'

const props = defineProps<{
  messages: AssistantMessage[]
  loading: boolean
}>()
defineEmits<{
  send: [text: string]
  confirm: [action: ProposedAction]
  cancel: []
  suggestion: [text: string]
}>()

const { currentUser } = useCurrentUser()
const bottom = ref<HTMLElement | null>(null)

watch(
  () => [props.messages.length, props.loading],
  async () => {
    await nextTick()
    bottom.value?.scrollIntoView({ behavior: 'smooth' })
  },
)

function insightClass(tone: AssistantInsight['tone']) {
  if (tone === 'critical') return 'border-l-red-500 bg-red-50/80'
  if (tone === 'warning') return 'border-l-amber-500 bg-amber-50/80'
  return 'border-l-blue-500 bg-blue-50/70'
}

function insightBadge(tone: AssistantInsight['tone']) {
  if (tone === 'critical') return 'critical'
  if (tone === 'warning') return 'warning'
  return 'info'
}
</script>

<template>
  <div class="flex flex-1 flex-col gap-4 overflow-y-auto pr-1">
    <article
      v-for="message in messages"
      :key="message.id"
      class="flex gap-3"
      :class="message.role === 'user' ? 'justify-end' : 'items-start'"
    >
      <div
        v-if="message.role === 'assistant'"
        class="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
      >
        <Sparkles class="size-3.5" />
      </div>
      <div
        class="max-w-[min(100%,36rem)] text-[13px] leading-relaxed"
        :class="message.role === 'user' ? 'order-1' : ''"
      >
        <div
          class="rounded-lg px-3.5 py-2.5"
          :class="
            message.role === 'user'
              ? 'rounded-br-sm bg-button text-button-foreground'
              : 'rounded-bl-sm bg-muted/80'
          "
        >
          <p class="whitespace-pre-wrap">{{ message.content }}</p>
          <div v-if="message.insights?.length" class="mt-3 space-y-2">
            <article
              v-for="insight in message.insights"
              :key="insight.title"
              class="rounded-md border border-l-2 bg-card px-3 py-2 text-foreground"
              :class="insightClass(insight.tone)"
            >
              <div class="flex flex-wrap items-center gap-2">
                <p class="text-[13px] font-medium">{{ insight.title }}</p>
                <Badge :variant="insightBadge(insight.tone)">
                  {{ insight.tone === 'critical' ? 'Critique' : insight.tone === 'warning' ? 'À surveiller' : 'Info' }}
                </Badge>
              </div>
              <p class="mt-1 text-[11px] text-muted-foreground">{{ insight.detail }}</p>
            </article>
          </div>
          <ProposedActionCard
            v-if="message.proposedAction"
            :action="message.proposedAction"
            :loading="loading"
            @confirm="$emit('confirm', message.proposedAction)"
            @cancel="$emit('cancel')"
          />
          <div v-if="message.suggestions?.length" class="mt-3 flex flex-wrap gap-1.5">
            <button
              v-for="item in message.suggestions"
              :key="item"
              class="chip border-border/60 bg-card/80 text-foreground hover:bg-muted"
              @click="$emit('suggestion', item)"
            >
              {{ item }}
            </button>
          </div>
        </div>
        <p
          class="mt-1 text-[11px] text-muted-foreground"
          :class="message.role === 'user' ? 'text-right' : ''"
        >
          {{ formatTime(message.createdAt) }}
        </p>
      </div>
      <Avatar
        v-if="message.role === 'user' && currentUser"
        :first-name="currentUser.firstName"
        :last-name="currentUser.lastName"
        :hue="currentUser.avatarHue"
        class="size-7 text-[10px]"
      />
    </article>

    <div v-if="loading" class="flex items-start gap-3">
      <div class="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Sparkles class="size-3.5" />
      </div>
      <div class="rounded-2xl rounded-bl-md bg-muted/80 px-4 py-3">
        <p class="sr-only">L’assistant réfléchit</p>
        <span class="flex items-center gap-1">
          <span class="size-1.5 animate-bounce rounded-full bg-muted-foreground/70" />
          <span class="size-1.5 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:150ms]" />
          <span class="size-1.5 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:300ms]" />
        </span>
      </div>
    </div>
    <div ref="bottom" />
  </div>
</template>
