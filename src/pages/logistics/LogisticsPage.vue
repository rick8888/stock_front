<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { CircleAlert, MapPin, Package, Plus, Truck } from 'lucide-vue-next'
import { useDeliveries, useRoutes, useVehicles, useDrivers, useShipments, useShippingNotes } from '@/composables/useLogistics'
import { usePermissions } from '@/composables/usePermissions'
import { useWarehouses } from '@/composables/useWarehouses'
import { useProducts } from '@/composables/useProducts'
import { useCurrentUser } from '@/composables/useAuth'
import { useActionBusy } from '@/composables/useActionBusy'
import { useDataStore } from '@/stores/data'
import PageHeader from '@/components/common/PageHeader.vue'
import SignalCard from '@/components/common/SignalCard.vue'
import PageSkeleton from '@/components/feedback/PageSkeleton.vue'
import EmptyState from '@/components/feedback/EmptyState.vue'
import Tabs from '@/components/ui/Tabs.vue'
import Badge from '@/components/ui/Badge.vue'
import Button from '@/components/ui/Button.vue'
import DeliveryDetailSheet from '@/components/logistics/DeliveryDetailSheet.vue'
import ShipmentDetailSheet from '@/components/logistics/ShipmentDetailSheet.vue'
import RouteDetailSheet from '@/components/logistics/RouteDetailSheet.vue'
import DeliveryFormSheet from '@/components/logistics/DeliveryFormSheet.vue'
import RouteFormSheet from '@/components/logistics/RouteFormSheet.vue'
import ShipmentFormSheet from '@/components/logistics/ShipmentFormSheet.vue'
import VehicleFormSheet from '@/components/logistics/VehicleFormSheet.vue'
import DriverFormSheet from '@/components/logistics/DriverFormSheet.vue'
import ShippingNoteFormSheet from '@/components/logistics/ShippingNoteFormSheet.vue'
import LinePickSheet, { type PickLine, type PickedLine } from '@/components/stock/LinePickSheet.vue'
import { fetchPickPath } from '@/composables/useLocations'
import OfficialDocument from '@/components/documents/OfficialDocument.vue'
import DocumentShareBar from '@/components/documents/DocumentShareBar.vue'
import Sheet from '@/components/ui/Sheet.vue'
import { formatDateTime, formatNumber, formatTime } from '@/lib/utils'
import { useIssuer } from '@/composables/useIssuer'
import { useCustomers } from '@/composables/useCustomers'
import { documentWhatsAppMessage } from '@/utils/documents'
import { downloadShippingNoteLabel } from '@/utils/labels'
import { exportShippingNotesErpCsv } from '@/utils/erpExport'
import { carrierTrackingUrl, listCarriers } from '@/services/carriers.stub'
import { toast } from 'vue-sonner'
import { DELIVERY_LABEL, DRIVER_LABEL, ROUTE_LABEL, SHIPMENT_LABEL, SHIPPING_NOTE_LABEL, VEHICLE_LABEL } from '@/config/logistics'
import { deliveryOverview, routeOverview, shipmentOverview } from '@/services/logistics.overview'
import type { DeliveryInput, DriverInput, RouteInput, ShipmentInput, ShippingNoteInput, VehicleInput } from '@/repositories/interfaces'
import type { Delivery, DeliveryStatus, Driver, Route, Shipment, ShipmentStatus, ShippingNote, Vehicle } from '@/types'

const { can, inScopeWarehouse } = usePermissions()
const { currentUser } = useCurrentUser()
const { run } = useActionBusy()
const { issuer } = useIssuer()
const route = useRoute()
const store = useDataStore()
const { products } = useProducts()
const { warehouses, allWarehouses } = useWarehouses()
const { deliveries, confirmDelivery, createDelivery, updateDelivery, loading } = useDeliveries()
const { routes, createRoute, updateRoute } = useRoutes()
const { vehicles, createVehicle, updateVehicle } = useVehicles()
const { drivers, createDriver, updateDriver } = useDrivers()
const { shipments, createShipment, updateShipment } = useShipments()
const { shippingNotes, createShippingNote, updateShippingNote, assignCarrier, markLabelPrinted, loadShippingNote } =
  useShippingNotes()
const { customers } = useCustomers()
const noteLoadError = ref('')
const loadPickOpen = ref(false)
const loadPickLines = ref<PickLine[]>([])
const carrierDraftId = ref('car-fleet')
const carriers = computed(() => listCarriers())
const canCreate = computed(() => can('delivery.create'))
const canManage = computed(() => can('delivery.create') || can('delivery.update'))
const canPrepare = computed(() => can('stock.issue') || can('delivery.create') || can('delivery.update'))

function defaultTab() {
  if (typeof route.query.tab === 'string') return route.query.tab
  if (canPrepare.value && !canCreate.value) return 'notes'
  return 'deliveries'
}

const tab = ref(defaultTab())
const tabs = computed(() => [
  { id: 'notes', label: 'Bons de livraison' },
  { id: 'deliveries', label: 'Livraisons' },
  { id: 'routes', label: 'Tournées' },
  { id: 'shipments', label: 'Expéditions' },
  { id: 'fleet', label: 'Flotte' },
])

const deliveryFilter = ref<'all' | DeliveryStatus>('all')
const shipmentFilter = ref<'all' | ShipmentStatus>('all')
const selectedDeliveryId = ref<string | null>(null)
const selectedShipmentId = ref<string | null>(null)
const selectedRouteId = ref<string | null>(null)
const deliveryFormOpen = ref(false)
const routeFormOpen = ref(false)
const shipmentFormOpen = ref(false)
const editingDelivery = ref<Delivery | null>(null)
const editingRoute = ref<Route | null>(null)
const editingShipment = ref<Shipment | null>(null)
const vehicleFormOpen = ref(false)
const driverFormOpen = ref(false)
const editingVehicle = ref<Vehicle | null>(null)
const editingDriver = ref<Driver | null>(null)
const initialRouteId = ref<string | undefined>()
const noteFormOpen = ref(false)
const noteDetailOpen = ref(false)
const editingNote = ref<ShippingNote | null>(null)
const selectedNoteId = ref<string | null>(null)
const noteFilter = ref<'all' | ShippingNote['status']>('ready')

watch(
  () => route.query.tab,
  (value) => {
    if (typeof value === 'string') tab.value = value
  },
)

const driverOptions = computed(() =>
  drivers.value.map((driver) => ({
    id: driver.id,
    name: driverName(driver.id),
  })),
)

const createLabel = computed(() => {
  if (tab.value === 'notes') return 'Nouveau bon de livraison'
  if (tab.value === 'routes') return 'Nouvelle tournée'
  if (tab.value === 'shipments') return 'Nouvelle expédition'
  return 'Nouvelle livraison'
})

const showCreate = computed(() => {
  if (tab.value === 'notes') return canPrepare.value
  if (tab.value === 'fleet') return canCreate.value
  return canCreate.value
})

const ctx = computed(() => ({
  warehouses: store.db.warehouses,
  drivers: drivers.value,
  users: store.db.users,
  vehicles: vehicles.value,
  routes: routes.value,
  deliveries: deliveries.value,
}))

const counts = computed(() => ({
  risk: deliveries.value.filter((item) => item.status === 'at_risk' || item.status === 'failed').length,
  moving: deliveries.value.filter((item) => item.status === 'in_transit').length,
  delivered: deliveries.value.filter((item) => item.status === 'delivered').length,
  routes: routes.value.filter((item) => item.status === 'in_progress').length,
  readyNotes: scopedNotes.value.filter((item) => item.status === 'ready').length,
}))

const scopedNotes = computed(() =>
  shippingNotes.value.filter((item) => inScopeWarehouse(item.warehouseId)),
)

const noteChips = computed(() => [
  { id: 'ready' as const, label: 'Prêts', count: scopedNotes.value.filter((item) => item.status === 'ready').length },
  { id: 'assigned' as const, label: 'Affectés', count: scopedNotes.value.filter((item) => item.status === 'assigned').length },
  { id: 'delivered' as const, label: 'Livrés', count: scopedNotes.value.filter((item) => item.status === 'delivered').length },
  { id: 'all' as const, label: 'Tous', count: scopedNotes.value.length },
])

const visibleNotes = computed(() => {
  const list = [...scopedNotes.value].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '') || a.code.localeCompare(b.code))
  if (noteFilter.value === 'all') return list
  return list.filter((item) => item.status === noteFilter.value)
})

const selectedNote = computed(() => scopedNotes.value.find((item) => item.id === selectedNoteId.value) ?? null)

const noteLinked = computed(() => {
  const note = selectedNote.value
  if (!note) return { driverName: '', driverPhone: '', vehicleLabel: '', warehouseName: '', warehouseAddress: '', date: '' }
  const delivery = note.deliveryId ? deliveries.value.find((item) => item.id === note.deliveryId) : undefined
  const shipment = note.shipmentId ? shipments.value.find((item) => item.id === note.shipmentId) : undefined
  const driverId = delivery?.driverId ?? shipment?.driverId
  const vehicleId = delivery?.vehicleId ?? shipment?.vehicleId
  const driver = driverId ? drivers.value.find((item) => item.id === driverId) : undefined
  const warehouse = store.db.warehouses.find((item) => item.id === note.warehouseId)
  return {
    driverName: driverId ? driverName(driverId) : '',
    driverPhone: driver?.phone ?? '',
    vehicleLabel: vehicleId ? vehicleLabel(vehicleId) : '',
    warehouseName: warehouse?.name ?? warehouseName(note.warehouseId),
    warehouseAddress: warehouse?.address ?? '',
    date: note.createdAt ?? note.loadedAt ?? delivery?.scheduledAt ?? shipment?.date ?? '',
  }
})

const noteLines = computed(() =>
  (selectedNote.value?.lines ?? []).map((line) => ({
    name: line.productName,
    sku: line.sku,
    qty: `${formatNumber(line.quantity)} ${line.unit}`,
  })),
)

const noteContacts = computed(() => {
  const phone = noteLinked.value.driverPhone
  if (!phone) return []
  return [{ label: noteLinked.value.driverName || 'Chauffeur', phone, hint: 'Chauffeur' }]
})

const noteMessage = computed(() => {
  const note = selectedNote.value
  if (!note) return ''
  const linked = noteLinked.value
  return documentWhatsAppMessage({
    title: 'Bon de livraison',
    code: note.code,
    issuer: issuer.value.name,
    lines: [
      `Client : ${note.client}`,
      `Adresse : ${note.address}, ${note.city}`,
      linked.driverName ? `Chauffeur : ${linked.driverName}` : '',
      ...note.lines.map((line) => `• ${line.productName} × ${line.quantity} ${line.unit}`),
    ],
  })
})

const deliveryChips = computed(() => [
  { id: 'all' as const, label: 'Toutes', count: deliveries.value.length },
  { id: 'at_risk' as const, label: 'À risque', count: counts.value.risk },
  { id: 'in_transit' as const, label: 'En tournée', count: counts.value.moving },
  { id: 'prepared' as const, label: 'Préparées', count: deliveries.value.filter((item) => item.status === 'prepared').length },
  { id: 'delivered' as const, label: 'Livrées', count: counts.value.delivered },
])

const visibleDeliveries = computed(() => {
  const list = [...deliveries.value].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
  if (deliveryFilter.value === 'all') return list
  if (deliveryFilter.value === 'at_risk') {
    return list.filter((item) => item.status === 'at_risk' || item.status === 'failed')
  }
  return list.filter((item) => item.status === deliveryFilter.value)
})

const shipmentChips = computed(() => [
  { id: 'all' as const, label: 'Toutes', count: shipments.value.length },
  { id: 'in_transit' as const, label: 'En transit', count: shipments.value.filter((item) => item.status === 'in_transit').length },
  { id: 'delayed' as const, label: 'Retard', count: shipments.value.filter((item) => item.status === 'delayed').length },
  { id: 'preparing' as const, label: 'Préparation', count: shipments.value.filter((item) => item.status === 'preparing').length },
])

const visibleShipments = computed(() => {
  if (shipmentFilter.value === 'all') return shipments.value
  return shipments.value.filter((item) => item.status === shipmentFilter.value)
})

const selectedDelivery = computed(() => {
  const item = deliveries.value.find((row) => row.id === selectedDeliveryId.value)
  return item ? deliveryOverview(item, ctx.value) : null
})

const selectedShipment = computed(() => {
  const item = shipments.value.find((row) => row.id === selectedShipmentId.value)
  return item ? shipmentOverview(item, ctx.value) : null
})

const selectedRoute = computed(() => {
  const item = routes.value.find((row) => row.id === selectedRouteId.value)
  return item ? routeOverview(item, ctx.value) : null
})

function driverName(id: string) {
  const driver = drivers.value.find((item) => item.id === id)
  const user = store.db.users.find((item) => item.id === driver?.userId)
  return user ? `${user.firstName} ${user.lastName}` : id
}

function vehicleLabel(id: string) {
  const vehicle = vehicles.value.find((item) => item.id === id)
  return vehicle ? `${vehicle.name} · ${vehicle.plate}` : id
}

function warehouseName(id: string) {
  return store.db.warehouses.find((item) => item.id === id)?.name ?? id
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

function shipmentTone(status: ShipmentStatus) {
  if (status === 'done') return 'border-l-emerald-500'
  if (status === 'delayed') return 'border-l-amber-500'
  if (status === 'in_transit') return 'border-l-blue-500'
  return 'border-l-primary/40'
}

function shipmentBadge(status: ShipmentStatus) {
  if (status === 'done') return 'success' as const
  if (status === 'delayed') return 'warning' as const
  if (status === 'in_transit') return 'onorder' as const
  return 'info' as const
}

function routeTone(status: string) {
  if (status === 'done') return 'border-l-emerald-500'
  if (status === 'in_progress') return 'border-l-blue-500'
  return 'border-l-primary/40'
}

function openDelivery(id: string) {
  selectedDeliveryId.value = id
}

function openCreate() {
  if (tab.value === 'notes') openNewNote()
  else if (tab.value === 'routes') openNewRoute()
  else if (tab.value === 'shipments') openNewShipment()
  else if (tab.value === 'fleet') openNewVehicle()
  else openNewDelivery()
}

function openNewNote() {
  editingNote.value = null
  noteFormOpen.value = true
}

function openNote(id: string) {
  selectedNoteId.value = id
  noteDetailOpen.value = true
}

watch(
  () => [route.query.delivery, deliveries.value] as const,
  () => {
    const id = route.query.delivery
    if (typeof id === 'string' && id) selectedDeliveryId.value = id
  },
)

watch(
  () => [route.query.note, shippingNotes.value] as const,
  () => {
    const id = route.query.note
    if (typeof id === 'string' && id) openNote(id)
  },
)

function openEditNote() {
  if (!selectedNote.value || selectedNote.value.status !== 'ready' || !canPrepare.value) return
  editingNote.value = selectedNote.value
  noteDetailOpen.value = false
  noteFormOpen.value = true
}

async function openLoadPick() {
  if (!selectedNote.value || !currentUser.value) return
  noteLoadError.value = ''
  const note = selectedNote.value
  try {
    const steps = await fetchPickPath(
      note.warehouseId,
      note.lines.map((line) => ({
        productId: line.productId,
        quantity: line.quantity,
        productName: line.productName,
        sku: line.sku,
      })),
    )
    loadPickLines.value = steps.map((step, index) => {
      const product = products.value.find((item) => item.id === step.productId)
      const noteLine = note.lines.find((line) => line.productId === step.productId)
      return {
        key: `${step.productId}:${step.locationId ?? 'x'}:${index}`,
        productId: step.productId,
        productName: step.productName,
        sku: step.sku ?? product?.sku,
        barcode: product?.barcode,
        quantity: step.quantity,
        unit: noteLine?.unit ?? product?.unit,
        trackLots: product?.trackLots,
        locationId: step.locationId,
        locationCode: step.locationCode,
        aisle: step.aisle,
        rack: step.rack,
        bin: step.bin,
        unlocated: step.unlocated,
      }
    })
    if (!loadPickLines.value.length) {
      loadPickLines.value = note.lines.map((line) => {
        const product = products.value.find((item) => item.id === line.productId)
        return {
          productId: line.productId,
          productName: line.productName,
          sku: line.sku ?? product?.sku,
          barcode: product?.barcode,
          quantity: line.quantity,
          unit: line.unit,
          trackLots: product?.trackLots,
          unlocated: true,
        }
      })
    }
    loadPickOpen.value = true
  } catch (err) {
    noteLoadError.value = err instanceof Error ? err.message : 'Chemin de picking indisponible'
  }
}

function openNewVehicle() {
  editingVehicle.value = null
  vehicleFormOpen.value = true
}

function openNewDriver() {
  editingDriver.value = null
  driverFormOpen.value = true
}

function openEditDriverRow(driver: Driver) {
  editingDriver.value = driver
  driverFormOpen.value = true
}

function openEditVehicle(vehicle: Vehicle) {
  editingVehicle.value = vehicle
  vehicleFormOpen.value = true
}

async function printNoteLabel() {
  const note = selectedNote.value
  if (!note) return
  downloadShippingNoteLabel({
    note,
    warehouseName: warehouseName(note.warehouseId),
    issuerName: issuer.value.name,
  })
  await run(async () => {
    await markLabelPrinted(note.id)
  })
}

async function saveShippingNote(payload: { id?: string; input: ShippingNoteInput }) {
  await run(async () => {
    if (payload.id) await updateShippingNote(payload.id, payload.input)
    else {
      const created = await createShippingNote(payload.input)
      selectedNoteId.value = created.id
      noteDetailOpen.value = true
    }
    noteFormOpen.value = false
    editingNote.value = null
  })
}

async function confirmLoadPick(_lines: PickedLine[]) {
  if (!selectedNote.value || !currentUser.value) return
  await run(async () => {
    noteLoadError.value = ''
    try {
      await loadShippingNote(selectedNote.value!.id, currentUser.value!.id)
      loadPickOpen.value = false
      noteDetailOpen.value = false
      selectedNoteId.value = null
    } catch (err) {
      noteLoadError.value = err instanceof Error ? err.message : 'Chargement impossible'
    }
  })
}

async function bookCarrierForNote() {
  const note = selectedNote.value
  if (!note || !carrierDraftId.value) return
  await run(async () => {
    await assignCarrier(note.id, { carrierId: carrierDraftId.value, book: true })
    toast.success('Transporteur réservé (stub)', {
      description: 'Numéro de suivi généré — prêt pour étiquette / export ERP.',
    })
  })
}

function openCarrierTracking() {
  const note = selectedNote.value
  if (!note?.trackingNumber) return
  const carrier = carriers.value.find((item) => item.id === note.carrierId) ?? listCarriers(false).find((item) => item.id === note.carrierId)
  const url = carrierTrackingUrl(carrier, note.trackingNumber)
  if (url) window.open(url, '_blank', 'noopener')
  else toast.message('Pas d’URL de suivi pour ce transporteur')
}

function exportNotesErp() {
  exportShippingNotesErpCsv(shippingNotes.value, warehouseName)
  toast.success('Export ERP généré', { description: 'CSV compatible Excel / import Odoo stub.' })
}

watch(
  () => selectedNote.value?.id,
  () => {
    carrierDraftId.value = selectedNote.value?.carrierId ?? 'car-fleet'
  },
)
function assignedDriver(vehicleId: string) {
  return drivers.value.find((item) => item.vehicleId === vehicleId)
}

function assignedDriverName(vehicleId: string) {
  const driver = assignedDriver(vehicleId)
  return driver ? driverName(driver.id) : 'Aucun chauffeur affecté'
}

function assignedVehicle(driver: Driver) {
  return driver.vehicleId ? vehicles.value.find((item) => item.id === driver.vehicleId) : undefined
}

function assignedVehicleLabel(driver: Driver) {
  const vehicle = assignedVehicle(driver)
  return vehicle ? `${vehicle.name} · ${vehicle.plate}` : 'Aucun véhicule affecté'
}

function driverUser(driver: Driver) {
  return store.db.users.find((item) => item.id === driver.userId) ?? null
}

async function saveVehicle(payload: { id?: string; input: VehicleInput }) {
  await run(async () => {
    if (payload.id) await updateVehicle(payload.id, payload.input)
    else await createVehicle(payload.input)
    vehicleFormOpen.value = false
    editingVehicle.value = null
  })
}

async function saveDriver(payload: { id?: string; input: DriverInput }) {
  await run(async () => {
    if (payload.id) await updateDriver(payload.id, payload.input)
    else await createDriver(payload.input)
    driverFormOpen.value = false
    editingDriver.value = null
  })
}

function openNewRoute() {
  editingRoute.value = null
  routeFormOpen.value = true
}

function openNewDelivery(routeId?: string) {
  editingDelivery.value = null
  initialRouteId.value = routeId ?? selectedRouteId.value ?? undefined
  deliveryFormOpen.value = true
}

function openNewShipment() {
  editingShipment.value = null
  shipmentFormOpen.value = true
}

function openEditDelivery() {
  const item = deliveries.value.find((row) => row.id === selectedDeliveryId.value)
  if (!item) return
  editingDelivery.value = item
  initialRouteId.value = item.routeId
  deliveryFormOpen.value = true
}

function openEditRoute() {
  const item = routes.value.find((row) => row.id === selectedRouteId.value)
  if (!item) return
  editingRoute.value = item
  routeFormOpen.value = true
}

function openEditShipment() {
  const item = shipments.value.find((row) => row.id === selectedShipmentId.value)
  if (!item) return
  editingShipment.value = item
  shipmentFormOpen.value = true
}

async function saveDelivery(payload: { id?: string; input: DeliveryInput }) {
  await run(async () => {
    if (payload.id) await updateDelivery(payload.id, payload.input)
    else {
      const created = await createDelivery(payload.input)
      selectedDeliveryId.value = created.id
    }
    deliveryFormOpen.value = false
    editingDelivery.value = null
  })
}

async function saveRoute(payload: { id?: string; input: RouteInput }) {
  await run(async () => {
    if (payload.id) await updateRoute(payload.id, payload.input)
    else {
      const created = await createRoute(payload.input)
      selectedRouteId.value = created.id
      tab.value = 'routes'
    }
    routeFormOpen.value = false
    editingRoute.value = null
  })
}

async function saveShipment(payload: { id?: string; input: ShipmentInput }) {
  await run(async () => {
    if (payload.id) await updateShipment(payload.id, payload.input)
    else {
      const created = await createShipment(payload.input)
      selectedShipmentId.value = created.id
    }
    shipmentFormOpen.value = false
    editingShipment.value = null
  })
}

async function confirmSelected() {
  if (!selectedDeliveryId.value) return
  await run(async () => {
    await confirmDelivery(selectedDeliveryId.value!)
    selectedDeliveryId.value = null
  })
}

function stopCount(routeId: string) {
  const stops = deliveries.value.filter((item) => item.routeId === routeId)
  const done = stops.filter((item) => item.status === 'delivered').length
  return { done, total: stops.length }
}
</script>

<template>
  <div class="page-wide">
    <PageHeader title="Logistique" description="Ce qui roule, ce qui retarde, ce qu’il faut débloquer.">
      <template v-if="showCreate" #actions>
        <template v-if="tab === 'fleet'">
          <div class="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" @click="openNewDriver">
              <Plus class="size-4" />
              Nouveau chauffeur
            </Button>
            <Button size="sm" @click="openNewVehicle">
              <Plus class="size-4" />
              Nouveau véhicule
            </Button>
          </div>
        </template>
        <Button v-else size="sm" @click="openCreate">
          <Plus class="size-4" />
          {{ createLabel }}
        </Button>
      </template>
    </PageHeader>

    <div class="metric-strip mb-5 sm:grid-cols-2 xl:grid-cols-4">
      <SignalCard label="Bons prêts" :value="counts.readyNotes" trend="À affecter à une tournée" :icon="Package" />
      <SignalCard label="À risque" :value="counts.risk" trend="Créneaux sous tension" :icon="CircleAlert" tone="warning" />
      <SignalCard label="En tournée" :value="counts.moving" trend="Véhicules en mouvement" :icon="Truck" />
      <SignalCard label="Tournées actives" :value="counts.routes" trend="En cours de tournée" :icon="MapPin" />
    </div>

    <Tabs v-model="tab" :tabs="tabs" class="mb-6" />
    <PageSkeleton v-if="loading" />

    <div v-else-if="tab === 'notes'" class="space-y-4">
      <div class="flex flex-wrap gap-2">
        <button
          v-for="chip in noteChips"
          :key="chip.id"
          class="chip"
          :class="noteFilter === chip.id ? 'chip-active' : ''"
          @click="noteFilter = chip.id"
        >
          {{ chip.label }}
          <span class="ml-1 tabular-nums">{{ chip.count }}</span>
        </button>
      </div>
      <EmptyState
        v-if="!visibleNotes.length"
        title="Aucun bon dans ce filtre"
        :description="canPrepare ? 'Préparez un bon pour notifier le logisticien.' : 'Les bons préparés en magasin apparaîtront ici.'"
      />
      <button
        v-for="item in visibleNotes"
        :key="item.id"
        class="surface flex w-full items-start justify-between gap-3 border-l-4 px-4 py-3.5 text-left transition-colors hover:bg-muted/40"
        :class="item.status === 'ready' ? 'border-l-primary' : item.status === 'delivered' ? 'border-l-emerald-500' : 'border-l-blue-500'"
        @click="openNote(item.id)"
      >
        <div class="min-w-0">
          <p class="font-medium">{{ item.code }} · {{ item.client }}</p>
          <p class="mt-0.5 text-sm text-muted-foreground">
            {{ item.city }} · {{ warehouseName(item.warehouseId) }} · {{ item.lines.length }} article{{ item.lines.length > 1 ? 's' : '' }}
          </p>
        </div>
        <Badge :variant="item.status === 'ready' ? 'info' : item.status === 'delivered' ? 'success' : 'onorder'">
          {{ SHIPPING_NOTE_LABEL[item.status] }}
        </Badge>
      </button>
      <div class="flex justify-end">
        <Button size="sm" variant="outline" :disabled="!shippingNotes.length" @click="exportNotesErp">
          Export ERP (CSV)
        </Button>
      </div>
    </div>

    <div v-else-if="tab === 'deliveries'" class="space-y-4">
      <div class="flex flex-wrap gap-2">
        <button
          v-for="chip in deliveryChips"
          :key="chip.id"
          class="chip"
          :class="deliveryFilter === chip.id ? 'chip-active' : 'text-muted-foreground'"
          @click="deliveryFilter = chip.id"
        >
          {{ chip.label }}
          <span class="ml-1 tabular-nums">{{ chip.count }}</span>
        </button>
      </div>
      <EmptyState v-if="!visibleDeliveries.length" title="Aucune livraison" description="Rien dans ce filtre." />
      <button
        v-for="item in visibleDeliveries"
        :key="item.id"
        class="surface flex w-full items-start justify-between gap-3 border-l-4 px-4 py-3.5 text-left transition-colors hover:bg-muted/40"
        :class="deliveryTone(item.status)"
        @click="openDelivery(item.id)"
      >
        <div class="min-w-0">
          <p class="font-medium">{{ item.client }}</p>
          <p class="mt-0.5 text-sm text-muted-foreground">
            {{ item.city }} · {{ formatTime(item.scheduledAt) }} · {{ driverName(item.driverId) }}
          </p>
        </div>
        <Badge :variant="deliveryBadge(item.status)">{{ DELIVERY_LABEL[item.status] }}</Badge>
      </button>
    </div>

    <div v-else-if="tab === 'routes'" class="space-y-2">
      <button
        v-for="route in routes"
        :key="route.id"
        class="surface flex w-full flex-col gap-2 border-l-4 px-4 py-3.5 text-left transition-colors hover:bg-muted/40"
        :class="routeTone(route.status)"
        @click="selectedRouteId = route.id"
      >
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="font-medium">{{ route.name }}</p>
            <p class="mt-0.5 text-sm text-muted-foreground">
              {{ driverName(route.driverId) }} · {{ vehicleLabel(route.vehicleId) }} · {{ route.distanceKm }} km
            </p>
          </div>
          <Badge :variant="route.status === 'in_progress' ? 'onorder' : route.status === 'done' ? 'success' : 'info'">
            {{ ROUTE_LABEL[route.status] }}
          </Badge>
        </div>
        <div class="h-1.5 overflow-hidden rounded-full bg-muted">
          <div class="h-full rounded-full bg-primary" :style="{ width: `${route.progress}%` }" />
        </div>
        <p class="text-xs text-muted-foreground">
          {{ stopCount(route.id).done }} / {{ stopCount(route.id).total }} arrêts · {{ route.progress }} %
        </p>
      </button>
    </div>

    <div v-else-if="tab === 'shipments'" class="space-y-4">
      <div class="flex flex-wrap gap-2">
        <button
          v-for="chip in shipmentChips"
          :key="chip.id"
          class="chip"
          :class="shipmentFilter === chip.id ? 'chip-active' : 'text-muted-foreground'"
          @click="shipmentFilter = chip.id"
        >
          {{ chip.label }}
          <span class="ml-1 tabular-nums">{{ chip.count }}</span>
        </button>
      </div>
      <EmptyState v-if="!visibleShipments.length" title="Aucune expédition" description="Rien dans ce filtre." />
      <button
        v-for="shipment in visibleShipments"
        :key="shipment.id"
        class="surface flex w-full items-start justify-between gap-3 border-l-4 px-4 py-3.5 text-left transition-colors hover:bg-muted/40"
        :class="shipmentTone(shipment.status)"
        @click="selectedShipmentId = shipment.id"
      >
        <div class="min-w-0">
          <p class="font-medium">{{ shipment.destination }}</p>
          <p class="mt-0.5 text-sm text-muted-foreground">
            {{ warehouseName(shipment.originWarehouseId) }} · {{ driverName(shipment.driverId) }} ·
            {{ formatDateTime(shipment.date) }}
          </p>
        </div>
        <div class="shrink-0 text-right">
          <Badge :variant="shipmentBadge(shipment.status)">{{ SHIPMENT_LABEL[shipment.status] }}</Badge>
          <p class="mt-1 text-xs tabular-nums text-muted-foreground">{{ shipment.progress }} %</p>
        </div>
      </button>
    </div>

    <div v-else class="grid gap-6 lg:grid-cols-2">
      <section class="space-y-2">
        <h2 class="text-sm font-semibold">Véhicules</h2>
        <button
          v-for="vehicle in vehicles"
          :key="vehicle.id"
          class="surface flex w-full flex-col items-start border-l-4 border-l-primary/40 px-4 py-3.5 text-left transition-colors hover:bg-muted/40"
          @click="canManage && openEditVehicle(vehicle)"
        >
          <p class="font-medium">{{ vehicle.name }}</p>
          <p class="mt-0.5 text-sm text-muted-foreground">
            {{ vehicle.plate }} · {{ warehouseName(vehicle.warehouseId) }}
          </p>
          <p class="mt-1 text-xs text-muted-foreground">{{ assignedDriverName(vehicle.id) }}</p>
          <Badge class="mt-2" :variant="vehicle.status === 'on_mission' ? 'onorder' : vehicle.status === 'maintenance' ? 'warning' : 'success'">
            {{ VEHICLE_LABEL[vehicle.status] }}
          </Badge>
        </button>
      </section>
      <section class="space-y-2">
        <h2 class="text-sm font-semibold">Chauffeurs</h2>
        <button
          v-for="driver in drivers"
          :key="driver.id"
          class="surface flex w-full flex-col items-start border-l-4 border-l-primary/40 px-4 py-3.5 text-left transition-colors hover:bg-muted/40"
          @click="canManage && openEditDriverRow(driver)"
        >
          <p class="font-medium">{{ driverName(driver.id) }}</p>
          <p class="mt-0.5 text-sm text-muted-foreground">{{ driver.phone }}</p>
          <p class="mt-1 text-xs text-muted-foreground">{{ assignedVehicleLabel(driver) }}</p>
          <Badge class="mt-2" :variant="driver.status === 'on_route' ? 'onorder' : driver.status === 'off' ? 'warning' : 'success'">
            {{ DRIVER_LABEL[driver.status] }}
          </Badge>
        </button>
      </section>
    </div>

    <DeliveryDetailSheet
      :open="!!selectedDelivery && !deliveryFormOpen"
      :overview="selectedDelivery"
      :can-confirm="can('delivery.confirm')"
      :can-edit="canManage"
      @close="selectedDeliveryId = null"
      @confirm="confirmSelected"
      @edit="openEditDelivery"
    />
    <ShipmentDetailSheet
      :open="!!selectedShipment && !selectedDelivery && !shipmentFormOpen"
      :overview="selectedShipment"
      :can-edit="canManage"
      @close="selectedShipmentId = null"
      @open-delivery="openDelivery"
      @edit="openEditShipment"
    />
    <RouteDetailSheet
      :open="!!selectedRoute && !selectedDelivery && !routeFormOpen && !deliveryFormOpen"
      :overview="selectedRoute"
      :can-edit="canManage"
      :can-create="canCreate"
      @close="selectedRouteId = null"
      @open-delivery="openDelivery"
      @edit="openEditRoute"
      @add-stop="openNewDelivery(selectedRouteId ?? undefined)"
    />
    <ShippingNoteFormSheet
      :open="noteFormOpen"
      :note="editingNote"
      :warehouses="warehouses"
      :products="products"
      :customers="customers"
      @close="noteFormOpen = false; editingNote = null"
      @submit="saveShippingNote"
    />
    <Sheet
      :open="noteDetailOpen && !!selectedNote"
      :title="selectedNote?.code ?? 'Bon de livraison'"
      wide
      @close="noteDetailOpen = false; selectedNoteId = null"
    >
      <div v-if="selectedNote" class="space-y-3">
        <p class="text-sm text-muted-foreground">
          {{ warehouseName(selectedNote.warehouseId) }} · {{ SHIPPING_NOTE_LABEL[selectedNote.status] }}
        </p>
        <OfficialDocument
          title="Bon de livraison"
          :code="selectedNote.code"
          :date="noteLinked.date"
          :issuer-name="issuer.name"
          :issuer-legal="issuer.legalName"
          :issuer-ice="issuer.ice"
          :issuer-city="issuer.city"
          :issuer-phone="issuer.phone"
          :issuer-email="issuer.email"
          :parties="[
            { title: 'Expéditeur', name: noteLinked.warehouseName, detail: noteLinked.warehouseAddress },
            { title: 'Destinataire', name: selectedNote.client, detail: `${selectedNote.address}, ${selectedNote.city}` },
            ...(noteLinked.driverName
              ? [{ title: 'Chauffeur', name: noteLinked.driverName, detail: noteLinked.vehicleLabel }]
              : []),
          ]"
          :lines="noteLines"
          :notes="selectedNote.notes"
          :signatures="[
            { label: 'Signature magasin' },
            { label: 'Signature chauffeur', name: noteLinked.driverName },
          ]"
        />
        <div class="rounded-lg border px-3 py-2.5 space-y-2">
          <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Transporteur</p>
          <select v-model="carrierDraftId" class="h-10 w-full rounded-lg border bg-card px-3 text-sm">
            <option v-for="carrier in carriers" :key="carrier.id" :value="carrier.id">{{ carrier.name }}</option>
          </select>
          <p v-if="selectedNote.trackingNumber" class="text-sm">
            Suivi <span class="font-semibold tabular-nums">{{ selectedNote.trackingNumber }}</span>
            <span v-if="selectedNote.carrierName" class="text-muted-foreground"> · {{ selectedNote.carrierName }}</span>
          </p>
          <p v-else class="text-xs text-muted-foreground">Aucun numéro de suivi — réservez un transporteur stub.</p>
          <div class="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              :disabled="!(canPrepare || canCreate || canManage)"
              @click="bookCarrierForNote"
            >
              Réserver / générer suivi
            </Button>
            <Button
              size="sm"
              variant="ghost"
              :disabled="!selectedNote.trackingNumber"
              @click="openCarrierTracking"
            >
              Ouvrir suivi
            </Button>
          </div>
        </div>
        <p v-if="selectedNote.loadedAt" class="text-xs text-emerald-700">Chargé — stock sorti.</p>
        <p v-if="selectedNote.labelPrintedAt" class="text-xs text-muted-foreground">
          Étiquette imprimée · {{ formatDateTime(selectedNote.labelPrintedAt) }}
        </p>
        <p v-if="noteLoadError" class="text-sm text-destructive">{{ noteLoadError }}</p>
      </div>
      <template v-if="selectedNote" #footer>
        <div class="flex flex-col gap-2">
          <DocumentShareBar :filename="selectedNote.code" :message="noteMessage" :contacts="noteContacts" />
          <Button class="w-full" variant="outline" @click="printNoteLabel">Étiquette colis (PDF)</Button>
          <Button
            v-if="can('stock.issue') && !selectedNote.loadedAt && selectedNote.status !== 'delivered'"
            class="w-full"
            @click="openLoadPick"
          >
            Picking + charger
          </Button>
          <Button v-if="canPrepare && selectedNote.status === 'ready'" class="w-full" variant="outline" @click="openEditNote">
            Modifier
          </Button>
        </div>
      </template>
    </Sheet>
    <LinePickSheet
      :open="loadPickOpen"
      title="Picking chargement"
      mode="load"
      confirm-label="Confirmer le chargement"
      :lines="loadPickLines"
      @close="loadPickOpen = false"
      @confirm="confirmLoadPick"
    />
    <VehicleFormSheet
      :open="vehicleFormOpen"
      :vehicle="editingVehicle"
      :warehouses="allWarehouses"
      :drivers="driverOptions"
      :assignments="drivers"
      @close="vehicleFormOpen = false; editingVehicle = null"
      @submit="saveVehicle"
    />
    <DriverFormSheet
      :open="driverFormOpen"
      :driver="editingDriver"
      :user="editingDriver ? driverUser(editingDriver) : null"
      :vehicles="vehicles"
      :warehouses="allWarehouses"
      @close="driverFormOpen = false; editingDriver = null"
      @submit="saveDriver"
    />
  </div>
</template>
