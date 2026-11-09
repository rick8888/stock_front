<script setup lang="ts">
import { computed } from 'vue'
import { Inbox, Package, RotateCcw, ShoppingCart, Truck, Users } from 'lucide-vue-next'
import AssistantPanel from '@/components/assistant/AssistantPanel.vue'
import { useAssistant } from '@/composables/useAssistant'
import { useCurrentUser } from '@/composables/useAuth'
import PageHeader from '@/components/common/PageHeader.vue'
import Button from '@/components/ui/Button.vue'
import {
  assistantPageDescription,
  assistantPlaceholder,
  assistantStarters,
} from '@/config/assistant'
import type { AssistantStarter } from '@/config/assistant'

const { messages, send, reset } = useAssistant()
const { currentUser } = useCurrentUser()

const started = computed(() => messages.value.some((item) => item.role === 'user'))
const starters = computed(() => assistantStarters(currentUser.value?.role))
const greeting = computed(() =>
  currentUser.value?.firstName ? `Bonjour ${currentUser.value.firstName}` : 'Assistant Bravo.Stock',
)

function iconFor(starter: AssistantStarter) {
  if (starter.id === 'stock') return Package
  if (starter.id === 'orders') return ShoppingCart
  if (starter.id === 'delivery') return Truck
  if (starter.id === 'suppliers') return Users
  return Inbox
}
</script>

<template>
  <div class="page-wide">
    <PageHeader :title="greeting" :description="assistantPageDescription(currentUser?.role)">
      <template #actions>
        <Button v-if="started" size="sm" variant="outline" @click="reset">
          <RotateCcw class="size-3.5" />
          Nouvelle conversation
        </Button>
      </template>
    </PageHeader>

    <div
      v-if="!started && starters.length"
      class="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
    >
      <button
        v-for="item in starters"
        :key="item.id"
        class="surface border-l-4 border-l-primary/50 p-4 text-left transition-colors hover:bg-primary/5"
        @click="send(item.prompt)"
      >
        <span class="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <component :is="iconFor(item)" class="size-3.5" />
        </span>
        <p class="mt-3 text-[13px] font-medium">{{ item.label }}</p>
        <p class="mt-1 text-[11px] text-muted-foreground">{{ item.detail }}</p>
      </button>
    </div>

    <section class="section-panel flex h-[calc(100vh-18rem)] min-h-[28rem] max-h-[40rem] flex-col p-4">
      <div class="mb-3 flex items-center gap-2 border-b border-border/60 pb-3">
        <span class="flex size-7 items-center justify-center rounded-md bg-button text-[11px] font-semibold text-button-foreground">
          B
        </span>
        <div>
          <p class="text-[13px] font-semibold tracking-tight">Bravo.Stock</p>
          <p class="text-[11px] text-muted-foreground">S’appuie sur votre stock, vos commandes, vos tournées.</p>
        </div>
      </div>
      <AssistantPanel :placeholder="assistantPlaceholder(currentUser?.role)" />
    </section>
  </div>
</template>
