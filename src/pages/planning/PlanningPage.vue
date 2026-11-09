<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { CalendarDays, ChevronLeft, ChevronRight, ClipboardCheck, Package, Truck, Users } from 'lucide-vue-next'
import { usePlanning } from '@/composables/useWork'
import { useCurrentUser } from '@/composables/useAuth'
import PageHeader from '@/components/common/PageHeader.vue'
import PageSkeleton from '@/components/feedback/PageSkeleton.vue'
import EmptyState from '@/components/feedback/EmptyState.vue'
import ErrorState from '@/components/feedback/ErrorState.vue'
import Badge from '@/components/ui/Badge.vue'
import { formatTime } from '@/lib/utils'
import { addDays, dateKey, dayKey, startOfWeek, todayIso } from '@/utils/helpers'
import type { PlanningEvent } from '@/types'

const { events, loading, error } = usePlanning()
const { currentUser } = useCurrentUser()
const router = useRouter()

const today = todayIso()
const weekOffset = ref(0)
const selectedDay = ref(today)
const typeFilter = ref<'all' | PlanningEvent['type']>('all')

const visible = computed(() => {
  const role = currentUser.value?.role
  const list = [...events.value].sort((a, b) => a.date.localeCompare(b.date))
  if (role === 'DRIVER') return list.filter((item) => item.type === 'delivery')
  if (role === 'FINANCE') return list.filter((item) => item.type === 'meeting' || item.type === 'receipt')
  if (role === 'DISPATCHER') return list.filter((item) => item.type === 'delivery' || item.type === 'task')
  if (role === 'PROCUREMENT') return list.filter((item) => item.type !== 'inventory')
  return list
})

const weekStart = computed(() => addDays(startOfWeek(new Date()), weekOffset.value * 7))

const weekDays = computed(() =>
  Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStart.value, index)
    const key = dateKey(date)
    const items = visible.value.filter((item) => dayKey(item.date) === key)
    return { key, date, count: items.length, isToday: key === today }
  }),
)

watch(weekOffset, () => {
  const keys = weekDays.value.map((day) => day.key)
  if (keys.includes(selectedDay.value)) return
  selectedDay.value = weekDays.value.find((day) => day.isToday)?.key ?? keys[0] ?? today
})

const filtered = computed(() =>
  visible.value.filter((item) => typeFilter.value === 'all' || item.type === typeFilter.value),
)

const dayEvents = computed(() =>
  filtered.value.filter((item) => dayKey(item.date) === selectedDay.value),
)

const upcoming = computed(() =>
  filtered.value.filter((item) => dayKey(item.date) >= today).slice(0, 6),
)

const todayCount = computed(() => visible.value.filter((item) => dayKey(item.date) === today).length)
const weekCount = computed(() => weekDays.value.reduce((sum, day) => sum + day.count, 0))
const nextCount = computed(() => visible.value.filter((item) => dayKey(item.date) > today).length)

const weekLabel = computed(() => {
  const start = weekDays.value[0]?.date
  const end = weekDays.value[6]?.date
  if (!start || !end) return ''
  const fmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })
  return `${fmt.format(start)} – ${fmt.format(end)}`
})

const typeMeta: Record<
  PlanningEvent['type'],
  { label: string; icon: typeof Truck; badge: 'onorder' | 'success' | 'warning' | 'info' | 'outline'; wrap: string }
> = {
  delivery: { label: 'Livraison', icon: Truck, badge: 'onorder', wrap: 'bg-blue-100 text-blue-700' },
  receipt: { label: 'Réception', icon: Package, badge: 'success', wrap: 'bg-emerald-100 text-emerald-700' },
  inventory: { label: 'Inventaire', icon: ClipboardCheck, badge: 'warning', wrap: 'bg-amber-100 text-amber-700' },
  meeting: { label: 'Point', icon: Users, badge: 'info', wrap: 'bg-indigo-100 text-indigo-700' },
  task: { label: 'Tâche', icon: CalendarDays, badge: 'outline', wrap: 'bg-muted text-muted-foreground' },
}

const typeChips = computed(() => {
  const types = (Object.keys(typeMeta) as PlanningEvent['type'][]).filter((type) =>
    visible.value.some((item) => item.type === type),
  )
  return [
    { id: 'all' as const, label: 'Tout', count: visible.value.length },
    ...types.map((type) => ({
      id: type,
      label: typeMeta[type].label,
      count: visible.value.filter((item) => item.type === type).length,
    })),
  ]
})

const selectedLabel = computed(() => {
  const day = weekDays.value.find((item) => item.key === selectedDay.value)
  if (!day) return ''
  if (day.isToday) return 'Aujourd’hui'
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(day.date)
})

const pageDescription = computed(() => {
  const role = currentUser.value?.role
  if (role === 'WAREHOUSE_MANAGER') return 'Réceptions et inventaires des prochains jours.'
  if (role === 'PROCUREMENT') return 'Arrivages et points fournisseurs à tenir.'
  if (role === 'DISPATCHER') return 'Tournées et créneaux à tenir cette semaine.'
  if (role === 'FINANCE') return 'Points et réceptions qui engagent une facture.'
  if (role === 'DRIVER') return 'Vos tournées, rien d’autre.'
  return 'Les rendez-vous qui structurent les prochains jours.'
})

function dayName(date: Date) {
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'short' }).format(date).replace('.', '')
}

function dayNumber(date: Date) {
  return date.getDate()
}

function goThisWeek() {
  weekOffset.value = 0
  selectedDay.value = today
}

function selectEventDay(iso: string) {
  const key = dayKey(iso)
  selectedDay.value = key
  const eventMonday = startOfWeek(new Date(`${key}T12:00:00`))
  const thisMonday = startOfWeek(new Date())
  weekOffset.value = Math.round((eventMonday.getTime() - thisMonday.getTime()) / (7 * 86_400_000))
}

function hrefFor(event: PlanningEvent) {
  const id = event.relatedId
  if (event.type === 'delivery') {
    if (id?.startsWith('dlv')) return `/logistics?delivery=${id}`
    if (id?.startsWith('rt')) return '/logistics?tab=routes'
    return '/logistics'
  }
  if (event.type === 'receipt') return id ? `/procurement?tab=receipts&receipt=${id}` : '/procurement?tab=receipts'
  if (event.type === 'inventory') return id ? `/stock?tab=inventory&session=${id}` : '/stock?tab=inventory'
  if (event.type === 'meeting') return '/procurement'
  return '/tasks'
}

function isNow(event: PlanningEvent) {
  if (dayKey(event.date) !== today) return false
  const eventMs = new Date(event.date).getTime()
  if (Number.isNaN(eventMs)) return false
  return Math.abs(Date.now() - eventMs) <= 90 * 60 * 1000
}
</script>

<template>
  <div class="page-wide">
    <PageHeader title="Planning" :description="pageDescription" />
    <PageSkeleton v-if="loading" />
    <ErrorState v-else-if="error" :message="error" />
    <template v-else>
      <div class="mb-5 grid gap-3 sm:grid-cols-3">
        <article class="surface border-l-4 border-l-primary p-4">
          <p class="text-[13px] font-medium text-muted-foreground">Aujourd’hui</p>
          <p class="mt-2 text-2xl font-semibold tracking-tight">{{ todayCount }}</p>
          <p class="mt-1 text-xs text-muted-foreground">Rendez-vous dans la journée</p>
        </article>
        <article class="surface border-l-4 border-l-amber-500 p-4">
          <p class="text-[13px] font-medium text-amber-800">Cette semaine</p>
          <p class="mt-2 text-2xl font-semibold tracking-tight text-amber-800">{{ weekCount }}</p>
          <p class="mt-1 text-xs text-amber-800/70">Du lundi au dimanche</p>
        </article>
        <article class="surface border-l-4 border-l-blue-500 p-4">
          <p class="text-[13px] font-medium text-blue-700">À venir</p>
          <p class="mt-2 text-2xl font-semibold tracking-tight text-blue-700">{{ nextCount }}</p>
          <p class="mt-1 text-xs text-blue-700/70">Après aujourd’hui</p>
        </article>
      </div>

      <div class="mb-3 flex items-center justify-between gap-3">
        <p class="text-sm font-medium capitalize">{{ weekLabel }}</p>
        <div class="flex items-center gap-1">
          <button
            type="button"
            class="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Semaine précédente"
            @click="weekOffset -= 1"
          >
            <ChevronLeft class="size-4" />
          </button>
          <button
            type="button"
            class="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            @click="goThisWeek"
          >
            Aujourd’hui
          </button>
          <button
            type="button"
            class="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Semaine suivante"
            @click="weekOffset += 1"
          >
            <ChevronRight class="size-4" />
          </button>
        </div>
      </div>

      <div class="mb-5 grid gap-2 sm:grid-cols-7">
        <button
          v-for="day in weekDays"
          :key="day.key"
          class="rounded-xl border px-2 py-3 text-center transition-colors"
          :class="
            selectedDay === day.key
              ? 'chip-active'
              : day.isToday
                ? 'border-primary/40 bg-primary/5'
                : 'border-border bg-card hover:bg-muted/50'
          "
          @click="selectedDay = day.key"
        >
          <p class="text-[11px] font-medium uppercase tracking-wide opacity-80">{{ dayName(day.date) }}</p>
          <p class="mt-1 text-lg font-semibold tabular-nums">{{ dayNumber(day.date) }}</p>
          <span
            class="mt-1.5 inline-flex h-1.5 items-center justify-center gap-0.5"
            :class="selectedDay === day.key ? 'text-primary-foreground' : 'text-primary'"
          >
            <span
              v-for="n in Math.min(day.count, 3)"
              :key="n"
              class="size-1.5 rounded-full"
              :class="selectedDay === day.key ? 'bg-primary-foreground' : day.count ? 'bg-primary' : 'bg-transparent'"
            />
          </span>
        </button>
      </div>

      <div class="mb-4 flex flex-wrap gap-2">
        <button
          v-for="item in typeChips"
          :key="item.id"
          class="chip"
          :class="
            typeFilter === item.id
              ? 'chip-active'
              : 'border-border bg-card text-muted-foreground hover:text-foreground'
          "
          @click="typeFilter = item.id"
        >
          {{ item.label }}
          <span class="ml-1 tabular-nums">{{ item.count }}</span>
        </button>
      </div>

      <div class="grid items-start gap-5 lg:grid-cols-12">
        <section class="surface p-5 lg:col-span-8">
          <div class="mb-4 flex items-end justify-between gap-3">
            <div>
              <p class="section-title">Journée</p>
              <h2 class="mt-1 text-lg font-semibold capitalize">{{ selectedLabel }}</h2>
            </div>
            <p class="text-xs text-muted-foreground">{{ dayEvents.length }} événement{{ dayEvents.length > 1 ? 's' : '' }}</p>
          </div>
          <EmptyState
            v-if="!dayEvents.length"
            title="Rien de prévu ce jour-là"
            description="Choisissez un autre jour, ou laissez la semaine se remplir."
          />
          <ol v-else class="relative ml-3 border-l border-border">
            <li v-for="event in dayEvents" :key="event.id" class="relative pb-6 pl-6 last:pb-0">
              <span
                class="absolute -left-1.5 top-1.5 size-3 rounded-full border-2 border-background"
                :class="isNow(event) ? 'bg-primary' : 'bg-muted-foreground/40'"
              />
              <button class="w-full rounded-xl text-left transition-colors hover:bg-muted/40" @click="router.push(hrefFor(event))">
                <div class="flex items-start gap-3 px-1 py-1">
                  <div class="flex size-9 shrink-0 items-center justify-center rounded-xl" :class="typeMeta[event.type].wrap">
                    <component :is="typeMeta[event.type].icon" class="size-4" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-center gap-2">
                      <p class="text-sm font-semibold">{{ event.title }}</p>
                      <Badge :variant="typeMeta[event.type].badge">{{ typeMeta[event.type].label }}</Badge>
                    </div>
                    <p class="mt-0.5 text-xs text-muted-foreground">{{ formatTime(event.date) }}</p>
                  </div>
                  <span class="shrink-0 text-xs font-medium text-primary">Voir</span>
                </div>
              </button>
            </li>
          </ol>
        </section>

        <aside class="space-y-3 lg:col-span-4">
          <section class="surface p-5">
            <h2 class="text-sm font-semibold">Prochains rendez-vous</h2>
            <p class="mt-1 text-xs text-muted-foreground">À partir d’aujourd’hui.</p>
            <div v-if="upcoming.length" class="mt-4 space-y-3">
              <button
                v-for="event in upcoming"
                :key="event.id"
                class="flex w-full items-start gap-3 rounded-lg text-left hover:bg-muted/50"
                @click="selectEventDay(event.date)"
              >
                <div class="w-12 shrink-0 pt-0.5 text-right">
                  <p class="text-[11px] font-medium uppercase text-muted-foreground">
                    {{ dayName(new Date(event.date)) }}
                  </p>
                  <p class="text-sm font-semibold tabular-nums">{{ formatTime(event.date) }}</p>
                </div>
                <div class="min-w-0 flex-1 border-l border-border pl-3">
                  <p class="truncate text-sm font-medium">{{ event.title }}</p>
                  <p class="text-xs text-muted-foreground">{{ typeMeta[event.type].label }}</p>
                </div>
              </button>
            </div>
            <p v-else class="mt-4 text-sm text-muted-foreground">Aucun rendez-vous à venir.</p>
          </section>
        </aside>
      </div>
    </template>
  </div>
</template>
