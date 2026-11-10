<script setup lang="ts">
import { CloudOff, RefreshCw, Wifi } from 'lucide-vue-next'
import Button from '@/components/ui/Button.vue'
import { useOfflineStatus } from '@/stores/offline'

const offline = useOfflineStatus()
</script>

<template>
  <div
    v-if="!offline.online || offline.pending"
    class="border-b px-4 py-2 text-[12px]"
    :class="!offline.online ? 'border-amber-200 bg-amber-50 text-amber-950' : 'border-sky-200 bg-sky-50 text-sky-950'"
  >
    <div class="flex flex-wrap items-center justify-between gap-2">
      <p class="flex items-center gap-2 font-medium">
        <CloudOff v-if="!offline.online" class="size-3.5 shrink-0" />
        <Wifi v-else class="size-3.5 shrink-0" />
        <span v-if="!offline.online">Mode hors ligne — POD et inventaire restent possibles.</span>
        <span v-else>{{ offline.pending }} action(s) en attente de sync.</span>
      </p>
      <Button
        v-if="offline.online && offline.pending"
        size="sm"
        variant="outline"
        class="h-7"
        :loading="offline.syncing"
        @click="offline.syncNow()"
      >
        <RefreshCw v-if="!offline.syncing" class="size-3.5" />
        Synchroniser
      </Button>
    </div>
    <p v-if="offline.lastSyncMessage" class="mt-1 text-[11px] opacity-80">{{ offline.lastSyncMessage }}</p>
  </div>
</template>
