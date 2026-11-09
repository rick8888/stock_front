<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { navSectionsFor } from '@/config/navigation'
import { usePermissions } from '@/composables/usePermissions'
import { useCurrentUser } from '@/composables/useAuth'
import { useNavCounts } from '@/composables/useNavCounts'
import { useRoleTheme } from '@/composables/useRoleTheme'
import Avatar from '@/components/ui/Avatar.vue'
import { cn } from '@/lib/utils'

const { can } = usePermissions()
const { currentUser, displayName } = useCurrentUser()
const route = useRoute()
const counts = useNavCounts()
const theme = useRoleTheme()

const roleBadge = computed(() => {
  const role = currentUser.value?.role
  if (role === 'FINANCE') return 'Finance'
  if (role === 'SUPER_ADMIN') return 'Plateforme'
  if (role === 'TENANT_OWNER') return 'Compte'
  if (role === 'ADMIN') return 'Admin'
  return 'Opérations'
})

const sections = computed(() =>
  navSectionsFor(currentUser.value?.role)
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.permission || can(item.permission)),
    }))
    .filter((section) => section.items.length),
)

function active(to: string, query?: Record<string, string>) {
  const pathOk = route.path === to || (to === '/analytics' && route.path.startsWith('/analytics'))
  if (!pathOk) return false
  const expected = query ?? {}
  const keys = Object.keys(expected)
  if (!keys.length) {
    if (to === '/stock') return !route.query.tab || route.query.tab === 'overview'
    if (to === '/admin') return !route.query.tab || route.query.tab === 'today'
    if (to === '/platform') return !route.query.tab
    if (to === '/account') return !route.query.tab
    if (to === '/finance') return !route.query.view
    if (to === '/procurement') return !route.query.tab || route.query.tab === 'requests'
    return true
  }
  return keys.every((key) => String(route.query[key] ?? '') === expected[key])
}

function badgeValue(kind?: 'tasks' | 'alerts') {
  if (kind === 'tasks') return counts.tasks.value
  if (kind === 'alerts') return counts.alerts.value
  return 0
}
</script>

<template>
  <aside class="hidden h-full w-[220px] shrink-0 flex-col border-r border-border/60 bg-sidebar md:flex">
    <div class="flex items-center gap-2.5 px-3.5 py-3.5">
      <div class="flex size-7 items-center justify-center rounded-md bg-button text-[11px] font-semibold text-button-foreground">
        B
      </div>
      <div class="min-w-0">
        <p class="truncate text-[13px] font-semibold leading-none tracking-tight">Bravo.Stock</p>
        <p
          class="mt-1.5 inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium"
          :class="
            theme === 'theme-finance'
              ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-400'
              : 'bg-muted text-muted-foreground'
          "
        >
          {{ roleBadge }}
        </p>
      </div>
    </div>

    <nav class="flex-1 space-y-5 overflow-y-auto px-2 pb-3">
      <div v-for="section in sections" :key="section.id">
        <p v-if="section.label" class="section-title mb-1.5 px-2">
          {{ section.label }}
        </p>
        <div class="space-y-0.5">
          <RouterLink
            v-for="item in section.items"
            :key="item.label"
            :to="item.query ? { path: item.to, query: item.query } : item.to"
            :class="
              cn(
                'nav-item',
                active(item.to, item.query) ? 'nav-item-active' : '',
              )
            "
          >
            <component :is="item.icon" class="size-3.5 shrink-0 opacity-70" />
            <span class="min-w-0 flex-1 truncate">{{ item.label }}</span>
            <span
              v-if="item.badge && badgeValue(item.badge)"
              class="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500/90 px-1 text-[10px] font-semibold text-white"
            >
              {{ badgeValue(item.badge) }}
            </span>
          </RouterLink>
        </div>
      </div>
    </nav>

    <div v-if="currentUser" class="mt-auto border-t border-border/60 px-3 py-3">
      <div class="flex items-center gap-2">
        <Avatar :first-name="currentUser.firstName" :last-name="currentUser.lastName" :hue="currentUser.avatarHue" />
        <div class="min-w-0">
          <p class="truncate text-[13px] font-medium leading-none">{{ displayName }}</p>
          <p class="mt-1 truncate text-[11px] text-muted-foreground">{{ currentUser.title }}</p>
        </div>
      </div>
    </div>
  </aside>
</template>
