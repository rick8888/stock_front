<script setup lang="ts">
import { Menu, Search, LogOut, Sparkles } from 'lucide-vue-next'
import Button from '@/components/ui/Button.vue'
import Avatar from '@/components/ui/Avatar.vue'
import NotificationBell from '@/components/common/NotificationBell.vue'
import ThemeToggle from '@/components/common/ThemeToggle.vue'
import { useUiStore } from '@/stores/ui'
import { useAuth, useCurrentUser } from '@/composables/useAuth'

const ui = useUiStore()
const { logout, loading } = useAuth()
const { currentUser, displayName } = useCurrentUser()
</script>

<template>
  <header class="flex h-12 shrink-0 items-center gap-2 border-b border-border/60 bg-card/80 px-3 backdrop-blur-md md:px-5">
    <Button variant="ghost" size="icon" class="md:hidden" @click="ui.sidebarOpen = true">
      <Menu class="size-4" />
    </Button>

    <button
      v-if="currentUser?.role !== 'SUPER_ADMIN' && currentUser?.role !== 'TENANT_OWNER'"
      class="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md border border-border/70 bg-muted/40 px-3 text-left text-[13px] text-muted-foreground transition-colors hover:bg-muted/70 md:max-w-md"
      @click="ui.commandOpen = true"
    >
      <Search class="size-3.5 shrink-0 opacity-70" />
      <span class="truncate">Rechercher un produit, une commande…</span>
      <kbd class="kbd ml-auto hidden sm:inline">Ctrl K</kbd>
    </button>

    <div class="ml-auto flex items-center gap-0.5">
      <ThemeToggle />
      <Button
        v-if="currentUser?.role !== 'SUPER_ADMIN' && currentUser?.role !== 'TENANT_OWNER'"
        variant="ghost"
        size="icon"
        @click="ui.openAssistant()"
      >
        <Sparkles class="size-3.5" />
      </Button>
      <NotificationBell v-if="currentUser?.role !== 'SUPER_ADMIN' && currentUser?.role !== 'TENANT_OWNER'" />
      <div v-if="currentUser" class="ml-1.5 flex items-center gap-2 border-l border-border/70 pl-2.5">
        <Avatar :first-name="currentUser.firstName" :last-name="currentUser.lastName" :hue="currentUser.avatarHue" />
        <div class="hidden lg:block">
          <p class="text-[12px] font-medium leading-none">{{ displayName }}</p>
          <p class="mt-1 text-[11px] text-muted-foreground">{{ currentUser.title }}</p>
        </div>
        <Button variant="ghost" size="icon" :loading="loading" @click="logout">
          <LogOut v-if="!loading" class="size-3.5" />
        </Button>
      </div>
    </div>
  </header>
</template>
