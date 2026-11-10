<script setup lang="ts">
import { RouterView } from 'vue-router'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import AppTopbar from '@/components/layout/AppTopbar.vue'
import BottomNav from '@/components/layout/BottomNav.vue'
import GlobalSearch from '@/components/common/GlobalSearch.vue'
import OfflineBanner from '@/components/common/OfflineBanner.vue'
import Sheet from '@/components/ui/Sheet.vue'
import AssistantPanel from '@/components/assistant/AssistantPanel.vue'
import { useUiStore } from '@/stores/ui'
import { navSectionsFor } from '@/config/navigation'
import { usePermissions } from '@/composables/usePermissions'
import { useRoleTheme } from '@/composables/useRoleTheme'
import { useCurrentUser } from '@/composables/useAuth'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { cn } from '@/lib/utils'

const ui = useUiStore()
const { can } = usePermissions()
const theme = useRoleTheme()
const { currentUser } = useCurrentUser()
const isConsole = computed(() => {
  const role = currentUser.value?.role
  return role === 'SUPER_ADMIN' || role === 'TENANT_OWNER'
})
const mobileNav = computed(() =>
  navSectionsFor(currentUser.value?.role)
    .flatMap((section) => section.items)
    .filter((item) => !item.permission || can(item.permission)),
)
</script>

<template>
  <div class="flex h-full" :class="theme">
    <AppSidebar />
    <div class="flex min-w-0 flex-1 flex-col bg-background">
      <AppTopbar />
      <OfflineBanner />
      <main
        class="flex-1 overflow-y-auto px-4 py-5 md:px-6 md:pb-6"
        :class="isConsole ? 'pb-6' : 'pb-24'"
      >
        <RouterView />
      </main>
    </div>
    <BottomNav v-if="!isConsole" />
    <GlobalSearch v-if="!isConsole" />
    <Sheet v-if="!isConsole" :open="ui.assistantOpen" title="Assistant Bravo.Stock" @close="ui.closeAssistant()">
      <div class="flex h-[70vh] flex-col">
        <AssistantPanel />
      </div>
    </Sheet>
    <Sheet :open="ui.sidebarOpen" title="Menu" @close="ui.sidebarOpen = false">
      <div class="space-y-0.5">
        <RouterLink
          v-for="item in mobileNav"
          :key="item.label"
          :to="item.query ? { path: item.to, query: item.query } : item.to"
          :class="
            cn(
              'nav-item block',
            )
          "
          @click="ui.sidebarOpen = false"
        >
          {{ item.label }}
        </RouterLink>
      </div>
    </Sheet>
  </div>
</template>
