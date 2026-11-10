import { defineStore } from 'pinia'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useOnline } from '@vueuse/core'
import { listOutbox, outboxCount, type OutboxEntry } from '@/offline/outbox'
import { flushOutbox } from '@/offline/sync'
import { onDataChanged } from '@/utils/events'

export const useOfflineStore = defineStore('offline', () => {
  const online = useOnline()
  const queue = ref<OutboxEntry[]>(listOutbox())
  const syncing = ref(false)
  const lastSyncMessage = ref('')

  function refreshQueue() {
    queue.value = listOutbox()
  }

  async function syncNow() {
    if (!online.value) {
      lastSyncMessage.value = 'Toujours hors ligne'
      return
    }
    syncing.value = true
    try {
      const result = await flushOutbox()
      refreshQueue()
      if (result.sent) lastSyncMessage.value = `${result.sent} action(s) synchronisée(s)`
      else if (result.failed) lastSyncMessage.value = 'Synchronisation partielle — nouvel essai bientôt'
      else lastSyncMessage.value = 'Rien à synchroniser'
    } finally {
      syncing.value = false
    }
  }

  return {
    online,
    queue: computed(() => queue.value),
    pending: computed(() => queue.value.length || outboxCount()),
    syncing: computed(() => syncing.value),
    lastSyncMessage: computed(() => lastSyncMessage.value),
    refreshQueue,
    syncNow,
  }
})

/** Bind queue listeners from layouts / banner. Sync watch starts in main.ts. */
export function useOfflineStatus() {
  const store = useOfflineStore()
  let stopData: (() => void) | undefined

  onMounted(() => {
    store.refreshQueue()
    stopData = onDataChanged(() => store.refreshQueue())
  })

  onUnmounted(() => {
    stopData?.()
  })

  return store
}
