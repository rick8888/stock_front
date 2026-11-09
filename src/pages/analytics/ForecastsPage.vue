<script setup lang="ts">
import { computed, ref } from 'vue'
import { useStock } from '@/composables/useStock'
import { useProcurement } from '@/composables/useProcurement'
import { useCurrentUser } from '@/composables/useAuth'
import { usePermissions } from '@/composables/usePermissions'
import { useActionBusy } from '@/composables/useActionBusy'
import PageHeader from '@/components/common/PageHeader.vue'
import PageSkeleton from '@/components/feedback/PageSkeleton.vue'
import EmptyState from '@/components/feedback/EmptyState.vue'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'
import RequestFormSheet from '@/components/purchasing/RequestFormSheet.vue'
import type { StockOverviewRow } from '@/types'

const { can } = usePermissions()
const { currentUser } = useCurrentUser()
const { run } = useActionBusy()
const { overview, warehouses, products, loading, recommendationFor } = useStock()
const { createRequest } = useProcurement()

const supplyOpen = ref(false)
const selected = ref<StockOverviewRow | null>(null)

const rows = computed(() =>
  overview.value
    .filter((item) => item.status === 'critical' || item.status === 'watch')
    .map((row) => ({ row, rec: recommendationFor(row) }))
    .filter((item) => item.rec.quantity > 0),
)

function openSupply(row: StockOverviewRow) {
  selected.value = row
  supplyOpen.value = true
}

const supplyLines = computed(() => {
  if (!selected.value) return []
  const rec = recommendationFor(selected.value)
  return [{ productId: selected.value.productId, quantity: rec.quantity || 1 }]
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
    await createRequest(payload.warehouseId, payload.items, payload.note || 'Prévision de rupture', {
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
    <PageHeader title="Prévisions" description="Ce qui va casser, et la quantité à lancer." />
    <PageSkeleton v-if="loading" />
    <EmptyState v-else-if="!rows.length" title="Rien à commander" description="Les couvertures tiennent pour l’instant." />
    <div v-else class="space-y-2">
      <article
        v-for="item in rows"
        :key="item.row.id"
        class="surface flex flex-wrap items-center justify-between gap-3 px-4 py-3"
      >
        <div>
          <p class="text-sm font-semibold">{{ item.row.productName }}</p>
          <p class="mt-0.5 text-xs text-muted-foreground">
            {{ item.row.warehouseName }} · {{ item.row.days }} j de couverture · seuil {{ item.row.minStock }}
          </p>
        </div>
        <div class="flex items-center gap-2">
          <Badge :variant="item.row.status === 'critical' ? 'critical' : 'warning'">
            Commander {{ item.rec.quantity }} {{ item.row.unit }}s
          </Badge>
          <Button v-if="can('procurement.create')" size="sm" @click="openSupply(item.row)">Créer la DA</Button>
        </div>
      </article>
    </div>
    <RequestFormSheet
      :open="supplyOpen"
      title="Créer un approvisionnement"
      :products="products"
      :warehouses="warehouses"
      :initial-warehouse-id="selected?.warehouseId"
      :initial-lines="supplyLines"
      :initial-note="selected ? `Prévision — ${selected.productName}` : ''"
      lock-warehouse
      @close="supplyOpen = false"
      @submit="submitSupply"
    />
  </div>
</template>
