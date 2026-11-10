<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Sparkles } from 'lucide-vue-next'
import Sheet from '@/components/ui/Sheet.vue'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'
import StockStatusBadge from '@/components/stock/StockStatusBadge.vue'
import { formatDate, formatDateTime, formatNumber } from '@/lib/utils'
import { usePermissions } from '@/composables/usePermissions'
import { locationRepository, placementRepository, stockLotRepository } from '@/repositories'
import { MOVEMENT_LABEL } from '@/config/stock'
import type {
  ProcurementRequest,
  PurchaseOrder,
  StockLot,
  StockMovement,
  StockOverviewRow,
  StockPlacement,
  StockRecommendation,
  WarehouseLocation,
} from '@/types'

const props = defineProps<{
  open: boolean
  row: StockOverviewRow | null
  recommendation?: StockRecommendation | null
  movements?: StockMovement[]
  requests?: ProcurementRequest[]
  orders?: PurchaseOrder[]
}>()
const emit = defineEmits<{
  close: []
  supply: [row: StockOverviewRow, quantity: number]
  edit: [productId: string]
  move: [kind: 'transfer']
  receiveOrder: []
  inventory: []
  export: []
}>()
const { can } = usePermissions()

const rec = computed(() => props.recommendation ?? null)
const history = computed(() => props.movements ?? [])
const das = computed(() => props.requests ?? [])
const pos = computed(() => props.orders ?? [])
const lots = ref<StockLot[]>([])
const placements = ref<StockPlacement[]>([])
const locationMap = ref<Map<string, WarehouseLocation>>(new Map())

const placementRows = computed(() =>
  placements.value.map((row) => ({
    ...row,
    locationCode: locationMap.value.get(row.locationId)?.code ?? row.locationId,
  })),
)

watch(
  () => [props.open, props.row?.productId, props.row?.warehouseId] as const,
  async ([open, productId, warehouseId]) => {
    if (!open || !productId || !warehouseId) {
      lots.value = []
      placements.value = []
      locationMap.value = new Map()
      return
    }
    const [lotRows, placementRowsData, locs] = await Promise.all([
      stockLotRepository.list(warehouseId, productId),
      placementRepository.list(warehouseId, productId),
      locationRepository.list(warehouseId),
    ])
    lots.value = lotRows
    placements.value = placementRowsData.filter((row) => row.quantity > 0)
    locationMap.value = new Map(locs.map((row) => [row.id, row]))
  },
)

const movementLabel = MOVEMENT_LABEL

const requestLabel: Record<string, string> = {
  draft: 'Brouillon',
  submitted: 'Soumise',
  approved: 'Validée',
  ordered: 'Traitée',
  cancelled: 'Rejetée',
}

const orderLabel: Record<string, string> = {
  draft: 'Brouillon',
  sent: 'Envoyé',
  confirmed: 'Confirmé',
  partial: 'Partiel',
  received: 'Livré',
  delayed: 'En retard',
  cancelled: 'Annulé',
}

const kpis = computed(() => {
  if (!props.row) return []
  return [
    { label: 'Disponible', value: props.row.available },
    { label: 'Réservé', value: props.row.reserved },
    { label: 'En commande', value: props.row.inTransit },
    { label: 'Minimum', value: props.row.minStock },
  ]
})
</script>

<template>
  <Sheet :open="open && !!row" :title="row?.productName" wide @close="emit('close')">
    <div v-if="row" class="space-y-6">
      <div>
        <div v-if="row.images?.length" class="mb-4 grid grid-cols-4 gap-2">
          <div
            v-for="(src, index) in row.images"
            :key="src + index"
            class="aspect-square overflow-hidden rounded-xl border bg-muted"
            :class="index === 0 ? 'col-span-2 row-span-2' : ''"
          >
            <img :src="src" :alt="row.productName" class="size-full object-cover" />
          </div>
        </div>
        <p class="text-xs text-muted-foreground">
          {{ row.sku }} · {{ row.warehouseName }}
          <span v-if="row.barcode"> · {{ row.barcode }}</span>
        </p>
        <p v-if="row.description" class="mt-2 text-sm text-muted-foreground">{{ row.description }}</p>
        <div class="mt-2 flex flex-wrap items-center gap-2">
          <StockStatusBadge :status="row.status" :on-order="row.flags.onOrder" />
          <Button
            v-if="can('product.update') || can('product.create')"
            size="sm"
            variant="outline"
            @click="emit('edit', row.productId)"
          >
            Modifier
          </Button>
        </div>
        <div class="mt-3 flex flex-wrap gap-2">
          <Button v-if="can('stock.receive')" size="sm" @click="emit('receiveOrder')">Réceptionner via BR</Button>
          <Button v-if="can('stock.transfer')" size="sm" variant="outline" @click="emit('move', 'transfer')">Transférer</Button>
          <Button v-if="can('stock.inventory')" size="sm" variant="outline" @click="emit('inventory')">Inventaire</Button>
        </div>
        <p class="mt-2 text-xs text-muted-foreground">
          Entrée uniquement sur un BR. Sortie uniquement en chargeant un BL ou en validant une DA interne.
        </p>
      </div>

      <div class="grid grid-cols-2 gap-2">
        <div v-for="kpi in kpis" :key="kpi.label" class="rounded-xl border bg-muted/40 px-3 py-2.5">
          <p class="text-[11px] text-muted-foreground">{{ kpi.label }}</p>
          <p class="mt-1 text-lg font-semibold tracking-tight">{{ formatNumber(kpi.value) }}</p>
        </div>
      </div>

      <section v-if="placementRows.length">
        <h3 class="text-sm font-semibold">Emplacements</h3>
        <div class="mt-2 space-y-2">
          <article v-for="row in placementRows" :key="row.id" class="rounded-lg border px-3 py-2">
            <div class="flex items-center justify-between gap-2">
              <p class="text-sm font-medium">{{ row.locationCode }}</p>
              <p class="text-sm tabular-nums">{{ formatNumber(row.quantity) }}</p>
            </div>
          </article>
        </div>
      </section>

      <section v-if="lots.length">
        <h3 class="text-sm font-semibold">Lots / DLC (FEFO)</h3>
        <div class="mt-2 space-y-2">
          <article v-for="lot in lots" :key="lot.id" class="rounded-lg border px-3 py-2">
            <div class="flex items-center justify-between gap-2">
              <p class="text-sm font-medium">{{ lot.lotCode }}</p>
              <p class="text-sm tabular-nums">{{ formatNumber(lot.quantity) }}</p>
            </div>
            <p class="text-xs text-muted-foreground">
              {{ lot.expiryDate ? `DLC ${formatDate(lot.expiryDate)}` : 'Sans DLC' }}
              <span v-if="lot.locationId"> · {{ locationMap.get(lot.locationId)?.code ?? lot.locationId }}</span>
            </p>
          </article>
        </div>
      </section>

      <section>
        <h3 class="text-sm font-semibold">Analyse</h3>
        <ul class="mt-2 space-y-1.5 text-[13px] text-muted-foreground">
          <li>Physique : {{ formatNumber(row.physical) }} {{ row.unit }}s</li>
          <li>Consommation moyenne : {{ row.weeklyDemand }} / semaine</li>
          <li>Délai fournisseur : {{ row.leadTimeDays }} jours ({{ row.supplierName }})</li>
          <li>
            Risque de rupture :
            <span
              class="font-medium"
              :class="{
                'text-red-700': rec?.risk === 'high',
                'text-amber-700': rec?.risk === 'medium',
                'text-emerald-700': rec?.risk === 'low',
              }"
            >
              {{ rec?.risk === 'high' ? 'Élevé' : rec?.risk === 'medium' ? 'Moyen' : 'Faible' }}
            </span>
          </li>
          <li>Couverture : {{ row.days < 99 ? `${row.days} j` : '—' }}</li>
        </ul>
      </section>

      <section v-if="rec" class="rounded-xl border border-primary/20 bg-primary/5 p-4">
        <p class="flex items-center gap-2 text-sm font-semibold text-primary">
          <Sparkles class="size-4" />
          Recommandation
        </p>
        <p class="mt-2 text-sm">
          <template v-if="rec.quantity > 0">
            Commander <span class="font-semibold">{{ rec.quantity }} {{ row.unit }}s</span>
          </template>
          <template v-else>Pas d’achat nécessaire pour l’instant.</template>
        </p>
        <p class="mt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Pourquoi</p>
        <ul class="mt-1.5 space-y-1 text-[13px] text-muted-foreground">
          <li v-for="reason in rec.reasons" :key="reason">· {{ reason }}</li>
        </ul>
        <Button
          v-if="rec.quantity > 0 && can('procurement.create')"
          class="mt-4 w-full"
          @click="emit('supply', row, rec.quantity)"
        >
          Créer un approvisionnement
        </Button>
      </section>

      <section>
        <div class="flex items-center justify-between gap-2">
          <h3 class="text-sm font-semibold">Historique</h3>
          <Button size="sm" variant="outline" :disabled="!history.length" @click="emit('export')">Exporter</Button>
        </div>
        <div class="mt-2 space-y-2">
          <p v-if="!history.length && !das.length && !pos.length" class="text-sm text-muted-foreground">
            Pas encore de mouvements sur cet article.
          </p>
          <article v-for="mov in history" :key="mov.id" class="rounded-lg border px-3 py-2">
            <p class="text-sm font-medium">{{ movementLabel[mov.type] }} · {{ mov.quantity }}</p>
            <p class="text-xs text-muted-foreground">
              {{ mov.reference ? `${mov.reference} · ` : '' }}{{ mov.note }} · {{ formatDateTime(mov.date) }}
            </p>
          </article>
          <article v-for="request in das" :key="request.id" class="rounded-lg border px-3 py-2">
            <div class="flex items-center justify-between gap-2">
              <p class="text-sm font-medium">{{ request.id.toUpperCase() }}</p>
              <Badge variant="outline">{{ requestLabel[request.status] }}</Badge>
            </div>
            <p class="text-xs text-muted-foreground">{{ request.note }}</p>
          </article>
          <article v-for="order in pos" :key="order.id" class="rounded-lg border px-3 py-2">
            <div class="flex items-center justify-between gap-2">
              <p class="text-sm font-medium">{{ order.id.toUpperCase() }}</p>
              <Badge :variant="order.status === 'delayed' ? 'critical' : 'outline'">{{ orderLabel[order.status] }}</Badge>
            </div>
            <p class="text-xs text-muted-foreground">Livraison prévue {{ order.expectedDate }}</p>
          </article>
        </div>
      </section>
    </div>
  </Sheet>
</template>
