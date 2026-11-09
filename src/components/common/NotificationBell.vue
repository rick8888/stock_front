<script setup lang="ts">
import { computed, ref } from 'vue'
import { Bell } from 'lucide-vue-next'
import { useDataStore } from '@/stores/data'
import { useCurrentUser } from '@/composables/useAuth'
import Button from '@/components/ui/Button.vue'

const store = useDataStore()
const { currentUser } = useCurrentUser()
const open = ref(false)
const items = computed(() =>
  store.db.notifications.filter((item) => !item.userId || item.userId === currentUser.value?.id),
)
const unread = computed(() => items.value.filter((item) => !item.read).length)

function markAll() {
  items.value.forEach((item) => {
    item.read = true
  })
  store.persist()
  open.value = false
}
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
      <button
        v-for="item in items.slice(0, 6)"
        :key="item.id"
        class="w-full rounded-md px-2 py-2 text-left transition-colors hover:bg-muted"
        :class="item.read ? 'opacity-60' : ''"
      >
        <p class="text-[13px] font-medium">{{ item.title }}</p>
        <p class="mt-0.5 text-[11px] text-muted-foreground">{{ item.message }}</p>
      </button>
    </div>
  </div>
</template>
