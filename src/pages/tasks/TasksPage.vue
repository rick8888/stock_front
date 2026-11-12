<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  Check,
  Clock3,
  ListTodo,
  Loader2,
  Package,
  Plus,
  ShoppingCart,
  Truck,
  Wallet,
} from 'lucide-vue-next'
import { useTasks } from '@/composables/useWork'
import { useCurrentUser } from '@/composables/useAuth'
import { usePermissions } from '@/composables/usePermissions'
import { useActionBusy } from '@/composables/useActionBusy'
import PageHeader from '@/components/common/PageHeader.vue'
import PageSkeleton from '@/components/feedback/PageSkeleton.vue'
import EmptyState from '@/components/feedback/EmptyState.vue'
import Badge from '@/components/ui/Badge.vue'
import Button from '@/components/ui/Button.vue'
import Sheet from '@/components/ui/Sheet.vue'
import Input from '@/components/ui/Input.vue'
import Label from '@/components/ui/Label.vue'
import Textarea from '@/components/ui/Textarea.vue'
import { formatTime } from '@/lib/utils'
import { opsToday, isoAt } from '@/utils/helpers'
import type { Task, TaskPriority } from '@/types'

const { board, loading, createTask, completeTask } = useTasks()
const { currentUser } = useCurrentUser()
const { can } = usePermissions()
const { busy, run, isBusy } = useActionBusy()
const router = useRouter()

const open = ref(false)
const title = ref('')
const description = ref('')
const priority = ref<TaskPriority>('medium')
const dueAt = ref(`${opsToday()}T18:00`)
const filter = ref<'open' | 'today' | 'overdue' | 'done'>('open')

/** Compteurs / groupes fournis par GET /tasks/board — pas de recalcul métier ici. */
const counts = computed(
  () => board.value?.counts ?? { open: 0, today: 0, overdue: 0, done: 0 },
)

const descriptionText = computed(() => {
  const role = currentUser.value?.role
  if (role === 'WAREHOUSE_MANAGER') return 'Sorties, réceptions, inventaires — ce qui reste à vos mains.'
  if (role === 'PROCUREMENT') return 'Relances fournisseurs et commandes à lancer, rien d’autre.'
  if (role === 'FINANCE') return 'Échéances et contrôles qui demandent une décision.'
  if (role === 'DISPATCHER') return 'Ce qui peut encore décaler une tournée aujourd’hui.'
  return 'Ce que vous devez faire, sans le bruit du reste.'
})

const groups = computed(() => {
  const payload = board.value
  if (!payload) return []
  if (filter.value === 'today') {
    return payload.groups.filter((group) => group.id === 'today')
  }
  if (filter.value === 'overdue') {
    return payload.groups.filter((group) => group.id === 'overdue')
  }
  if (filter.value === 'done') {
    return [{ id: 'done', title: 'Faites', items: payload.done }]
  }
  return payload.groups
})

const chips = computed(() => [
  { id: 'open' as const, label: 'À faire', count: counts.value.open },
  { id: 'today' as const, label: 'Aujourd’hui', count: counts.value.today },
  { id: 'overdue' as const, label: 'En retard', count: counts.value.overdue },
  { id: 'done' as const, label: 'Faites', count: counts.value.done },
])

function dueLabel(task: Task, groupId?: string) {
  const time = formatTime(task.dueAt)
  if (task.status === 'done' || groupId === 'done') return time
  if (groupId === 'overdue') return `En retard · ${time}`
  if (groupId === 'today') return `Aujourd’hui · ${time}`
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(
    new Date(task.dueAt),
  )
}

function priorityLabel(value: TaskPriority) {
  if (value === 'high') return 'Haute'
  if (value === 'low') return 'Basse'
  return 'Moyenne'
}

function relatedLabel(type?: string) {
  if (type === 'procurement') return 'Demande'
  if (type === 'purchase') return 'Commande'
  if (type === 'stock') return 'Stock'
  if (type === 'receipt') return 'Réception'
  if (type === 'route') return 'Tournée'
  if (type === 'shipping_note') return 'Bon de livraison'
  if (type === 'finance') return 'Finance'
  return ''
}

function relatedTo(task: Task) {
  if (task.relatedType === 'procurement') return '/procurement'
  if (task.relatedType === 'purchase') return '/procurement?tab=orders'
  if (task.relatedType === 'stock') return '/stock'
  if (task.relatedType === 'receipt') return '/procurement?tab=receipts'
  if (task.relatedType === 'route') return '/logistics'
  if (task.relatedType === 'shipping_note') return '/logistics?tab=notes'
  if (task.relatedType === 'finance') return '/finance'
  return ''
}

function relatedIcon(type?: string) {
  if (type === 'stock' || type === 'receipt') return Package
  if (type === 'purchase' || type === 'procurement') return ShoppingCart
  if (type === 'route' || type === 'shipping_note') return Truck
  if (type === 'finance') return Wallet
  return ListTodo
}

function toneClass(task: Task, groupId?: string) {
  if (task.status === 'done' || groupId === 'done') return 'border-l-transparent opacity-60'
  if (groupId === 'overdue') return 'border-l-red-500'
  if (task.priority === 'high') return 'border-l-amber-500'
  return 'border-l-transparent'
}

const priorities: { id: TaskPriority; label: string }[] = [
  { id: 'high', label: 'Haute' },
  { id: 'medium', label: 'Moyenne' },
  { id: 'low', label: 'Basse' },
]

function resetForm() {
  title.value = ''
  description.value = ''
  priority.value = 'medium'
  dueAt.value = `${opsToday()}T18:00`
}

async function add() {
  await run(async () => {
    const when = dueAt.value ? new Date(dueAt.value).toISOString() : isoAt(new Date(`${opsToday()}T00:00:00`), 18)
    await createTask(title.value.trim() || 'Nouvelle tâche', when, priority.value, description.value.trim())
    resetForm()
    open.value = false
  })
}

async function onComplete(id: string) {
  await run(async () => {
    await completeTask(id)
  }, `task-${id}`)
}
</script>

<template>
  <div class="page-wide">
    <PageHeader title="Mes tâches" :description="descriptionText">
      <template #actions>
        <Button v-if="can('task.create')" size="sm" @click="open = true">
          <Plus class="size-3.5" />
          Nouvelle tâche
        </Button>
      </template>
    </PageHeader>

    <PageSkeleton v-if="loading" />
    <template v-else>
      <div class="metric-strip mb-5 sm:grid-cols-3">
        <button class="metric-item" :class="filter === 'open' ? 'bg-muted/50' : ''" @click="filter = 'open'">
          <p class="metric-label">À faire</p>
          <p class="metric-value tabular-nums">{{ counts.open }}</p>
          <p class="text-[11px] text-muted-foreground">Encore entre vos mains</p>
        </button>
        <button class="metric-item" :class="filter === 'today' ? 'bg-muted/50' : ''" @click="filter = 'today'">
          <p class="metric-label text-amber-700 dark:text-amber-400">Aujourd’hui</p>
          <p class="metric-value tabular-nums text-amber-700 dark:text-amber-400">{{ counts.today }}</p>
          <p class="text-[11px] text-muted-foreground">À clôturer avant ce soir</p>
        </button>
        <button class="metric-item" :class="filter === 'overdue' ? 'bg-muted/50' : ''" @click="filter = 'overdue'">
          <p class="metric-label text-red-700 dark:text-red-400">En retard</p>
          <p class="metric-value tabular-nums text-red-700 dark:text-red-400">{{ counts.overdue }}</p>
          <p class="text-[11px] text-muted-foreground">À traiter en premier</p>
        </button>
      </div>

      <div class="mb-4 flex flex-wrap gap-2">
        <button
          v-for="item in chips"
          :key="item.id"
          class="chip"
          :class="
            filter === item.id
              ? 'chip-active'
              : 'border-border bg-card text-muted-foreground hover:text-foreground'
          "
          @click="filter = item.id"
        >
          {{ item.label }}
          <span class="ml-1 tabular-nums">{{ item.count }}</span>
        </button>
      </div>

      <EmptyState
        v-if="!groups.length || groups.every((group) => !group.items.length)"
        :title="filter === 'done' ? 'Aucune tâche terminée' : 'Rien à faire pour le moment'"
        description="Quand quelque chose nécessitera votre action, elle apparaîtra ici."
      >
        <Button v-if="can('task.create')" size="sm" @click="open = true">Ajouter une tâche</Button>
      </EmptyState>

      <div v-else class="space-y-5">
        <section v-for="group in groups" :key="group.id">
          <p class="section-title mb-2">{{ group.title }}</p>
          <div class="data-list">
            <article
              v-for="task in group.items"
              :key="task.id"
              class="flex items-start gap-3 border-b border-border/60 border-l-2 px-3.5 py-3 last:border-b-0"
              :class="toneClass(task, group.id)"
            >
              <button
                class="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border"
                :class="
                  task.status === 'done'
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : 'border-muted-foreground/40 bg-card hover:border-primary'
                "
                :aria-label="task.status === 'done' ? 'Terminée' : 'Marquer comme faite'"
                :disabled="task.status === 'done' || busy"
                @click="task.status !== 'done' && onComplete(task.id)"
              >
                <Loader2 v-if="isBusy(`task-${task.id}`)" class="size-3 animate-spin" />
                <Check v-else-if="task.status === 'done'" class="size-3" />
              </button>
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <h2
                    class="text-sm font-semibold"
                    :class="task.status === 'done' ? 'text-muted-foreground line-through' : ''"
                  >
                    {{ task.title }}
                  </h2>
                  <Badge
                    v-if="task.status !== 'done'"
                    :variant="task.priority === 'high' ? 'critical' : task.priority === 'medium' ? 'warning' : 'outline'"
                  >
                    {{ priorityLabel(task.priority) }}
                  </Badge>
                  <Badge v-else variant="success">Faite</Badge>
                </div>
                <p v-if="task.description" class="mt-1 text-[13px] text-muted-foreground">{{ task.description }}</p>
                <div class="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span class="inline-flex items-center gap-1">
                    <Clock3 class="size-3.5" />
                    {{ dueLabel(task, group.id) }}
                  </span>
                  <template v-if="relatedLabel(task.relatedType)">
                    <span>·</span>
                    <span class="inline-flex items-center gap-1">
                      <component :is="relatedIcon(task.relatedType)" class="size-3.5" />
                      {{ relatedLabel(task.relatedType) }}
                    </span>
                  </template>
                </div>
              </div>
              <button
                v-if="relatedTo(task) && task.status !== 'done'"
                class="shrink-0 text-xs font-medium text-primary hover:underline"
                @click="router.push(relatedTo(task))"
              >
                Ouvrir
              </button>
            </article>
          </div>
        </section>
      </div>
    </template>

    <Sheet :open="open" title="Nouvelle tâche" @close="open = false">
      <div class="space-y-4">
        <div>
          <Label>Titre</Label>
          <Input v-model="title" class="mt-1.5" placeholder="Ce qu’il faut faire" />
        </div>
        <div>
          <Label>Précision (optionnel)</Label>
          <Textarea v-model="description" class="mt-1.5" placeholder="Contexte, lieu, personne à relancer…" />
        </div>
        <div>
          <Label>Échéance</Label>
          <Input v-model="dueAt" type="datetime-local" class="mt-1.5" />
        </div>
        <div>
          <Label>Priorité</Label>
          <div class="mt-2 flex gap-2">
            <button
              v-for="item in priorities"
              :key="item.id"
              class="flex-1 rounded-lg border px-3 py-2 text-xs font-medium"
              :class="priority === item.id ? 'chip-active' : 'border border-border text-muted-foreground'"
              @click="priority = item.id"
            >
              {{ item.label }}
            </button>
          </div>
        </div>
      </div>
      <template #footer>
        <Button class="w-full" :disabled="!title.trim()" :loading="busy" @click="add">Créer</Button>
      </template>
    </Sheet>
  </div>
</template>
