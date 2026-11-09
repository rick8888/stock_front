<script setup lang="ts">
import { computed } from 'vue'
import Sheet from '@/components/ui/Sheet.vue'
import Badge from '@/components/ui/Badge.vue'
import Button from '@/components/ui/Button.vue'
import TrackingMap from '@/components/logistics/TrackingMap.vue'
import OfficialDocument from '@/components/documents/OfficialDocument.vue'
import DocumentShareBar from '@/components/documents/DocumentShareBar.vue'
import { formatDateTime, formatNumber } from '@/lib/utils'
import { DELIVERY_LABEL } from '@/config/logistics'
import { useIssuer } from '@/composables/useIssuer'
import { documentWhatsAppMessage } from '@/utils/documents'
import type { ShipmentOverview } from '@/services/logistics.overview'
import type { ShipmentStatus } from '@/types'

const props = defineProps<{ open: boolean; overview: ShipmentOverview | null; canEdit?: boolean }>()
const emit = defineEmits<{ close: []; openDelivery: [id: string]; edit: [] }>()
const { issuer } = useIssuer()

function variant(status: ShipmentStatus) {
  if (status === 'done') return 'success' as const
  if (status === 'delayed') return 'warning' as const
  if (status === 'in_transit') return 'onorder' as const
  return 'info' as const
}

function stopVariant(status: string) {
  if (status === 'delivered') return 'success' as const
  if (status === 'at_risk' || status === 'failed') return 'warning' as const
  if (status === 'in_transit') return 'onorder' as const
  return 'outline' as const
}

const exLines = computed(() =>
  (props.overview?.lines ?? []).map((line) => ({
    name: line.productName,
    sku: line.sku,
    qty: `${formatNumber(line.quantity)} ${line.unit}`,
  })),
)

const exContacts = computed(() => {
  const phone = props.overview?.driverPhone
  if (!phone) return []
  return [{ label: props.overview!.driverName, phone, hint: 'Chauffeur' }]
})

const exMessage = computed(() => {
  const item = props.overview
  if (!item) return ''
  return documentWhatsAppMessage({
    title: 'Bordereau d’expédition',
    code: item.code,
    issuer: issuer.value.name,
    lines: [
      `Départ : ${item.originName}`,
      `Destination : ${item.destinationName}`,
      `Chauffeur : ${item.driverName} · ${item.vehicleLabel}`,
      ...item.lines.map((line) => `• ${line.productName} × ${line.quantity} ${line.unit}`),
    ],
  })
})
</script>

<template>
  <Sheet :open="open && !!overview" :title="overview?.shipment.destination" xl @close="emit('close')">
    <div v-if="overview" class="space-y-6">
      <div class="flex flex-wrap items-center gap-2">
        <Badge :variant="variant(overview.shipment.status)">{{ overview.statusLabel }}</Badge>
        <span class="text-xs text-muted-foreground">{{ overview.code }}</span>
      </div>

      <TrackingMap
        :path="overview.path"
        :trail="overview.trail"
        :remaining="overview.remaining"
        :vehicle="overview.vehicle"
        :markers="overview.markers"
      />
      <div class="flex items-center justify-between text-xs text-muted-foreground">
        <p>{{ overview.originName }} → {{ overview.destinationName }}</p>
        <p class="font-medium text-foreground">{{ overview.progress }} %</p>
      </div>
      <div class="h-1.5 overflow-hidden rounded-full bg-muted">
        <div class="h-full rounded-full bg-primary" :style="{ width: `${overview.progress}%` }" />
      </div>

      <div class="grid grid-cols-2 gap-2">
        <div class="rounded-xl border bg-muted/40 px-3 py-2.5">
          <p class="text-[11px] text-muted-foreground">Départ</p>
          <p class="mt-1 text-sm font-semibold">{{ formatDateTime(overview.shipment.date) }}</p>
        </div>
        <div class="rounded-xl border bg-muted/40 px-3 py-2.5">
          <p class="text-[11px] text-muted-foreground">ETA</p>
          <p class="mt-1 text-sm font-semibold">
            {{ overview.shipment.eta ? formatDateTime(overview.shipment.eta) : '—' }}
          </p>
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

      <p v-if="overview.shipment.notes" class="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
        {{ overview.shipment.notes }}
      </p>

      <section v-if="overview.stops.length">
        <h3 class="text-sm font-semibold">Arrêts de la tournée</h3>
        <div class="mt-2 space-y-2">
          <button
            v-for="stop in overview.stops"
            :key="stop.id"
            class="flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left hover:bg-muted/40"
            @click="emit('openDelivery', stop.id)"
          >
            <div>
              <p class="text-sm font-medium">{{ stop.sequence }}. {{ stop.client }}</p>
              <p class="text-xs text-muted-foreground">{{ stop.address }}</p>
            </div>
            <Badge :variant="stopVariant(stop.status)">{{ DELIVERY_LABEL[stop.status] }}</Badge>
          </button>
        </div>
      </section>

      <OfficialDocument
        title="Bordereau d’expédition"
        :code="overview.code"
        :date="overview.shipment.date"
        :issuer-name="issuer.name"
        :issuer-legal="issuer.legalName"
        :issuer-ice="issuer.ice"
        :issuer-city="issuer.city"
        :issuer-phone="issuer.phone"
        :issuer-email="issuer.email"
        :parties="[
          { title: 'Expéditeur', name: overview.originName, detail: overview.originAddress },
          { title: 'Destinataire', name: overview.destinationName, detail: overview.destinationAddress },
          {
            title: 'Chauffeur',
            name: overview.driverName,
            detail: [overview.vehicleLabel, overview.driverPhone].filter(Boolean).join(' · '),
          },
        ]"
        :lines="exLines"
        :notes="overview.shipment.notes"
        :signatures="[
          { label: 'Signature chauffeur', name: overview.driverName },
          { label: 'Signature destinataire' },
        ]"
      />
    </div>
    <template #footer>
      <div class="space-y-2">
        <DocumentShareBar
          v-if="overview"
          :filename="overview.code"
          :message="exMessage"
          :contacts="exContacts"
        />
        <Button v-if="canEdit" class="w-full" variant="outline" @click="emit('edit')">Modifier l’expédition</Button>
      </div>
    </template>
  </Sheet>
</template>
