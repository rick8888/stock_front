<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useReplenishment, type ReplenishmentRow } from '@/composables/useReplenishment'
import { useProcurement } from '@/composables/useProcurement'
import { useCurrentUser } from '@/composables/useAuth'
import { usePermissions } from '@/composables/usePermissions'
import { useActionBusy } from '@/composables/useActionBusy'
import PageHeader from '@/components/common/PageHeader.vue'
import PageSkeleton from '@/components/feedback/PageSkeleton.vue'
import EmptyState from '@/components/feedback/EmptyState.vue'
import ErrorState from '@/components/feedback/ErrorState.vue'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'
import RequestFormSheet from '@/components/purchasing/RequestFormSheet.vue'

const route = useRoute()
const { can } = usePermissions()
const { currentUser } = useCurrentUser()
const { run } = useActionBusy()
const {
  rows,
  counts,
  estimatedCost,
  computedAt,
  computing,
  simulating,
  isSimulation,
  serviceLevel,
  leadTimeDays,
  loading,
  error,
  products,
  warehouses,
  recompute,
  runSimulate,
  clearSimulation,
} = useReplenishment()
const { createRequest } = useProcurement({ autoload: false })

const supplyOpen = ref(false)
const selected = ref<ReplenishmentRow | null>(null)
const expanded = ref<string | null>(null)
const focusProduct = ref<string | null>(null)

const RISK_LABEL: Record<ReplenishmentRow['risk'], string> = {
  high: 'Rupture imminente',
  medium: 'Sous le point de commande',
  low: 'À surveiller',
}

const SERVICE_PRESETS = [
  { value: 0.9, label: '90 %' },
  { value: 0.95, label: '95 %' },
  { value: 0.99, label: '99 %' },
] as const

const lastComputed = computed(() => {
  if (!computedAt.value) return null
  return new Date(computedAt.value).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
})

const formattedCost = computed(() =>
  estimatedCost.value > 0 ? `${Math.round(estimatedCost.value).toLocaleString('fr-FR')} MAD` : null,
)

const visibleRows = computed(() => {
  const product = focusProduct.value
  if (!product) return rows.value
  const warehouse = typeof route.query.warehouse === 'string' ? route.query.warehouse : null
  const matched = rows.value.filter(
    (row) => row.productId === product && (!warehouse || row.warehouseId === warehouse),
  )
  return matched.length ? matched : rows.value
})

const daOpenedFor = ref<string | null>(null)

watch(
  () => [route.query.product, route.query.action, rows.value, isSimulation.value] as const,
  () => {
    const product = route.query.product
    if (typeof product !== 'string' || !product) {
      focusProduct.value = null
      return
    }
    focusProduct.value = product
    const warehouse = typeof route.query.warehouse === 'string' ? route.query.warehouse : null
    const match = rows.value.find(
      (row) => row.productId === product && (!warehouse || row.warehouseId === warehouse),
    )
    if (!match) return
    expanded.value = match.id
    // Deep-link Today/alerte → ouvrir la DA préremplie (hors simulation).
    if (
      route.query.action === 'da' &&
      !isSimulation.value &&
      can('procurement.create') &&
      daOpenedFor.value !== match.id
    ) {
      daOpenedFor.value = match.id
      openSupply(match)
    }
  },
  { immediate: true },
)

function toggle(id: string) {
  expanded.value = expanded.value === id ? null : id
}

function openSupply(row: ReplenishmentRow) {
  selected.value = row
  supplyOpen.value = true
}

const supplyLines = computed(() => {
  if (!selected.value) return []
  return [{ productId: selected.value.productId, quantity: selected.value.suggestedQuantity || 1 }]
})

async function submitSupply(payload: {
  warehouseId: string
  items: { productId: string; quantity: number }[]
  note: string
  priority: 'high' | 'medium' | 'low'
  asDraft: boolean
}) {
  if (!currentUser.value) return
  await run(async () => {
    await createRequest(payload.warehouseId, payload.items, payload.note || 'Proposition de réapprovisionnement', {
      priority: payload.priority,
      status: payload.asDraft ? 'draft' : 'submitted',
    })
    supplyOpen.value = false
    selected.value = null
  })
}

function serviceLabel(value: number) {
  return `${Math.round(value * 100)} %`
}
</script>

<template>
  <div class="page-wide">
    <PageHeader title="Réapprovisionnement" description="Quantités proposées à partir de la consommation observée.">
      <template #actions>
        <Button variant="outline" size="sm" :disabled="computing || simulating" @click="recompute(false)">
          {{ computing ? 'Calcul…' : 'Recalculer' }}
        </Button>
        <Button variant="outline" size="sm" :disabled="computing || simulating" @click="recompute(true)">
          Recalculer la demande
        </Button>
      </template>
    </PageHeader>

    <div class="mb-4 flex flex-wrap items-end gap-3 rounded-md border border-border/70 bg-muted/30 px-3 py-3">
      <div class="min-w-[12rem] flex-1">
        <label class="text-[11px] font-medium text-muted-foreground" for="service-level">
          What-if — niveau de service
        </label>
        <input
          id="service-level"
          v-model.number="serviceLevel"
          class="mt-1 w-full accent-foreground"
          type="range"
          min="0.8"
          max="0.99"
          step="0.01"
        />
        <div class="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span>Cible {{ serviceLabel(serviceLevel) }}</span>
          <button
            v-for="preset in SERVICE_PRESETS"
            :key="preset.value"
            type="button"
            class="underline-offset-2 hover:underline"
            @click="serviceLevel = preset.value"
          >
            {{ preset.label }}
          </button>
        </div>
      </div>
      <div class="min-w-[10rem] flex-1">
        <label class="text-[11px] font-medium text-muted-foreground" for="lead-time">
          Délai fournisseur (j)
        </label>
        <input
          id="lead-time"
          class="mt-1 w-full accent-foreground"
          type="range"
          min="1"
          max="21"
          step="1"
          :value="leadTimeDays ?? 5"
          @input="leadTimeDays = Number(($event.target as HTMLInputElement).value)"
        />
        <div class="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span>{{ leadTimeDays ?? 5 }} j</span>
          <button type="button" class="underline-offset-2 hover:underline" @click="leadTimeDays = null">
            Auto
          </button>
          <button type="button" class="underline-offset-2 hover:underline" @click="leadTimeDays = 3">3 j</button>
          <button type="button" class="underline-offset-2 hover:underline" @click="leadTimeDays = 7">7 j</button>
          <button type="button" class="underline-offset-2 hover:underline" @click="leadTimeDays = 14">14 j</button>
        </div>
      </div>
      <div class="flex flex-wrap gap-2">
        <Button size="sm" :disabled="simulating || computing" @click="runSimulate(serviceLevel, leadTimeDays)">
          {{ simulating ? 'Simulation…' : 'Simuler' }}
        </Button>
        <Button v-if="isSimulation" variant="ghost" size="sm" @click="clearSimulation">
          Revenir au calcul enregistré
        </Button>
      </div>
    </div>

    <p
      v-if="isSimulation"
      class="mb-4 rounded-md border border-sky-500/30 bg-sky-500/5 px-3 py-2 text-[12px] text-sky-950 dark:text-sky-100"
    >
      Simulation à {{ serviceLabel(serviceLevel)
      }}<template v-if="leadTimeDays != null"> · délai {{ leadTimeDays }} j</template>
      — non enregistrée. « Recalculer » écrit le scénario officiel.
    </p>

    <PageSkeleton v-if="loading" />
    <ErrorState v-else-if="error" :message="error" />
    <template v-else>
      <div v-if="visibleRows.length" class="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="critical">{{ counts.high }} urgentes</Badge>
        <Badge variant="warning">{{ counts.medium }} à lancer</Badge>
        <span v-if="formattedCost">Valeur estimée : {{ formattedCost }}</span>
        <span v-if="lastComputed">· Calculé le {{ lastComputed }}</span>
        <Badge v-if="focusProduct" variant="outline">Filtré depuis l’alerte</Badge>
      </div>

      <EmptyState
        v-if="!visibleRows.length"
        title="Aucun réapprovisionnement nécessaire"
        description="Toutes les positions de stock couvrent leur point de commande. Lancez un recalcul ou une simulation si la consommation a changé."
      />

      <div v-else class="space-y-2">
        <article
          v-for="item in visibleRows"
          :key="item.id"
          class="surface px-4 py-3"
          :class="focusProduct === item.productId ? 'ring-1 ring-sky-500/40' : ''"
        >
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm font-semibold">{{ item.productName }}</p>
              <p class="mt-0.5 text-xs text-muted-foreground">
                {{ item.warehouseName }}
                <template v-if="item.coverDays !== null"> · {{ item.coverDays }} j de couverture</template>
                · point de commande {{ item.reorderPoint }}
                · sécurité {{ item.safetyStock }}
                <template v-if="item.serviceLevel != null">
                  · service {{ serviceLabel(item.serviceLevel) }}
                </template>
                <template v-if="item.supplierName"> · {{ item.supplierName }}</template>
              </p>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <Badge :variant="item.risk === 'high' ? 'critical' : item.risk === 'medium' ? 'warning' : 'info'">
                {{ RISK_LABEL[item.risk] }}
              </Badge>
              <Badge variant="outline">Commander {{ item.suggestedQuantity }} {{ item.unit }}</Badge>
              <Button variant="ghost" size="sm" @click="toggle(item.id)">
                {{ expanded === item.id ? 'Masquer' : 'Pourquoi ?' }}
              </Button>
              <Button
                v-if="can('procurement.create') && !isSimulation"
                size="sm"
                @click="openSupply(item)"
              >
                Créer la DA
              </Button>
            </div>
          </div>

          <div v-if="expanded === item.id" class="mt-3 border-t border-border/60 pt-3">
            <dl class="grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-4">
              <div>
                <dt class="text-muted-foreground">Demande observée</dt>
                <dd>{{ item.avgDailyDemand.toFixed(2) }} / jour</dd>
              </div>
              <div>
                <dt class="text-muted-foreground">Variabilité</dt>
                <dd>± {{ item.demandStdDev.toFixed(2) }}</dd>
              </div>
              <div>
                <dt class="text-muted-foreground">Délai fournisseur</dt>
                <dd>{{ item.leadTimeDays }} jours</dd>
              </div>
              <div>
                <dt class="text-muted-foreground">Niveau cible</dt>
                <dd>{{ item.targetLevel }} {{ item.unit }}</dd>
              </div>
              <div>
                <dt class="text-muted-foreground">Disponible</dt>
                <dd>{{ item.available }}</dd>
              </div>
              <div>
                <dt class="text-muted-foreground">En commande</dt>
                <dd>{{ item.inTransit }}</dd>
              </div>
              <div>
                <dt class="text-muted-foreground">Demandes à servir</dt>
                <dd>{{ item.pendingNeed }}</dd>
              </div>
              <div v-if="item.estimatedCost !== null">
                <dt class="text-muted-foreground">Coût estimé</dt>
                <dd>{{ Math.round(item.estimatedCost).toLocaleString('fr-FR') }} MAD</dd>
              </div>
            </dl>
            <ul class="mt-3 space-y-1 text-xs text-muted-foreground">
              <li v-for="(reason, index) in item.reasons" :key="index">· {{ reason }}</li>
            </ul>
          </div>
        </article>
      </div>
    </template>

    <RequestFormSheet
      :open="supplyOpen"
      title="Créer un approvisionnement"
      :products="products"
      :warehouses="warehouses"
      :initial-warehouse-id="selected?.warehouseId"
      :initial-lines="supplyLines"
      :initial-note="selected ? `Réapprovisionnement — ${selected.productName}` : ''"
      lock-warehouse
      @close="supplyOpen = false"
      @submit="submitSupply"
    />
  </div>
</template>
