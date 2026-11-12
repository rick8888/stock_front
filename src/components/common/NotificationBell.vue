<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { Bell } from 'lucide-vue-next'
import { notificationService } from '@/services/notification.service'
import Button from '@/components/ui/Button.vue'
import type { AppNotification } from '@/types'

const open = ref(false)
const loading = ref(false)
const items = ref<AppNotification[]>([])
const unread = computed(() => items.value.filter((item) => !item.read).length)

async function refresh(silent = true) {
  if (!silent) loading.value = true
  try {
    items.value = await notificationService.list()
  } catch {
    if (!silent) items.value = []
  } finally {
    loading.value = false
  }
}

async function markAll() {
  await notificationService.markAllRead()
  items.value = items.value.map((item) => ({ ...item, read: true }))
  open.value = false
}

async function markOne(id: string) {
  const row = items.value.find((item) => item.id === id)
  if (!row || row.read) return
  await notificationService.markRead(id)
  row.read = true
}

watch(open, (value) => {
  if (value) void refresh(true)
})

let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  void refresh(false)
  timer = setInterval(() => {
    if (!open.value) void refresh(true)
  }, 45_000)
})
onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <div class="relative">
    <Button variant="ghost" size="icon" class="relative" @click="open = !open">
      <Bell class="size-3.5" />
      <span
        v-if="unread"
        class="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-semibold text-white"
      >
        {{ unread > 9 ? '9+' : unread }}
      </span>
    </Button>
    <div v-if="open" class="absolute right-0 z-30 mt-1.5 w-80 overflow-hidden rounded-md border border-border/70 bg-popover p-1.5 shadow-pop">
      <div class="mb-1 flex items-center justify-between px-2 py-1.5">
        <p class="text-[13px] font-medium">Notifications</p>
        <button class="text-[11px] text-muted-foreground hover:text-foreground" @click="markAll">Tout lire</button>
      </div>
      <p v-if="loading && !items.length" class="px-2 py-3 text-[12px] text-muted-foreground">Chargement…</p>
      <p v-else-if="!items.length" class="px-2 py-3 text-[12px] text-muted-foreground">Aucune notification.</p>
      <button
        v-for="item in items.slice(0, 8)"
        :key="item.id"
        class="w-full rounded-md px-2 py-2 text-left transition-colors hover:bg-muted"
        :class="item.read ? 'opacity-60' : ''"
        @click="markOne(item.id)"
      >
        <p class="text-[13px] font-medium">{{ item.title }}</p>
        <p class="mt-0.5 text-[11px] text-muted-foreground">{{ item.message }}</p>
      </button>
    </div>
  </div>
</template>
