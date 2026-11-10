<script setup lang="ts">
import { computed, ref } from 'vue'
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

const { can } = usePermissions()
const { currentUser } = useCurrentUser()
const { run } = useActionBusy()
const { rows, counts, estimatedCost, computedAt, computing, loading, error, products, warehouses, recompute } =
  useReplenishment()
const { createRequest } = useProcurement()

const supplyOpen = ref(false)
const selected = ref<ReplenishmentRow | null>(null)
const expanded = ref<string | null>(null)

const RISK_LABEL: Record<ReplenishmentRow['risk'], string> = {
  high: 'Rupture imminente',
  medium: 'Sous le point de commande',
  low: 'À surveiller',
}

const lastComputed = computed(() => {
  if (!computedAt.value) return null
  return new Date(computedAt.value).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
})

const formattedCost = computed(() =>
  estimatedCost.value > 0 ? `${Math.round(estimatedCost.value).toLocaleString('fr-FR')} MAD` : null,
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
</script>

<template>
  <div class="page-wide">
    <PageHeader title="Réapprovisionnement" description="Quantités proposées à partir de la consommation observée.">
      <template #actions>
        <Button variant="outline" size="sm" :disabled="computing" @click="recompute(false)">
          {{ computing ? 'Calcul…' : 'Recalculer' }}
        </Button>
        <Button variant="outline" size="sm" :disabled="computing" @click="recompute(true)">
          Recalculer la demande
        </Button>
      </template>
    </PageHeader>

    <PageSkeleton v-if="loading" />
    <ErrorState v-else-if="error" :message="error" />
    <template v-else>
      <div v-if="rows.length" class="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="critical">{{ counts.high }} urgentes</Badge>
        <Badge variant="warning">{{ counts.medium }} à lancer</Badge>
        <span v-if="formattedCost">Valeur estimée : {{ formattedCost }}</span>
        <span v-if="lastComputed">· Calculé le {{ lastComputed }}</span>
      </div>

      <EmptyState
        v-if="!rows.length"
        title="Aucun réapprovisionnement nécessaire"
        description="Toutes les positions de stock couvrent leur point de commande. Lancez un recalcul si la consommation a changé."
      />

      <div v-else class="space-y-2">
        <article v-for="item in rows" :key="item.id" class="surface px-4 py-3">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm font-semibold">{{ item.productName }}</p>
              <p class="mt-0.5 text-xs text-muted-foreground">
                {{ item.warehouseName }}
                <template v-if="item.coverDays !== null"> · {{ item.coverDays }} j de couverture</template>
                · point de commande {{ item.reorderPoint }}
                · sécurité {{ item.safetyStock }}
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
              <Button v-if="can('procurement.create')" size="sm" @click="openSupply(item)">Créer la DA</Button>
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
