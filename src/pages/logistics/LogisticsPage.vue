<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { CircleAlert, MapPin, Package, Plus, Truck } from 'lucide-vue-next'
import {
  useLogisticsBoard,
  type DriverBoardRow,
  type NoteBoardRow,
  type VehicleBoardRow,
} from '@/composables/useLogistics'
import { useLiveTracking } from '@/composables/useLiveTracking'
import { usePermissions } from '@/composables/usePermissions'
import { useCurrentUser } from '@/composables/useAuth'
import { useActionBusy } from '@/composables/useActionBusy'
import PageHeader from '@/components/common/PageHeader.vue'
import SignalCard from '@/components/common/SignalCard.vue'
import PageSkeleton from '@/components/feedback/PageSkeleton.vue'
import EmptyState from '@/components/feedback/EmptyState.vue'
import ErrorState from '@/components/feedback/ErrorState.vue'
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
import { documentWhatsAppMessage } from '@/utils/documents'
import { downloadShippingNoteLabel } from '@/utils/labels'
import { exportShippingNotesErpCsv } from '@/utils/erpExport'
import { carrierTrackingUrl, listCarriers } from '@/services/carriers.service'
import { toast } from 'vue-sonner'
import { SHIPPING_NOTE_LABEL } from '@/config/logistics'
import type { RouteOverview } from '@/services/logistics.overview'
import type { DeliveryInput, DriverInput, RouteInput, ShipmentInput, ShippingNoteInput, VehicleInput } from '@/repositories/interfaces'
import type { DeliveryStatus, Driver, Route, ShipmentStatus, ShippingNote, Vehicle } from '@/types'

const { can } = usePermissions()
const { currentUser } = useCurrentUser()
const { run } = useActionBusy()
const { issuer } = useIssuer()
const route = useRoute()
const {
  focused,
  metrics,
  counts,
  page,
  pages,
  total,
  noteRows,
  deliveryRows,
  routeRows,
  shipmentRows,
  vehicleRows,
  driverRows,
  products,
  warehouses,
  customers,
  vehicles,
  drivers,
  carriers,
  routes,
  shippingNotes,
  deliveries,
  loadBoard,
  createDelivery,
  updateDelivery,
  confirmDelivery,
  createRoute,
  updateRoute,
  createShipment,
  updateShipment,
  createVehicle,
  updateVehicle,
  createDriver,
  updateDriver,
  createShippingNote,
  updateShippingNote,
  assignCarrier,
  markLabelPrinted,
  startPicking,
  loadShippingNote,
  loading,
  error,
} = useLogisticsBoard({ autoload: false })
const { live: liveRoutes } = useLiveTracking(20_000)

const noteLoadError = ref('')
const loadPickOpen = ref(false)
const loadPickLines = ref<PickLine[]>([])
const carrierDraftId = ref('car-fleet')
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

const deliveryFilter = ref<'all' | DeliveryStatus | 'at_risk'>('all')
const shipmentFilter = ref<'all' | ShipmentStatus>('all')
const noteFilter = ref<'all' | ShippingNote['status']>('ready')
const listPage = ref(1)
const selectedDeliveryId = ref<string | null>(null)
const selectedShipmentId = ref<string | null>(null)
const selectedRouteId = ref<string | null>(null)
const deliveryFormOpen = ref(false)
const routeFormOpen = ref(false)
const shipmentFormOpen = ref(false)
const editingDelivery = ref<import('@/types').Delivery | null>(null)
const editingRoute = ref<Route | null>(null)
const editingShipment = ref<import('@/types').Shipment | null>(null)
const vehicleFormOpen = ref(false)
const driverFormOpen = ref(false)
const editingVehicle = ref<Vehicle | null>(null)
const editingDriver = ref<Driver | null>(null)
const initialRouteId = ref<string | undefined>()
const noteFormOpen = ref(false)
const noteDetailOpen = ref(false)
const editingNote = ref<ShippingNote | null>(null)
const selectedNoteId = ref<string | null>(null)

watch(
  () => route.query.tab,
  (value) => {
    if (typeof value === 'string') tab.value = value
  },
)

const driverOptions = computed(() =>
  drivers.value.map((driver) => ({
    id: driver.id,
    name: driver.name ?? driver.id,
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

function sectionOfTab(value: string): 'notes' | 'deliveries' | 'routes' | 'shipments' | 'fleet' | null {
  if (value === 'notes') return 'notes'
  if (value === 'deliveries') return 'deliveries'
  if (value === 'routes') return 'routes'
  if (value === 'shipments') return 'shipments'
  if (value === 'fleet') return 'fleet'
  return null
}

function activeFilter() {
  if (tab.value === 'notes') return noteFilter.value
  if (tab.value === 'shipments') return shipmentFilter.value
  if (tab.value === 'deliveries') return deliveryFilter.value
  return 'all'
}

function reloadBoard(silent = true) {
  const section = sectionOfTab(tab.value)
  if (!section) return
  void loadBoard(
    {
      section,
      filter: activeFilter(),
      page: listPage.value,
      pageSize: 8,
      focusId:
        typeof route.query.delivery === 'string'
          ? route.query.delivery
          : typeof route.query.note === 'string'
            ? route.query.note
            : typeof route.query.route === 'string'
              ? route.query.route
              : typeof route.query.shipment === 'string'
                ? route.query.shipment
                : undefined,
    },
    silent,
  )
}

watch(
  [tab, noteFilter, deliveryFilter, shipmentFilter, listPage],
  ([nextTab], [prevTab]) => {
    if (nextTab !== prevTab) listPage.value = 1
    reloadBoard(true)
  },
)

watch(page, (value) => {
  if (value && value !== listPage.value) listPage.value = value
})

watch(liveRoutes, () => {
  reloadBoard(true)
})

onMounted(() => reloadBoard(false))

const noteChips = computed(() => [
  { id: 'ready' as const, label: 'Prêts', count: counts.value.ready ?? 0 },
  { id: 'picking' as const, label: 'Préparation', count: counts.value.picking ?? 0 },
  { id: 'loaded' as const, label: 'Chargés', count: counts.value.loaded ?? 0 },
  { id: 'assigned' as const, label: 'Affectés', count: counts.value.assigned ?? 0 },
  { id: 'delivered' as const, label: 'Livrés', count: counts.value.delivered ?? 0 },
  { id: 'all' as const, label: 'Tous', count: counts.value.all ?? 0 },
])

const deliveryChips = computed(() => [
  { id: 'all' as const, label: 'Toutes', count: counts.value.all ?? 0 },
  { id: 'at_risk' as const, label: 'À risque', count: counts.value.at_risk ?? 0 },
  { id: 'in_transit' as const, label: 'En tournée', count: counts.value.in_transit ?? 0 },
  { id: 'prepared' as const, label: 'Préparées', count: counts.value.prepared ?? 0 },
  { id: 'delivered' as const, label: 'Livrées', count: counts.value.delivered ?? 0 },
])

const shipmentChips = computed(() => [
  { id: 'all' as const, label: 'Toutes', count: counts.value.all ?? 0 },
  { id: 'in_transit' as const, label: 'En transit', count: counts.value.in_transit ?? 0 },
  { id: 'delayed' as const, label: 'Retard', count: counts.value.delayed ?? 0 },
  { id: 'preparing' as const, label: 'Préparation', count: counts.value.preparing ?? 0 },
])

const selectedNoteRow = computed((): NoteBoardRow | null => {
  const fromPage = noteRows.value.find((item) => item.note.id === selectedNoteId.value)
  if (fromPage) return fromPage
  const fromFocus = focused.value as NoteBoardRow | null
  if (fromFocus?.note?.id === selectedNoteId.value) return fromFocus
  const note = shippingNotes.value.find((item) => item.id === selectedNoteId.value)
  if (!note) return null
  return {
    note,
    code: note.code,
    statusLabel: SHIPPING_NOTE_LABEL[note.status],
    warehouseName: warehouses.value.find((item) => item.id === note.warehouseId)?.name ?? note.warehouseId,
    warehouseAddress: warehouses.value.find((item) => item.id === note.warehouseId)?.address ?? '',
    driverName: '',
    driverPhone: '',
    vehicleLabel: '',
    date: note.createdAt ?? note.loadedAt ?? '',
    linesCount: note.lines?.length ?? 0,
  }
})

const selectedNote = computed(() => selectedNoteRow.value?.note ?? null)

const selectedDelivery = computed(() => {
  const fromPage = deliveryRows.value.find((item) => item.delivery.id === selectedDeliveryId.value)
  if (fromPage) return fromPage
  const fromFocus = focused.value as import('@/services/logistics.overview').DeliveryOverview | null
  return fromFocus?.delivery?.id === selectedDeliveryId.value ? fromFocus : null
})

const selectedShipment = computed(() => {
  const fromPage = shipmentRows.value.find((item) => item.shipment.id === selectedShipmentId.value)
  if (fromPage) return fromPage
  const fromFocus = focused.value as import('@/services/logistics.overview').ShipmentOverview | null
  return fromFocus?.shipment?.id === selectedShipmentId.value ? fromFocus : null
})

const selectedRoute = computed((): RouteOverview | null => {
  const fromPage = routeRows.value.find((item) => item.route.id === selectedRouteId.value)
  const fromFocus = focused.value as RouteOverview | null
  const row =
    fromPage ?? (fromFocus?.route?.id === selectedRouteId.value ? fromFocus : null)
  if (!row) return null
  const live = liveRoutes.value.find((item) => item.routeId === row.route.id)
  if (!live?.lastPosition) return row
  return {
    ...row,
    progress: live.progress ?? row.progress,
    vehicle: live.lastPosition,
    route: {
      ...row.route,
      progress: live.progress ?? row.route.progress,
      currentPosition: live.lastPosition,
      eta: live.eta ?? row.route.eta,
      status: (live.status as Route['status']) || row.route.status,
    },
  }
})

const noteLinked = computed(() => {
  const row = selectedNoteRow.value
  if (!row) {
    return { driverName: '', driverPhone: '', vehicleLabel: '', warehouseName: '', warehouseAddress: '', date: '' }
  }
  return {
    driverName: row.driverName,
    driverPhone: row.driverPhone,
    vehicleLabel: row.vehicleLabel,
    warehouseName: row.warehouseName,
    warehouseAddress: row.warehouseAddress,
    date: row.date,
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

watch(
  () => [route.query.delivery, deliveryRows.value] as const,
  () => {
    const id = route.query.delivery
    if (typeof id === 'string' && id) selectedDeliveryId.value = id
  },
)

watch(
  () => [route.query.note, noteRows.value] as const,
  () => {
    const id = route.query.note
    if (typeof id === 'string' && id) openNote(id)
  },
)

watch(
  () => selectedNote.value?.id,
  () => {
    carrierDraftId.value = selectedNote.value?.carrierId ?? 'car-fleet'
  },
)

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

function openEditNote() {
  if (!selectedNote.value || selectedNote.value.status !== 'ready' || !canPrepare.value) return
  editingNote.value = selectedNote.value
  noteDetailOpen.value = false
  noteFormOpen.value = true
}

async function beginPicking() {
  if (!selectedNote.value) return
  await run(async () => {
    await startPicking(selectedNote.value!.id)
    toast.success('Préparation démarrée')
  })
}

async function openLoadPick() {
  if (!selectedNote.value || !currentUser.value) return
  noteLoadError.value = ''
  const note = selectedNote.value
  if (note.status === 'ready') {
    try {
      await startPicking(note.id)
    } catch {
      // continue
    }
  }
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
          key: line.productId,
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

function openEditDriverRow(row: DriverBoardRow) {
  editingDriver.value = row.driver
  driverFormOpen.value = true
}

function openEditVehicle(row: VehicleBoardRow) {
  editingVehicle.value = row.vehicle
  vehicleFormOpen.value = true
}

async function printNoteLabel() {
  const note = selectedNote.value
  const row = selectedNoteRow.value
  if (!note || !row) return
  downloadShippingNoteLabel({
    note,
    warehouseName: row.warehouseName,
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
    toast.success('Transporteur réservé', {
      description: 'Numéro de suivi généré — prêt pour étiquette / export ERP.',
    })
  })
}

function openCarrierTracking() {
  const note = selectedNote.value
  if (!note?.trackingNumber) return
  const carrier =
    carriers.value.find((item) => item.id === note.carrierId) ??
    listCarriers(false).find((item) => item.id === note.carrierId)
  const url = carrierTrackingUrl(carrier, note.trackingNumber)
  if (url) window.open(url, '_blank', 'noopener')
  else toast.message('Pas d’URL de suivi pour ce transporteur')
}

function exportNotesErp() {
  const notes = noteRows.value.map((item) => item.note)
  exportShippingNotesErpCsv(notes, (warehouseId) => {
    return (
      noteRows.value.find((item) => item.note.warehouseId === warehouseId)?.warehouseName ??
      warehouses.value.find((item) => item.id === warehouseId)?.name ??
      warehouseId
    )
  })
  toast.success('Export ERP généré', { description: 'CSV de la page courante.' })
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
  const item = selectedDelivery.value?.delivery
  if (!item) return
  editingDelivery.value = item
  initialRouteId.value = item.routeId
  deliveryFormOpen.value = true
}

function openEditRoute() {
  const item = selectedRoute.value?.route
  if (!item) return
  editingRoute.value = item
  routeFormOpen.value = true
}

function openEditShipment() {
  const item = selectedShipment.value?.shipment
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

function driverUser(driver: Driver) {
  return {
    id: driver.userId,
    firstName: drivers.value.find((item) => item.id === driver.id)?.name?.split(' ')[0] ?? '',
    lastName: drivers.value.find((item) => item.id === driver.id)?.name?.split(' ').slice(1).join(' ') ?? '',
    email: '',
    password: '',
    role: 'DRIVER' as const,
    title: 'Chauffeur',
    avatarHue: 0,
    warehouseIds: warehouses.value[0] ? [warehouses.value[0].id] : [],
    productIds: [],
    regionIds: [],
  }
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
      <SignalCard label="Bons prêts" :value="metrics.readyNotes" trend="À affecter à une tournée" :icon="Package" />
      <SignalCard label="À risque" :value="metrics.risk" trend="Créneaux sous tension" :icon="CircleAlert" tone="warning" />
      <SignalCard label="En tournée" :value="metrics.moving" trend="Véhicules en mouvement" :icon="Truck" />
      <SignalCard
        label="Tournées actives"
        :value="metrics.routes"
        :trend="liveRoutes.length ? `${liveRoutes.length} position(s) live` : 'En cours de tournée'"
        :icon="MapPin"
      />
    </div>

    <Tabs v-model="tab" :tabs="tabs" class="mb-6" />
    <PageSkeleton v-if="loading" />
    <ErrorState v-else-if="error" :message="error" />

    <div v-else-if="tab === 'notes'" class="space-y-4">
      <div class="flex flex-wrap gap-2">
        <button
          v-for="chip in noteChips"
          :key="chip.id"
          class="chip"
          :class="noteFilter === chip.id ? 'chip-active' : ''"
          @click="noteFilter = chip.id; listPage = 1"
        >
          {{ chip.label }}
          <span class="ml-1 tabular-nums">{{ chip.count }}</span>
        </button>
      </div>
      <EmptyState
        v-if="!noteRows.length"
        title="Aucun bon dans ce filtre"
        :description="canPrepare ? 'Préparez un bon pour notifier le logisticien.' : 'Les bons préparés en magasin apparaîtront ici.'"
      />
      <button
        v-for="item in noteRows"
        :key="item.note.id"
        class="surface flex w-full items-start justify-between gap-3 border-l-4 px-4 py-3.5 text-left transition-colors hover:bg-muted/40"
        :class="
          item.note.status === 'ready' || item.note.status === 'picking'
            ? 'border-l-primary'
            : item.note.status === 'delivered'
              ? 'border-l-emerald-500'
              : item.note.status === 'loaded'
                ? 'border-l-amber-500'
                : 'border-l-blue-500'
        "
        @click="openNote(item.note.id)"
      >
        <div class="min-w-0">
          <p class="font-medium">{{ item.code }} · {{ item.note.client }}</p>
          <p class="mt-0.5 text-sm text-muted-foreground">
            {{ item.note.city }} · {{ item.warehouseName }} · {{ item.linesCount }} article{{ item.linesCount > 1 ? 's' : '' }}
            <span v-if="item.note.loadedAt"> · chargé</span>
          </p>
        </div>
        <Badge
          :variant="
            item.note.status === 'ready' || item.note.status === 'picking'
              ? 'info'
              : item.note.status === 'delivered'
                ? 'success'
                : 'onorder'
          "
        >
          {{ item.statusLabel }}
        </Badge>
      </button>
      <div class="flex items-center justify-between gap-2">
        <Button size="sm" variant="outline" :disabled="!noteRows.length" @click="exportNotesErp">
          Export ERP (CSV)
        </Button>
        <div v-if="pages > 1" class="flex items-center gap-1.5 text-[13px]">
          <Button size="sm" variant="outline" :disabled="listPage <= 1" @click="listPage -= 1">Précédent</Button>
          <span class="px-2 py-1 tabular-nums text-muted-foreground">{{ page }}/{{ pages }}</span>
          <Button size="sm" variant="outline" :disabled="listPage >= pages" @click="listPage += 1">Suivant</Button>
        </div>
      </div>
    </div>

    <div v-else-if="tab === 'deliveries'" class="space-y-4">
      <div class="flex flex-wrap gap-2">
        <button
          v-for="chip in deliveryChips"
          :key="chip.id"
          class="chip"
          :class="deliveryFilter === chip.id ? 'chip-active' : 'text-muted-foreground'"
          @click="deliveryFilter = chip.id; listPage = 1"
        >
          {{ chip.label }}
          <span class="ml-1 tabular-nums">{{ chip.count }}</span>
        </button>
      </div>
      <EmptyState v-if="!deliveryRows.length" title="Aucune livraison" description="Rien dans ce filtre." />
      <button
        v-for="item in deliveryRows"
        :key="item.delivery.id"
        class="surface flex w-full items-start justify-between gap-3 border-l-4 px-4 py-3.5 text-left transition-colors hover:bg-muted/40"
        :class="deliveryTone(item.delivery.status)"
        @click="openDelivery(item.delivery.id)"
      >
        <div class="min-w-0">
          <p class="font-medium">{{ item.delivery.client }}</p>
          <p class="mt-0.5 text-sm text-muted-foreground">
            {{ item.delivery.city }} · {{ formatTime(item.delivery.scheduledAt) }} · {{ item.driverName }}
          </p>
        </div>
        <Badge :variant="deliveryBadge(item.delivery.status)">{{ item.statusLabel }}</Badge>
      </button>
      <div v-if="pages > 1" class="flex items-center justify-end gap-1.5 text-[13px]">
        <p class="mr-2 text-muted-foreground">{{ total }} livraisons</p>
        <Button size="sm" variant="outline" :disabled="listPage <= 1" @click="listPage -= 1">Précédent</Button>
        <span class="px-2 py-1 tabular-nums text-muted-foreground">{{ page }}/{{ pages }}</span>
        <Button size="sm" variant="outline" :disabled="listPage >= pages" @click="listPage += 1">Suivant</Button>
      </div>
    </div>

    <div v-else-if="tab === 'routes'" class="space-y-2">
      <EmptyState v-if="!routeRows.length" title="Aucune tournée" description="Créez une tournée pour planifier les arrêts." />
      <button
        v-for="item in routeRows"
        :key="item.route.id"
        class="surface flex w-full flex-col gap-2 border-l-4 px-4 py-3.5 text-left transition-colors hover:bg-muted/40"
        :class="routeTone(item.route.status)"
        @click="selectedRouteId = item.route.id"
      >
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="font-medium">{{ item.route.name }}</p>
            <p class="mt-0.5 text-sm text-muted-foreground">
              {{ item.driverName }} · {{ item.vehicleLabel }} · {{ item.route.distanceKm }} km
            </p>
          </div>
          <Badge :variant="item.route.status === 'in_progress' ? 'onorder' : item.route.status === 'done' ? 'success' : 'info'">
            {{ item.statusLabel }}
          </Badge>
        </div>
        <div class="h-1.5 overflow-hidden rounded-full bg-muted">
          <div class="h-full rounded-full bg-primary" :style="{ width: `${item.progress}%` }" />
        </div>
        <p class="text-xs text-muted-foreground">
          {{ item.doneCount }} / {{ item.doneCount + item.remainingCount }} arrêts · {{ item.progress }} %
        </p>
      </button>
      <div v-if="pages > 1" class="flex items-center justify-end gap-1.5 text-[13px]">
        <Button size="sm" variant="outline" :disabled="listPage <= 1" @click="listPage -= 1">Précédent</Button>
        <span class="px-2 py-1 tabular-nums text-muted-foreground">{{ page }}/{{ pages }}</span>
        <Button size="sm" variant="outline" :disabled="listPage >= pages" @click="listPage += 1">Suivant</Button>
      </div>
    </div>

    <div v-else-if="tab === 'shipments'" class="space-y-4">
      <div class="flex flex-wrap gap-2">
        <button
          v-for="chip in shipmentChips"
          :key="chip.id"
          class="chip"
          :class="shipmentFilter === chip.id ? 'chip-active' : 'text-muted-foreground'"
          @click="shipmentFilter = chip.id; listPage = 1"
        >
          {{ chip.label }}
          <span class="ml-1 tabular-nums">{{ chip.count }}</span>
        </button>
      </div>
      <EmptyState v-if="!shipmentRows.length" title="Aucune expédition" description="Rien dans ce filtre." />
      <button
        v-for="item in shipmentRows"
        :key="item.shipment.id"
        class="surface flex w-full items-start justify-between gap-3 border-l-4 px-4 py-3.5 text-left transition-colors hover:bg-muted/40"
        :class="shipmentTone(item.shipment.status)"
        @click="selectedShipmentId = item.shipment.id"
      >
        <div class="min-w-0">
          <p class="font-medium">{{ item.shipment.destination }}</p>
          <p class="mt-0.5 text-sm text-muted-foreground">
            {{ item.originName }} · {{ item.driverName }} · {{ formatDateTime(item.shipment.date) }}
          </p>
        </div>
        <div class="shrink-0 text-right">
          <Badge :variant="shipmentBadge(item.shipment.status)">{{ item.statusLabel }}</Badge>
          <p class="mt-1 text-xs tabular-nums text-muted-foreground">{{ item.progress }} %</p>
        </div>
      </button>
      <div v-if="pages > 1" class="flex items-center justify-end gap-1.5 text-[13px]">
        <Button size="sm" variant="outline" :disabled="listPage <= 1" @click="listPage -= 1">Précédent</Button>
        <span class="px-2 py-1 tabular-nums text-muted-foreground">{{ page }}/{{ pages }}</span>
        <Button size="sm" variant="outline" :disabled="listPage >= pages" @click="listPage += 1">Suivant</Button>
      </div>
    </div>

    <div v-else class="grid gap-6 lg:grid-cols-2">
      <section class="space-y-2">
        <h2 class="text-sm font-semibold">Véhicules</h2>
        <EmptyState v-if="!vehicleRows.length" title="Aucun véhicule" />
        <button
          v-for="row in vehicleRows"
          :key="row.vehicle.id"
          class="surface flex w-full flex-col items-start border-l-4 border-l-primary/40 px-4 py-3.5 text-left transition-colors hover:bg-muted/40"
          @click="canManage && openEditVehicle(row)"
        >
          <p class="font-medium">{{ row.vehicle.name }}</p>
          <p class="mt-0.5 text-sm text-muted-foreground">
            {{ row.vehicle.plate }} · {{ row.warehouseName }}
          </p>
          <p class="mt-1 text-xs text-muted-foreground">{{ row.driverName }}</p>
          <Badge class="mt-2" :variant="row.vehicle.status === 'on_mission' ? 'onorder' : row.vehicle.status === 'maintenance' ? 'warning' : 'success'">
            {{ row.statusLabel }}
          </Badge>
        </button>
      </section>
      <section class="space-y-2">
        <h2 class="text-sm font-semibold">Chauffeurs</h2>
        <EmptyState v-if="!driverRows.length" title="Aucun chauffeur" />
        <button
          v-for="row in driverRows"
          :key="row.driver.id"
          class="surface flex w-full flex-col items-start border-l-4 border-l-primary/40 px-4 py-3.5 text-left transition-colors hover:bg-muted/40"
          @click="canManage && openEditDriverRow(row)"
        >
          <p class="font-medium">{{ row.name }}</p>
          <p class="mt-0.5 text-sm text-muted-foreground">{{ row.driver.phone }}</p>
          <p class="mt-1 text-xs text-muted-foreground">{{ row.vehicleLabel }}</p>
          <Badge class="mt-2" :variant="row.driver.status === 'on_route' ? 'onorder' : row.driver.status === 'off' ? 'warning' : 'success'">
            {{ row.statusLabel }}
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
    <DeliveryFormSheet
      :open="deliveryFormOpen"
      :delivery="editingDelivery"
      :routes="routes"
      :shipping-notes="shippingNotes"
      :initial-route-id="initialRouteId"
      @close="deliveryFormOpen = false; editingDelivery = null"
      @submit="saveDelivery"
    />
    <RouteFormSheet
      :open="routeFormOpen"
      :route="editingRoute"
      :deliveries="deliveries"
      :warehouses="warehouses"
      :vehicles="vehicles"
      :drivers="driverOptions"
      :shipping-notes="shippingNotes"
      @close="routeFormOpen = false; editingRoute = null"
      @submit="saveRoute"
    />
    <ShipmentFormSheet
      :open="shipmentFormOpen"
      :shipment="editingShipment"
      :warehouses="warehouses"
      :vehicles="vehicles"
      :drivers="driverOptions"
      :routes="routes"
      :deliveries="deliveries"
      :shipping-notes="shippingNotes"
      @close="shipmentFormOpen = false; editingShipment = null"
      @submit="saveShipment"
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
          {{ noteLinked.warehouseName }} · {{ SHIPPING_NOTE_LABEL[selectedNote.status] }}
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
            v-if="canPrepare && selectedNote.status === 'ready'"
            class="w-full"
            variant="outline"
            @click="beginPicking"
          >
            Démarrer la préparation
          </Button>
          <Button
            v-if="can('stock.issue') && !selectedNote.loadedAt && selectedNote.status !== 'delivered'"
            class="w-full"
            @click="openLoadPick"
          >
            Picking + charger
          </Button>
          <Button
            v-if="canPrepare && (selectedNote.status === 'ready' || selectedNote.status === 'picking')"
            class="w-full"
            variant="outline"
            @click="openEditNote"
          >
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
      :warehouses="warehouses"
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
      :warehouses="warehouses"
      @close="driverFormOpen = false; editingDriver = null"
      @submit="saveDriver"
    />
  </div>
</template>
