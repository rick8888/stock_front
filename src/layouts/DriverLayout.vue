<script setup lang="ts">
import { RouterView, RouterLink, useRoute } from 'vue-router'
import { LogOut } from 'lucide-vue-next'
import { useAuth, useCurrentUser } from '@/composables/useAuth'
import Avatar from '@/components/ui/Avatar.vue'
import Button from '@/components/ui/Button.vue'
import ThemeToggle from '@/components/common/ThemeToggle.vue'
import OfflineBanner from '@/components/common/OfflineBanner.vue'

const { logout, loading } = useAuth()
const { currentUser } = useCurrentUser()
const route = useRoute()

function navClass(to: string, view?: string) {
  const onToday = route.path === '/driver/today'
  const active =
    to === '/alerts'
      ? route.path === '/alerts'
      : view
        ? onToday && route.query.view === view
        : onToday && !route.query.view
  return active ? 'py-2 font-medium text-foreground' : 'py-2 text-muted-foreground'
}
</script>

<template>
  <div class="flex min-h-full flex-col bg-background theme-ops">
    <header class="flex h-12 items-center justify-between border-b border-border/60 px-4">
      <p class="text-[13px] font-semibold tracking-tight">BravoStock</p>
      <div class="flex items-center gap-1">
        <ThemeToggle />
        <div v-if="currentUser" class="ml-1 flex items-center gap-2 border-l border-border/70 pl-2">
          <Avatar :first-name="currentUser.firstName" :last-name="currentUser.lastName" :hue="currentUser.avatarHue" />
          <Button variant="ghost" size="icon" :loading="loading" @click="logout">
            <LogOut v-if="!loading" class="size-3.5" />
          </Button>
        </div>
      </div>
    </header>
    <OfflineBanner />
    <main class="flex-1 px-4 py-4 pb-8">
      <RouterView />
    </main>
    <nav class="sticky bottom-0 grid grid-cols-3 border-t border-border/70 bg-card/95 py-2 text-center text-[11px] font-medium backdrop-blur-md">
      <RouterLink to="/driver/today" :class="navClass('/driver/today')">Journée</RouterLink>
      <RouterLink to="/driver/today?view=routes" :class="navClass('/driver/today', 'routes')">Tournée</RouterLink>
      <RouterLink to="/alerts" :class="navClass('/alerts')">Messages</RouterLink>
    </nav>
  </div>
</template>
