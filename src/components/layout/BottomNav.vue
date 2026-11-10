<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'
import { Sun, CheckSquare, Bell, Package } from 'lucide-vue-next'
import { usePermissions } from '@/composables/usePermissions'
import { cn } from '@/lib/utils'

const route = useRoute()
const { can, hasModule } = usePermissions()

const items = [
  { to: '/today', label: 'Aujourd’hui', icon: Sun },
  { to: '/tasks', label: 'Tâches', icon: CheckSquare },
  { to: '/stock', label: 'Magasin', icon: Package, hide: () => !can('stock.view') || !hasModule('stock') },
  { to: '/alerts', label: 'Alertes', icon: Bell },
]
</script>

<template>
  <nav class="fixed inset-x-0 bottom-0 z-40 flex border-t border-border/70 bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden">
    <RouterLink
      v-for="item in items.filter((entry) => !entry.hide || !entry.hide())"
      :key="item.label"
      :to="item.to"
      :class="
        cn(
          'flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
          route.path.startsWith(item.to) ? 'text-foreground' : 'text-muted-foreground',
        )
      "
    >
      <span
        class="flex size-7 items-center justify-center rounded-md transition-colors"
        :class="route.path.startsWith(item.to) ? 'bg-muted text-foreground' : ''"
      >
        <component :is="item.icon" class="size-3.5" />
      </span>
      {{ item.label }}
    </RouterLink>
  </nav>
</template>
