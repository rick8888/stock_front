<script setup lang="ts">
import { computed } from 'vue'
import Sheet from '@/components/ui/Sheet.vue'
import Badge from '@/components/ui/Badge.vue'
import Button from '@/components/ui/Button.vue'
import TrackingMap from '@/components/logistics/TrackingMap.vue'
import OfficialDocument from '@/components/documents/OfficialDocument.vue'
import DocumentShareBar from '@/components/documents/DocumentShareBar.vue'
import { formatDate, formatTime } from '@/lib/utils'
import { DELIVERY_LABEL } from '@/config/logistics'
import { useIssuer } from '@/composables/useIssuer'
import { documentWhatsAppMessage } from '@/utils/documents'
import type { RouteOverview } from '@/services/logistics.overview'
import type { RouteStatus } from '@/types'

const props = defineProps<{ open: boolean; overview: RouteOverview | null; canEdit?: boolean; canCreate?: boolean }>()
const emit = defineEmits<{ close: []; openDelivery: [id: string]; edit: []; addStop: [] }>()
const { issuer } = useIssuer()

function variant(status: RouteStatus) {
  if (status === 'done') return 'success' as const
  if (status === 'in_progress') return 'onorder' as const
  return 'info' as const
}

function stopVariant(status: string) {
  if (status === 'delivered') return 'success' as const
  if (status === 'at_risk' || status === 'failed') return 'warning' as const
  if (status === 'in_transit') return 'onorder' as const
  return 'outline' as const
}

const trLines = computed(() =>
  (props.overview?.stops ?? []).map((stop) => ({
    name: `${stop.sequence}. ${stop.client}`,
    sku: stop.city,
    qty: formatTime(stop.scheduledAt),
    detail: stop.address,
  })),
)

const trContacts = computed(() => {
  const phone = props.overview?.driverPhone
  if (!phone) return []
  return [{ label: props.overview!.driverName, phone, hint: 'Chauffeur' }]
})

const trMessage = computed(() => {
  const item = props.overview
  if (!item) return ''
  return documentWhatsAppMessage({
    title: 'Ordre de tournée',
    code: item.code,
    issuer: issuer.value.name,
    lines: [
      `Date : ${formatDate(item.route.date)}`,
      `Départ : ${item.warehouseName}`,
      `Chauffeur : ${item.driverName} · ${item.vehicleLabel}`,
      ...item.stops.map((stop) => `• ${stop.sequence}. ${stop.client} — ${stop.address}`),
    ],
  })
})
</script>

<template>
  <Sheet :open="open && !!overview" :title="overview?.route.name" xl @close="emit('close')">
    <div v-if="overview" class="space-y-6">
      <div class="flex flex-wrap items-center gap-2">
        <Badge :variant="variant(overview.route.status)">{{ overview.statusLabel }}</Badge>
        <span class="text-xs text-muted-foreground">{{ overview.code }} · {{ overview.route.distanceKm }} km</span>
      </div>

      <TrackingMap
        :path="overview.path"
        :trail="overview.trail"
        :remaining="overview.remaining"
        :vehicle="overview.vehicle"
        :markers="overview.markers"
        :progress="overview.progress"
      />
      <div class="flex items-center justify-between text-xs text-muted-foreground">
        <p>{{ overview.doneCount }} / {{ overview.stops.length }} arrêts · itinéraire routier</p>
        <p class="font-medium text-foreground">{{ overview.progress }} %</p>
      </div>
      <div class="h-1.5 overflow-hidden rounded-full bg-muted">
        <div class="h-full rounded-full bg-primary" :style="{ width: `${overview.progress}%` }" />
      </div>

      <div class="grid grid-cols-2 gap-2">
        <div class="rounded-xl border bg-muted/40 px-3 py-2.5">
          <p class="text-[11px] text-muted-foreground">Date</p>
          <p class="mt-1 text-sm font-semibold">{{ formatDate(overview.route.date) }}</p>
        </div>
        <div class="rounded-xl border bg-muted/40 px-3 py-2.5">
          <p class="text-[11px] text-muted-foreground">Départ</p>
          <p class="mt-1 text-sm font-semibold">{{ overview.warehouseName }}</p>
        </div>
        <div class="rounded-xl border bg-muted/40 px-3 py-2.5">
          <p class="text-[11px] text-muted-foreground">Chauffeur</p>
          <p class="mt-1 text-sm font-semibold">{{ overview.driverName }}</p>
        </div>
        <div class="rounded-xl border bg-muted/40 px-3 py-2.5">
          <p class="text-[11px] text-muted-foreground">Véhicule</p>
          <p class="mt-1 text-sm font-semibold">{{ overview.vehicleLabel }}</p>
        </div>
      </div>

      <section>
        <div class="flex items-center justify-between gap-2">
          <h3 class="text-sm font-semibold">Feuille de tournée</h3>
          <Button v-if="canCreate" size="sm" variant="outline" @click="emit('addStop')">Ajouter un arrêt</Button>
        </div>
        <div class="mt-2 space-y-2">
          <button
            v-for="stop in overview.stops"
            :key="stop.id"
            class="flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left hover:bg-muted/40"
            @click="emit('openDelivery', stop.id)"
          >
            <div>
              <p class="text-sm font-medium">{{ stop.sequence }}. {{ stop.client }}</p>
              <p class="text-xs text-muted-foreground">{{ formatTime(stop.scheduledAt) }} · {{ stop.address }}</p>
            </div>
            <Badge :variant="stopVariant(stop.status)">{{ DELIVERY_LABEL[stop.status] }}</Badge>
          </button>
        </div>
      </section>
      <OfficialDocument
        title="Ordre de tournée"
        :code="overview.code"
        :date="overview.route.date"
        :issuer-name="issuer.name"
        :issuer-legal="issuer.legalName"
        :issuer-ice="issuer.ice"
        :issuer-city="issuer.city"
        :issuer-phone="issuer.phone"
        :issuer-email="issuer.email"
        :parties="[
          { title: 'Départ', name: overview.warehouseName, detail: overview.warehouseAddress },
          {
            title: 'Chauffeur',
            name: overview.driverName,
            detail: [overview.vehicleLabel, overview.driverPhone].filter(Boolean).join(' · '),
          },
        ]"
        :lines="trLines"
        :signatures="[
          { label: 'Dispatch' },
          { label: 'Chauffeur', name: overview.driverName },
        ]"
      />
    </div>
    <template #footer>
      <div class="space-y-2">
        <DocumentShareBar
          v-if="overview"
          :filename="overview.code"
          :message="trMessage"
          :contacts="trContacts"
        />
        <Button v-if="canEdit" class="w-full" variant="outline" @click="emit('edit')">Modifier la tournée</Button>
      </div>
    </template>
  </Sheet>
</template>
