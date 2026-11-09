<script setup lang="ts">
import { computed } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { useToday } from '@/composables/useToday'
import { useTasks } from '@/composables/useWork'
import { useActionBusy } from '@/composables/useActionBusy'
import { useCurrentUser } from '@/composables/useAuth'
import AttentionCard from '@/components/common/AttentionCard.vue'
import SectionCard from '@/components/common/SectionCard.vue'
import PageSkeleton from '@/components/feedback/PageSkeleton.vue'
import EmptyState from '@/components/feedback/EmptyState.vue'
import ErrorState from '@/components/feedback/ErrorState.vue'
import Badge from '@/components/ui/Badge.vue'
import { formatTime } from '@/lib/utils'

const { brief, loading, error, greeting } = useToday()
const { completeTask } = useTasks()
const { run, isBusy, busy } = useActionBusy()

async function onComplete(id: string) {
  await run(async () => {
    await completeTask(id)
  }, `task-${id}`)
}
const { currentUser } = useCurrentUser()
const router = useRouter()

const queue = computed(() => brief.value?.queue ?? [])

const metrics = computed(() => {
  const stock = brief.value?.watchStock ?? []
  const critical = stock.filter((row) => row.tone === 'critical').length
  const watch = stock.length
  const tasks = brief.value?.tasks.filter((task) => task.status !== 'done').length ?? 0
  return [
    { label: 'À traiter', value: queue.value.length },
    { label: 'Tâches', value: tasks },
    { label: 'Stock critique', value: critical },
    { label: 'À surveiller', value: watch },
  ]
})

function open(to?: string) {
  if (to) void router.push(to)
}

function openStock(productId: string, warehouseId: string) {
  void router.push({ path: '/stock', query: { article: productId, warehouse: warehouseId } })
}
</script>

<template>
  <div class="page-wide">
    <header class="mb-5">
      <h1 class="page-title">{{ greeting }}</h1>
      <p class="page-desc">
        {{ queue.length ? `${queue.length} action${queue.length > 1 ? 's' : ''} à enchaîner.` : 'Rien à traiter pour le moment.' }}
        <span v-if="currentUser?.title" class="text-muted-foreground/80"> · {{ currentUser.title }}</span>
      </p>
    </header>

    <PageSkeleton v-if="loading" />
    <ErrorState v-else-if="error" :message="error" />
    <div v-else-if="brief" class="space-y-5">
      <div class="metric-strip sm:grid-cols-2 xl:grid-cols-4">
        <div v-for="metric in metrics" :key="metric.label" class="metric-item">
          <p class="metric-label">{{ metric.label }}</p>
          <p class="metric-value tabular-nums">{{ metric.value }}</p>
        </div>
      </div>

      <div class="grid items-start gap-5 lg:grid-cols-12">
        <div class="lg:col-span-8">
          <SectionCard :title="queue.length ? 'À faire maintenant' : 'File du jour'">
            <div v-if="queue.length" class="divide-y divide-border/60 -mx-4 -my-3">
              <div v-for="item in queue" :key="item.id" class="px-4">
                <AttentionCard
                  :title="item.title"
                  :detail="item.detail"
                  :tone="item.tone"
                  :action-label="item.primaryLabel"
                  @action="open(item.primaryTo)"
                />
              </div>
            </div>
            <EmptyState v-else title="C’est calme" description="Dès qu’une réception, un écart ou une rupture arrive, elle s’affiche ici." />
          </SectionCard>
        </div>

        <div class="space-y-5 lg:col-span-4">
          <SectionCard title="Mes actions">
            <div v-if="brief.tasks.length" class="space-y-0.5">
              <label
                v-for="task in brief.tasks"
                :key="task.id"
                class="flex cursor-pointer items-start gap-2.5 rounded-md px-1 py-1.5 transition-colors hover:bg-muted/50"
                :class="busy ? 'pointer-events-none opacity-70' : ''"
              >
                <span class="mt-0.5 flex size-4 shrink-0 items-center justify-center">
                  <Loader2 v-if="isBusy(`task-${task.id}`)" class="size-3.5 animate-spin text-muted-foreground" />
                  <input
                    v-else
                    type="checkbox"
                    class="size-3.5 rounded border-input text-primary"
                    :checked="task.status === 'done'"
                    :disabled="task.status === 'done'"
                    @change="onComplete(task.id)"
                  />
                </span>
                <span class="min-w-0 flex-1 text-[13px] leading-snug">{{ task.title }}</span>
                <span class="shrink-0 text-[11px] tabular-nums text-muted-foreground">{{ formatTime(task.dueAt) }}</span>
              </label>
            </div>
            <p v-else class="text-[13px] text-muted-foreground">Pas de tâche pour aujourd’hui.</p>
          </SectionCard>

          <SectionCard v-if="brief.watchStock.length" title="Stock à surveiller">
            <div class="divide-y divide-border/60 -mx-4 -my-3">
              <button
                v-for="row in brief.watchStock"
                :key="row.productId + row.warehouseId"
                type="button"
                class="flex w-full items-start justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/40"
                @click="openStock(row.productId, row.warehouseId)"
              >
                <div class="min-w-0">
                  <p class="text-[13px] font-medium">{{ row.productName }}</p>
                  <p class="mt-0.5 text-[11px] text-muted-foreground">{{ row.warehouseName }} · {{ row.quantity }} u.</p>
                </div>
                <Badge :variant="row.tone === 'critical' ? 'critical' : 'warning'">{{ row.days }} j</Badge>
              </button>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  </div>
</template>
