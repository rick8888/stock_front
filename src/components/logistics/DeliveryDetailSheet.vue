<script setup lang="ts">
import { computed } from 'vue'
import Sheet from '@/components/ui/Sheet.vue'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'
import TrackingMap from '@/components/logistics/TrackingMap.vue'
import OfficialDocument from '@/components/documents/OfficialDocument.vue'
import DocumentShareBar from '@/components/documents/DocumentShareBar.vue'
import { formatDateTime, formatTime, formatNumber } from '@/lib/utils'
import { useIssuer } from '@/composables/useIssuer'
import { documentWhatsAppMessage } from '@/utils/documents'
import type { DeliveryOverview } from '@/services/logistics.overview'
import type { DeliveryStatus } from '@/types'

const props = defineProps<{
  open: boolean
  overview: DeliveryOverview | null
  canConfirm?: boolean
  canEdit?: boolean
}>()
const emit = defineEmits<{ close: []; confirm: []; edit: [] }>()
const { issuer } = useIssuer()

function variant(status: DeliveryStatus) {
  if (status === 'delivered') return 'success' as const
  if (status === 'at_risk' || status === 'failed') return 'warning' as const
  if (status === 'in_transit') return 'onorder' as const
  return 'info' as const
}

const blLines = computed(() =>
  (props.overview?.lines ?? []).map((line) => ({
    name: line.productName,
    sku: line.sku,
    qty: `${formatNumber(line.quantity)} ${line.unit}`,
  })),
)

const blContacts = computed(() => {
  const phone = props.overview?.driverPhone
  if (!phone) return []
  return [{ label: props.overview!.driverName, phone, hint: 'Chauffeur' }]
})

const blMessage = computed(() => {
  const item = props.overview
  if (!item) return ''
  return documentWhatsAppMessage({
    title: 'Bon de livraison',
    code: item.code,
    issuer: issuer.value.name,
    lines: [
      `Client : ${item.delivery.client}`,
      `Adresse : ${item.delivery.address}, ${item.delivery.city}`,
      `Chauffeur : ${item.driverName} · ${item.vehicleLabel}`,
      ...item.lines.map((line) => `• ${line.productName} × ${line.quantity} ${line.unit}`),
    ],
  })
})
</script>

<template>
  <Sheet :open="open && !!overview" :title="overview?.delivery.client" xl @close="emit('close')">
    <div v-if="overview" class="space-y-6">
      <div class="flex flex-wrap items-center gap-2">
        <Badge :variant="variant(overview.delivery.status)">{{ overview.statusLabel }}</Badge>
        <span class="text-xs text-muted-foreground">{{ overview.code }} · {{ overview.routeName }}</span>
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
        <p>Le véhicule suit l’itinéraire routier réel</p>
        <p class="font-medium text-foreground">{{ overview.progress }} %</p>
      </div>
      <div class="h-1.5 overflow-hidden rounded-full bg-muted">
        <div class="h-full rounded-full bg-primary" :style="{ width: `${overview.progress}%` }" />
      </div>

      <div class="grid grid-cols-2 gap-2">
        <div class="rounded-xl border bg-muted/40 px-3 py-2.5">
          <p class="text-[11px] text-muted-foreground">Créneau</p>
          <p class="mt-1 text-sm font-semibold">{{ formatTime(overview.delivery.scheduledAt) }}</p>
        </div>
        <div class="rounded-xl border bg-muted/40 px-3 py-2.5">
          <p class="text-[11px] text-muted-foreground">Chauffeur</p>
          <p class="mt-1 text-sm font-semibold">{{ overview.driverName }}</p>
        </div>
        <div class="rounded-xl border bg-muted/40 px-3 py-2.5">
          <p class="text-[11px] text-muted-foreground">Véhicule</p>
          <p class="mt-1 text-sm font-semibold">{{ overview.vehicleLabel }}</p>
        </div>
        <div class="rounded-xl border bg-muted/40 px-3 py-2.5">
          <p class="text-[11px] text-muted-foreground">Adresse</p>
          <p class="mt-1 text-sm font-semibold">{{ overview.delivery.address }}</p>
        </div>
      </div>

      <p v-if="overview.delivery.notes" class="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
        {{ overview.delivery.notes }}
      </p>

      <OfficialDocument
        title="Bon de livraison"
        :code="overview.code"
        :date="overview.delivery.scheduledAt"
        :issuer-name="issuer.name"
        :issuer-legal="issuer.legalName"
        :issuer-ice="issuer.ice"
        :issuer-city="issuer.city"
        :issuer-phone="issuer.phone"
        :issuer-email="issuer.email"
        :parties="[
          { title: 'Expéditeur', name: overview.warehouseName, detail: overview.warehouseAddress },
          { title: 'Destinataire', name: overview.delivery.client, detail: `${overview.delivery.address}, ${overview.delivery.city}` },
          { title: 'Chauffeur', name: overview.driverName, detail: overview.vehicleLabel },
        ]"
        :lines="blLines"
        :notes="overview.delivery.notes"
        :signatures="[
          { label: 'Signature chauffeur', name: overview.driverName },
          { label: 'Signature destinataire', name: overview.delivery.signedBy },
        ]"
      />

      <p v-if="overview.delivery.signedAt" class="text-xs text-muted-foreground">
        Signé le {{ formatDateTime(overview.delivery.signedAt) }}
      </p>
    </div>
    <template #footer>
      <div class="space-y-2">
        <DocumentShareBar :filename="overview?.code ?? 'BL'" :message="blMessage" :contacts="blContacts" />
        <div class="flex gap-2">
          <Button v-if="canEdit" class="flex-1" variant="outline" @click="emit('edit')">Modifier</Button>
          <Button
            v-if="canConfirm && overview && overview.delivery.status !== 'delivered'"
            class="flex-1"
            @click="emit('confirm')"
          >
            Confirmer la livraison
          </Button>
        </div>
      </div>
    </template>
  </Sheet>
</template>
