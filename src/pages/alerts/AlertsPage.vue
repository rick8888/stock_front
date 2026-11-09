<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { AlertCircle, AlertTriangle, Info, Package, ShoppingCart, Truck, Wallet, CheckSquare, Loader2 } from 'lucide-vue-next'
import { useAlerts } from '@/composables/useWork'
import { useCurrentUser } from '@/composables/useAuth'
import { useActionBusy } from '@/composables/useActionBusy'
import PageHeader from '@/components/common/PageHeader.vue'
import PageSkeleton from '@/components/feedback/PageSkeleton.vue'
import EmptyState from '@/components/feedback/EmptyState.vue'
import Badge from '@/components/ui/Badge.vue'
import Button from '@/components/ui/Button.vue'
import { formatDateTime } from '@/lib/utils'
import { alertHref, alertsDescription } from '@/services/alert.visibility'
import type { Alert, AlertSeverity } from '@/types'

const { alerts, loading, markRead } = useAlerts()
const { currentUser } = useCurrentUser()
const { busy, run, isBusy } = useActionBusy()
const router = useRouter()
const filter = ref<'all' | AlertSeverity | 'unread'>('all')

const description = computed(() => alertsDescription(currentUser.value?.role))

const counts = computed(() => ({
  all: alerts.value.length,
  unread: alerts.value.filter((item) => !item.read).length,
  critical: alerts.value.filter((item) => item.severity === 'critical').length,
  warning: alerts.value.filter((item) => item.severity === 'warning').length,
  info: alerts.value.filter((item) => item.severity === 'info').length,
}))

const filtered = computed(() => {
  const list = [...alerts.value].sort((a, b) => {
    if (a.read !== b.read) return a.read ? 1 : -1
    const rank = { critical: 0, warning: 1, info: 2 }
    if (rank[a.severity] !== rank[b.severity]) return rank[a.severity] - rank[b.severity]
    return b.createdAt.localeCompare(a.createdAt)
  })
  if (filter.value === 'unread') return list.filter((item) => !item.read)
  if (filter.value === 'all') return list
  return list.filter((item) => item.severity === filter.value)
})

const domainLabel: Record<Alert['domain'], string> = {
  stock: 'Stock',
  procurement: 'Approvisionnement',
  logistics: 'Logistique',
  finance: 'Finance',
  task: 'Tâche',
}

const filters = computed(() => [
  { id: 'all' as const, label: 'Toutes', count: counts.value.all },
  { id: 'unread' as const, label: 'Non lues', count: counts.value.unread },
  { id: 'critical' as const, label: 'Critiques', count: counts.value.critical },
  { id: 'warning' as const, label: 'Élevées', count: counts.value.warning },
  { id: 'info' as const, label: 'Infos', count: counts.value.info },
])

function toneClass(severity: AlertSeverity, read: boolean) {
  const map = {
    critical: 'border-l-red-500',
    warning: 'border-l-amber-500',
    info: 'border-l-sky-500',
  }
  return [map[severity], read ? 'opacity-60' : ''].join(' ')
}

function iconWrap(severity: AlertSeverity) {
  return {
    critical: 'bg-red-500/10 text-red-600 dark:text-red-400',
    warning: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
    info: 'bg-sky-500/10 text-sky-700 dark:text-sky-400',
  }[severity]
}

function iconFor(severity: AlertSeverity) {
  if (severity === 'critical') return AlertCircle
  if (severity === 'warning') return AlertTriangle
  return Info
}

function domainIcon(domain: Alert['domain']) {
  if (domain === 'stock') return Package
  if (domain === 'procurement') return ShoppingCart
  if (domain === 'logistics') return Truck
  if (domain === 'finance') return Wallet
  return CheckSquare
}

function severityLabel(severity: AlertSeverity) {
  if (severity === 'critical') return 'Critique'
  if (severity === 'warning') return 'Élevé'
  return 'Info'
}

async function onMarkRead(id: string) {
  await run(async () => {
    await markRead(id)
  }, `alert-${id}`)
}

async function markAllRead() {
  await run(async () => {
    await Promise.all(alerts.value.filter((item) => !item.read).map((item) => markRead(item.id)))
  })
}
</script>

<template>
  <div class="page-wide">
    <PageHeader title="Alertes" :description="description">
      <template #actions>
        <Button v-if="counts.unread" size="sm" variant="outline" :loading="busy" @click="markAllRead">Tout marquer comme lu</Button>
      </template>
    </PageHeader>

    <PageSkeleton v-if="loading" />
    <template v-else>
      <div class="metric-strip mb-5 sm:grid-cols-3">
        <button class="metric-item" :class="filter === 'critical' ? 'bg-muted/50' : ''" @click="filter = 'critical'">
          <p class="metric-label text-red-700 dark:text-red-400">Critiques</p>
          <p class="metric-value tabular-nums text-red-700 dark:text-red-400">{{ counts.critical }}</p>
          <p class="text-[11px] text-muted-foreground">À traiter en premier</p>
        </button>
        <button class="metric-item" :class="filter === 'warning' ? 'bg-muted/50' : ''" @click="filter = 'warning'">
          <p class="metric-label text-amber-700 dark:text-amber-400">Élevées</p>
          <p class="metric-value tabular-nums text-amber-700 dark:text-amber-400">{{ counts.warning }}</p>
          <p class="text-[11px] text-muted-foreground">À surveiller aujourd’hui</p>
        </button>
        <button class="metric-item" :class="filter === 'info' ? 'bg-muted/50' : ''" @click="filter = 'info'">
          <p class="metric-label text-sky-700 dark:text-sky-400">Informations</p>
          <p class="metric-value tabular-nums text-sky-700 dark:text-sky-400">{{ counts.info }}</p>
          <p class="text-[11px] text-muted-foreground">Contexte, sans urgence</p>
        </button>
      </div>

      <div class="mb-3 flex flex-wrap gap-1.5">
        <button
          v-for="item in filters"
          :key="item.id"
          class="chip border-border/60 bg-card"
          :class="filter === item.id ? 'chip-active' : ''"
          @click="filter = item.id"
        >
          {{ item.label }}
          <span class="tabular-nums text-muted-foreground">{{ item.count }}</span>
        </button>
      </div>

      <EmptyState
        v-if="!filtered.length"
        :title="filter === 'all' ? 'Rien à signaler pour votre rôle' : 'Rien dans ce filtre'"
      />
      <div v-else class="data-list">
        <article
          v-for="alert in filtered"
          :key="alert.id"
          class="flex items-start gap-3 border-b border-border/60 border-l-2 px-3.5 py-3 last:border-b-0"
          :class="toneClass(alert.severity, alert.read)"
        >
          <div class="flex size-7 shrink-0 items-center justify-center rounded-md" :class="iconWrap(alert.severity)">
            <component :is="iconFor(alert.severity)" class="size-3.5" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-1.5">
              <h2 class="text-[13px] font-medium">{{ alert.title }}</h2>
              <Badge :variant="alert.severity === 'critical' ? 'critical' : alert.severity === 'warning' ? 'warning' : 'info'">
                {{ severityLabel(alert.severity) }}
              </Badge>
              <span v-if="!alert.read" class="size-1.5 rounded-full bg-primary" />
            </div>
            <p class="mt-1 text-[12px] text-muted-foreground">{{ alert.message }}</p>
            <div class="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span class="inline-flex items-center gap-1">
                <component :is="domainIcon(alert.domain)" class="size-3" />
                {{ domainLabel[alert.domain] }}
              </span>
              <span>·</span>
              <span>{{ formatDateTime(alert.createdAt) }}</span>
              <span v-if="alert.read">· Lue</span>
            </div>
          </div>
          <div class="flex shrink-0 flex-col items-end gap-1.5">
            <button
              class="text-[12px] font-medium text-foreground/80 hover:text-foreground"
              @click="router.push(alertHref(alert, currentUser?.role ?? 'MANAGER'))"
            >
              Voir
            </button>
            <button
              v-if="!alert.read"
              class="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-50"
              :disabled="busy"
              @click="onMarkRead(alert.id)"
            >
              <Loader2 v-if="isBusy(`alert-${alert.id}`)" class="size-3 animate-spin" />
              Marquer comme lue
            </button>
          </div>
        </article>
      </div>
    </template>
  </div>
</template>
