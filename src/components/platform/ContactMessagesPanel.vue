<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Mail, Phone } from 'lucide-vue-next'
import { contactService, type ContactMessage } from '@/services/contact.service'
import PageSkeleton from '@/components/feedback/PageSkeleton.vue'
import EmptyState from '@/components/feedback/EmptyState.vue'
import ErrorState from '@/components/feedback/ErrorState.vue'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'
import { formatDateTime } from '@/lib/utils'

type Filter = 'open' | 'handled' | 'all'

const items = ref<ContactMessage[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const filter = ref<Filter>('open')
const expanded = ref<string | null>(null)
const busyId = ref<string | null>(null)

async function load() {
  loading.value = true
  try {
    items.value = await contactService.list()
    error.value = null
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Chargement impossible.'
  } finally {
    loading.value = false
  }
}

onMounted(load)

const counts = computed(() => ({
  open: items.value.filter((item) => !item.handledAt).length,
  handled: items.value.filter((item) => item.handledAt).length,
  all: items.value.length,
}))

const chips = computed(() => [
  { id: 'open' as const, label: 'À traiter', count: counts.value.open },
  { id: 'handled' as const, label: 'Traitées', count: counts.value.handled },
  { id: 'all' as const, label: 'Toutes', count: counts.value.all },
])

const visible = computed(() => {
  if (filter.value === 'open') return items.value.filter((item) => !item.handledAt)
  if (filter.value === 'handled') return items.value.filter((item) => item.handledAt)
  return items.value
})

async function toggleHandled(item: ContactMessage) {
  busyId.value = item.id
  try {
    const updated = await contactService.setHandled(item.id, !item.handledAt)
    items.value = items.value.map((entry) => (entry.id === updated.id ? updated : entry))
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Mise à jour impossible.'
  } finally {
    busyId.value = null
  }
}

function replyHref(item: ContactMessage) {
  const subject = encodeURIComponent('Votre demande BravoStock')
  return `mailto:${item.email}?subject=${subject}`
}
</script>

<template>
  <PageSkeleton v-if="loading" />
  <ErrorState v-else-if="error" :message="error" />
  <div v-else class="space-y-4">
    <div class="flex flex-wrap gap-2">
      <button
        v-for="chip in chips"
        :key="chip.id"
        class="chip"
        :class="filter === chip.id ? 'chip-active' : 'bg-card text-muted-foreground'"
        @click="filter = chip.id"
      >
        {{ chip.label }} · {{ chip.count }}
      </button>
    </div>

    <EmptyState
      v-if="!visible.length"
      :title="filter === 'open' ? 'Aucune demande à traiter' : 'Aucune demande'"
    />

    <article v-for="item in visible" :key="item.id" class="surface px-4 py-3">
      <div
        class="flex cursor-pointer flex-wrap items-start justify-between gap-3"
        @click="expanded = expanded === item.id ? null : item.id"
      >
        <div class="min-w-0">
          <p class="text-sm font-semibold">
            {{ item.name }}<span v-if="item.company" class="font-normal text-muted-foreground"> · {{ item.company }}</span>
          </p>
          <p class="mt-0.5 text-xs text-muted-foreground">
            {{ item.email }}<span v-if="item.phone"> · {{ item.phone }}</span> · {{ formatDateTime(item.createdAt) }}
          </p>
          <p
            class="mt-2 whitespace-pre-line text-sm"
            :class="expanded === item.id ? '' : 'line-clamp-2 text-muted-foreground'"
          >
            {{ item.message }}
          </p>
        </div>
        <Badge :variant="item.handledAt ? 'success' : 'warning'">
          {{ item.handledAt ? 'Traitée' : 'À traiter' }}
        </Badge>
      </div>

      <div v-if="expanded === item.id" class="mt-3 flex flex-wrap items-center gap-2">
        <a :href="replyHref(item)">
          <Button size="sm" variant="outline"><Mail class="mr-1.5 h-3.5 w-3.5" />Répondre</Button>
        </a>
        <a v-if="item.phone" :href="`tel:${item.phone}`">
          <Button size="sm" variant="outline"><Phone class="mr-1.5 h-3.5 w-3.5" />Appeler</Button>
        </a>
        <Button size="sm" :loading="busyId === item.id" @click="toggleHandled(item)">
          {{ item.handledAt ? 'Rouvrir' : 'Marquer traitée' }}
        </Button>
        <span v-if="item.handledAt" class="text-xs text-muted-foreground">
          Traitée le {{ formatDateTime(item.handledAt) }}
        </span>
      </div>
    </article>
  </div>
</template>
