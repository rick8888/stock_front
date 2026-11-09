<script setup lang="ts">
import { provide } from 'vue'
import { RouterView } from 'vue-router'
import { Toaster } from 'vue-sonner'
import ActionBusyBar from '@/components/feedback/ActionBusyBar.vue'
import { ACTION_BUSY_KEY, useGlobalBusy } from '@/composables/useActionBusy'

const { busy } = useGlobalBusy()
provide(ACTION_BUSY_KEY, busy)
</script>

<template>
  <RouterView />
  <ActionBusyBar />
  <Toaster position="top-right" rich-colors />
</template>
