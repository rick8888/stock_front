<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Check, MapPin, Truck } from 'lucide-vue-next'
import { useDriverToday, useVehicles, useDrivers } from '@/composables/useLogistics'
import { useCurrentUser } from '@/composables/useAuth'
import { useActionBusy } from '@/composables/useActionBusy'
import { usePermissions } from '@/composables/usePermissions'
import { useDataStore } from '@/stores/data'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'
import Sheet from '@/components/ui/Sheet.vue'
import Input from '@/components/ui/Input.vue'
import Label from '@/components/ui/Label.vue'
import PageSkeleton from '@/components/feedback/PageSkeleton.vue'
import EmptyState from '@/components/feedback/EmptyState.vue'
import DeliveryDetailSheet from '@/components/logistics/DeliveryDetailSheet.vue'
import RouteDetailSheet from '@/components/logistics/RouteDetailSheet.vue'
import ShipmentDetailSheet from '@/components/logistics/ShipmentDetailSheet.vue'
import PodSignaturePad from '@/components/logistics/PodSignaturePad.vue'
import { toast } from 'vue-sonner'
import { formatTime } from '@/lib/utils'
import { opsToday } from '@/utils/helpers'
import { isOnline } from '@/offline/outbox'
import { DELIVERY_LABEL, ROUTE_LABEL, SHIPMENT_LABEL } from '@/config/logistics'
import { deliveryOverview, routeOverview, shipmentOverview } from '@/services/logistics.overview'
import type { DeliveryStatus, RouteStatus, ShipmentStatus } from '@/types'

const route = useRoute()
const router = useRouter()
const { currentUser } = useCurrentUser()
const { can } = usePermissions()
const { run } = useActionBusy()
const store = useDataStore()
const { vehicles } = useVehicles()
const { drivers } = useDrivers()
const { day, days, deliveries, routes, shipments, remaining, next, loading, completeCurrent, completeDelivery, failDelivery } =
  useDriverToday()

type View = 'routes' | 'stops' | 'shipments'

function viewFromQuery(): View {
  const value = route.query.view
  if (value === 'routes' || value === 'shipments') return value
  return 'stops'
}

const view = ref<View>(viewFromQuery())
watch(
  () => route.query.view,
  () => {
    view.value = viewFromQuery()
  },
)

function setView(nextView: View) {
  view.value = nextView
  router.replace({
    path: '/driver/today',
    query: nextView === 'stops' ? {} : { view: nextView },
  })
}

const selectedDeliveryId = ref<string | null>(null)
const selectedRouteId = ref<string | null>(null)
const selectedShipmentId = ref<string | null>(null)
const isToday = computed(() => day.value === opsToday())
const canConfirm = computed(() => can('delivery.confirm') && isToday.value)

const ctx = computed(() => ({
  warehouses: store.db.warehouses,
  drivers: drivers.value,
  users: store.db.users,
  vehicles: vehicles.value,
  routes: store.db.routes,
  deliveries: store.db.deliveries.filter((item) => item.driverId === currentUser.value?.driverId),
}))

const selectedDelivery = computed(() => {
  const item = deliveries.value.find((row) => row.id === selectedDeliveryId.value)
  return item ? deliveryOverview(item, ctx.value) : null
})
const selectedRoute = computed(() => {
  const item = routes.value.find((row) => row.id === selectedRouteId.value)
  return item ? routeOverview(item, ctx.value) : null
})
const selectedShipment = computed(() => {
  const item = shipments.value.find((row) => row.id === selectedShipmentId.value)
  return item ? shipmentOverview(item, ctx.value) : null
})

const tabs = computed(() => [
  { id: 'routes' as const, label: 'Tournées', count: routes.value.length },
  { id: 'stops' as const, label: 'Livraisons', count: deliveries.value.length },
  { id: 'shipments' as const, label: 'Expéditions', count: shipments.value.length },
])

function dayLabel(key: string) {
  if (key === opsToday()) return 'Aujourd’hui'
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }).format(
    new Date(`${key}T12:00:00`),
  )
}

function maps(address: string, city: string) {
  window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${address} ${city}`)}`, '_blank')
}

function deliveryTone(status: DeliveryStatus) {
  if (status === 'delivered') return 'border-l-emerald-500'
  if (status === 'at_risk' || status === 'failed') return 'border-l-amber-500'
  if (status === 'in_transit') return 'border-l-blue-500'
  return 'border-l-primary/40'
}

function deliveryBadge(status: DeliveryStatus) {
  if (status === 'delivered') return 'success' as const
  if (status === 'at_risk' || status === 'failed') return 'warning' as const
  if (status === 'in_transit') return 'onorder' as const
  return 'info' as const
}

function routeBadge(status: RouteStatus) {
  if (status === 'done') return 'success' as const
  if (status === 'in_progress') return 'onorder' as const
  return 'info' as const
}

function shipmentBadge(status: ShipmentStatus) {
  if (status === 'done') return 'success' as const
  if (status === 'delayed') return 'warning' as const
  if (status === 'in_transit') return 'onorder' as const
  return 'info' as const
}

function stopCount(routeId: string) {
  const stops = deliveries.value.filter((item) => item.routeId === routeId)
  return { done: stops.filter((item) => item.status === 'delivered').length, total: stops.length }
}

const proofOpen = ref(false)
const failOpen = ref(false)
const signedBy = ref('')
const signatureDataUrl = ref('')
const geoLabel = ref('Localisation en cours…')
const geoCoords = ref<{ lat: number; lng: number } | null>(null)
const failReason = ref('Client absent')
const proofTarget = ref<string | null>(null)

function captureGeo() {
  geoCoords.value = null
  geoLabel.value = 'Localisation en cours…'
  if (!navigator.geolocation) {
    geoLabel.value = 'GPS indisponible sur cet appareil'
    return
  }
  navigator.geolocation.getCurrentPosition(
    (position) => {
      geoCoords.value = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      }
      geoLabel.value = `${geoCoords.value.lat.toFixed(5)}, ${geoCoords.value.lng.toFixed(5)}`
    },
    () => {
      geoLabel.value = 'GPS refusé — la preuve sera enregistrée sans position'
    },
    { enableHighAccuracy: true, timeout: 8000 },
  )
}

function openProof(id?: string) {
  proofTarget.value = id ?? next.value?.id ?? null
  const row = deliveries.value.find((item) => item.id === proofTarget.value)
  signedBy.value = row?.client ?? ''
  signatureDataUrl.value = ''
  captureGeo()
  proofOpen.value = true
}

async function submitProof() {
  if (!proofTarget.value || !canConfirm.value || !signedBy.value.trim() || !signatureDataUrl.value) return
  await run(async () => {
    const result = await completeDelivery(proofTarget.value!, signedBy.value.trim(), {
      signedBy: signedBy.value.trim(),
      signatureDataUrl: signatureDataUrl.value,
      lat: geoCoords.value?.lat,
      lng: geoCoords.value?.lng,
      signedAt: new Date().toISOString(),
    })
    proofOpen.value = false
    selectedDeliveryId.value = null
    if (!isOnline() || (result && typeof result === 'object' && '_offlineQueued' in result)) {
      toast.message('POD enregistré hors ligne', { description: 'Synchronisation dès le retour réseau.' })
    } else {
      toast.success('Livraison confirmée')
    }
  })
}

async function submitFail() {
  if (!proofTarget.value || !canConfirm.value) return
  await run(async () => {
    const result = await failDelivery(proofTarget.value!, failReason.value.trim() || 'Échec de livraison')
    failOpen.value = false
    selectedDeliveryId.value = null
    if (!isOnline() || (result && typeof result === 'object' && '_offlineQueued' in result)) {
      toast.message('Échec mis en file hors ligne', { description: 'Synchronisation dès le retour réseau.' })
    }
  })
}

async function confirmSelected() {
  if (!selectedDeliveryId.value || !canConfirm.value) return
  openProof(selectedDeliveryId.value)
}

function openDelivery(id: string) {
  selectedDeliveryId.value = id
}
</script>

<template>
  <div class="mx-auto max-w-md pb-4">
    <p class="text-sm text-muted-foreground">Bonjour {{ currentUser?.firstName }}</p>
    <h1 class="mt-1 text-xl font-semibold">Vos courses</h1>

    <div class="mt-4 flex gap-2 overflow-x-auto pb-1">
      <button
        v-for="key in days"
        :key="key"
        class="chip shrink-0"
        :class="day === key ? 'chip-active' : 'text-muted-foreground'"
        @click="day = key"
      >
        {{ dayLabel(key) }}
      </button>
    </div>

    <PageSkeleton v-if="loading" class="mt-6" />

    <template v-else>
      <article v-if="isToday && next" class="surface mt-5 p-5">
        <p class="section-title">Prochain arrêt</p>
        <h2 class="mt-1 text-2xl font-semibold">{{ next.client }}</h2>
        <p class="mt-1 text-sm text-muted-foreground">{{ next.address }} · {{ next.city }}</p>
        <p class="mt-3 text-3xl font-semibold">{{ formatTime(next.scheduledAt) }}</p>
        <p v-if="next.notes" class="mt-2 text-sm text-amber-700">{{ next.notes }}</p>
        <div class="mt-5 grid gap-2">
          <Button size="lg" class="w-full" @click="maps(next.address, next.city)">
            <MapPin class="size-4" />
            Naviguer
          </Button>
          <Button v-if="canConfirm" size="lg" variant="outline" class="w-full" @click="openProof()">
            <Check class="size-4" />
            Livraison effectuée
          </Button>
          <Button v-if="canConfirm" size="lg" variant="outline" class="w-full" @click="proofTarget = next.id; failOpen = true">
            Échec / retour stock
          </Button>
        </div>
        <p class="mt-3 text-center text-xs text-muted-foreground">
          {{ remaining.length }} arrêt{{ remaining.length > 1 ? 's' : '' }} encore à faire
        </p>
      </article>

      <article
        v-else-if="isToday && !deliveries.length && !routes.length && !shipments.length"
        class="surface mt-6 p-6 text-center"
      >
        <p class="font-medium">Rien de prévu aujourd’hui</p>
        <p class="mt-1 text-sm text-muted-foreground">Changez de jour pour voir vos autres courses.</p>
      </article>

      <div class="mt-5 flex gap-1 rounded-md border bg-card p-1">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="flex-1 rounded-lg px-2 py-2 text-xs font-medium"
          :class="view === tab.id ? 'chip-active' : 'text-muted-foreground'"
          @click="setView(tab.id)"
        >
          {{ tab.label }}
          <span class="ml-0.5 tabular-nums">{{ tab.count }}</span>
        </button>
      </div>

      <div v-if="view === 'routes'" class="mt-4 space-y-2">
        <EmptyState
          v-if="!routes.length"
          title="Aucune tournée"
          description="Pas de course planifiée ce jour-là."
        />
        <button
          v-for="item in routes"
          :key="item.id"
          class="surface flex w-full flex-col gap-2 border-l-4 border-l-primary/50 px-4 py-3.5 text-left"
          @click="selectedRouteId = item.id"
        >
          <div class="flex items-start justify-between gap-2">
            <div>
              <p class="font-medium">{{ item.name }}</p>
              <p class="mt-0.5 text-xs text-muted-foreground">
                {{ item.distanceKm }} km · {{ stopCount(item.id).done }}/{{ stopCount(item.id).total }} arrêts
              </p>
            </div>
            <Badge :variant="routeBadge(item.status)">{{ ROUTE_LABEL[item.status] }}</Badge>
          </div>
          <div class="h-1.5 overflow-hidden rounded-full bg-muted">
            <div class="h-full rounded-full bg-primary" :style="{ width: `${item.progress}%` }" />
          </div>
        </button>
      </div>

      <div v-else-if="view === 'stops'" class="mt-4 space-y-2">
        <EmptyState
          v-if="!deliveries.length"
          title="Aucune livraison"
          description="Pas de point de livraison ce jour-là."
        />
        <button
          v-for="item in deliveries"
          :key="item.id"
          class="surface flex w-full items-start justify-between gap-3 border-l-4 px-4 py-3.5 text-left"
          :class="deliveryTone(item.status)"
          @click="openDelivery(item.id)"
        >
          <div class="min-w-0">
            <p class="text-xs tabular-nums text-muted-foreground">{{ item.sequence }}. {{ formatTime(item.scheduledAt) }}</p>
            <p class="mt-0.5 font-medium">{{ item.client }}</p>
            <p class="mt-0.5 text-sm text-muted-foreground">{{ item.address }} · {{ item.city }}</p>
          </div>
          <Badge :variant="deliveryBadge(item.status)">{{ DELIVERY_LABEL[item.status] }}</Badge>
        </button>
      </div>

      <div v-else class="mt-4 space-y-2">
        <EmptyState
          v-if="!shipments.length"
          title="Aucune expédition"
          description="Pas de transfert ni d’expédition ce jour-là."
        />
        <button
          v-for="item in shipments"
          :key="item.id"
          class="surface flex w-full items-start justify-between gap-3 border-l-4 border-l-blue-500 px-4 py-3.5 text-left"
          @click="selectedShipmentId = item.id"
        >
          <div class="min-w-0">
            <p class="flex items-center gap-1.5 font-medium">
              <Truck class="size-3.5 text-muted-foreground" />
              {{ item.destination }}
            </p>
            <p class="mt-0.5 text-sm text-muted-foreground">
              Départ {{ formatTime(item.date) }}
              <span v-if="item.eta"> · ETA {{ formatTime(item.eta) }}</span>
            </p>
          </div>
          <Badge :variant="shipmentBadge(item.status)">{{ SHIPMENT_LABEL[item.status] }}</Badge>
        </button>
      </div>
    </template>

    <DeliveryDetailSheet
      :open="!!selectedDelivery"
      :overview="selectedDelivery"
      :can-confirm="canConfirm"
      @close="selectedDeliveryId = null"
      @confirm="confirmSelected"
    />
    <RouteDetailSheet
      :open="!!selectedRoute && !selectedDelivery"
      :overview="selectedRoute"
      @close="selectedRouteId = null"
      @open-delivery="openDelivery"
    />
    <ShipmentDetailSheet
      :open="!!selectedShipment && !selectedDelivery"
      :overview="selectedShipment"
      @close="selectedShipmentId = null"
      @open-delivery="openDelivery"
    />
    <Sheet :open="proofOpen" title="Preuve de livraison" @close="proofOpen = false">
      <div class="space-y-3">
        <div>
          <Label>Signé par</Label>
          <Input v-model="signedBy" class="mt-1.5" placeholder="Nom du destinataire" />
        </div>
        <div>
          <Label>Signature</Label>
          <PodSignaturePad v-model="signatureDataUrl" class="mt-1.5" />
        </div>
        <p class="text-xs text-muted-foreground">GPS : {{ geoLabel }}</p>
        <p class="text-xs text-muted-foreground">La preuve clôture l’arrêt. En cas d’échec, le stock chargé revient au magasin.</p>
      </div>
      <template #footer>
        <Button class="w-full" :disabled="!signedBy.trim() || !signatureDataUrl" @click="submitProof">Confirmer</Button>
      </template>
    </Sheet>
    <Sheet :open="failOpen" title="Échec de livraison" @close="failOpen = false">
      <div class="space-y-3">
        <Label>Motif</Label>
        <Input v-model="failReason" class="mt-1.5" />
      </div>
      <template #footer>
        <Button class="w-full" variant="outline" @click="submitFail">Retourner au stock</Button>
      </template>
    </Sheet>
  </div>
</template>
