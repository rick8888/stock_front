import { computed, onMounted, ref } from 'vue'
import { deliveryService } from '@/services/delivery.service'
import { logisticsService } from '@/services/logistics.service'
import { useAsyncList } from './useAsyncList'
import { useCurrentUser } from './useAuth'
import { opsToday } from '@/utils/helpers'
import type {
  DeliveryInput,
  DriverInput,
  LogisticsBoard,
  LogisticsBoardQuery,
  RouteInput,
  ShipmentInput,
  ShippingNoteInput,
  VehicleInput,
} from '@/repositories/interfaces'
import type { DeliveryOverview, RouteOverview, ShipmentOverview } from '@/services/logistics.overview'
import type {
  Carrier,
  Customer,
  Delivery,
  Driver,
  Product,
  Route,
  Shipment,
  ShippingNote,
  Vehicle,
  Warehouse,
} from '@/types'

const PAGE_SIZE = 8

export function useLogisticsBoard(options: { autoload?: boolean } = {}) {
  const board = ref<LogisticsBoard | null>(null)
  const loading = ref(options.autoload !== false)
  const error = ref<string | null>(null)
  const lastQuery = ref<LogisticsBoardQuery>({
    section: 'deliveries',
    filter: 'all',
    page: 1,
    pageSize: PAGE_SIZE,
  })

  async function loadBoard(query: LogisticsBoardQuery = {}, silent = true) {
    lastQuery.value = {
      section: query.section ?? lastQuery.value.section ?? 'deliveries',
      filter: query.filter ?? lastQuery.value.filter ?? 'all',
      page: query.page ?? lastQuery.value.page ?? 1,
      pageSize: query.pageSize ?? lastQuery.value.pageSize ?? PAGE_SIZE,
      focusId: query.focusId,
    }
    if (!silent) loading.value = true
    error.value = null
    try {
      board.value = await logisticsService.board(lastQuery.value)
      if (board.value.page !== lastQuery.value.page) {
        lastQuery.value.page = board.value.page
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Une erreur est survenue'
    } finally {
      loading.value = false
    }
  }

  if (options.autoload !== false) {
    onMounted(() => {
      void loadBoard(lastQuery.value, false)
    })
  }

  const formOptions = computed(() => board.value?.formOptions)
  const metrics = computed(
    () =>
      board.value?.metrics ?? {
        readyNotes: 0,
        risk: 0,
        moving: 0,
        delivered: 0,
        routes: 0,
      },
  )
  const counts = computed(() => board.value?.counts ?? {})
  const page = computed(() => board.value?.page ?? 1)
  const pages = computed(() => board.value?.pages ?? 1)
  const total = computed(() => board.value?.total ?? 0)

  const noteRows = computed(() =>
    board.value?.section === 'notes' ? ((board.value.items as NoteBoardRow[]) ?? []) : [],
  )
  const deliveryRows = computed(() =>
    board.value?.section === 'deliveries' ? ((board.value.items as DeliveryOverview[]) ?? []) : [],
  )
  const routeRows = computed(() =>
    board.value?.section === 'routes' ? ((board.value.items as RouteOverview[]) ?? []) : [],
  )
  const shipmentRows = computed(() =>
    board.value?.section === 'shipments' ? ((board.value.items as ShipmentOverview[]) ?? []) : [],
  )
  const vehicleRows = computed(() =>
    board.value?.section === 'fleet'
      ? ((board.value.vehicles as VehicleBoardRow[] | undefined) ?? (board.value.items as VehicleBoardRow[]) ?? [])
      : [],
  )
  const driverRows = computed(() =>
    board.value?.section === 'fleet' ? ((board.value.drivers as DriverBoardRow[] | undefined) ?? []) : [],
  )

  const products = computed(() => (formOptions.value?.products as Product[] | undefined) ?? [])
  const warehouses = computed(() => (formOptions.value?.warehouses as Warehouse[] | undefined) ?? [])
  const customers = computed(() => (formOptions.value?.customers as Customer[] | undefined) ?? [])
  const vehicles = computed(() => (formOptions.value?.vehicles as Vehicle[] | undefined) ?? [])
  const drivers = computed(() => (formOptions.value?.drivers as Array<Driver & { name?: string }> | undefined) ?? [])
  const carriers = computed(() => (formOptions.value?.carriers as Carrier[] | undefined) ?? [])
  const routes = computed(() => (formOptions.value?.routes as Route[] | undefined) ?? [])
  const shippingNotes = computed(() => formOptions.value?.shippingNotes ?? [])
  const deliveries = computed(() => formOptions.value?.deliveries ?? [])

  async function refresh() {
    await loadBoard(lastQuery.value, true)
  }

  async function createDelivery(input: DeliveryInput) {
    const created = await deliveryService.create(input)
    await refresh()
    return created
  }
  async function updateDelivery(id: string, input: Partial<DeliveryInput>) {
    const updated = await deliveryService.update(id, input)
    await refresh()
    return updated
  }
  async function confirmDelivery(
    id: string,
    signedBy?: string,
    proof?: import('@/repositories/interfaces').DeliveryProofInput,
  ) {
    await deliveryService.updateStatus(id, 'delivered', undefined, signedBy, proof)
    await refresh()
  }
  async function createRoute(input: RouteInput) {
    const created = await logisticsService.createRoute(input)
    await refresh()
    return created
  }
  async function updateRoute(id: string, input: Partial<RouteInput>) {
    const updated = await logisticsService.updateRoute(id, input)
    await refresh()
    return updated
  }
  async function createShipment(input: ShipmentInput) {
    const created = await logisticsService.createShipment(input)
    await refresh()
    return created
  }
  async function updateShipment(id: string, input: Partial<ShipmentInput>) {
    const updated = await logisticsService.updateShipment(id, input)
    await refresh()
    return updated
  }
  async function createVehicle(input: VehicleInput) {
    const created = await logisticsService.createVehicle(input)
    await refresh()
    return created
  }
  async function updateVehicle(id: string, input: Partial<VehicleInput>) {
    const updated = await logisticsService.updateVehicle(id, input)
    await refresh()
    return updated
  }
  async function createDriver(input: DriverInput) {
    const created = await logisticsService.createDriver(input)
    await refresh()
    return created
  }
  async function updateDriver(id: string, input: Partial<DriverInput>) {
    const updated = await logisticsService.updateDriver(id, input)
    await refresh()
    return updated
  }
  async function createShippingNote(input: ShippingNoteInput) {
    const created = await logisticsService.createShippingNote(input)
    await refresh()
    return created
  }
  async function updateShippingNote(id: string, input: Partial<ShippingNoteInput>) {
    const updated = await logisticsService.updateShippingNote(id, input)
    await refresh()
    return updated
  }
  async function assignCarrier(id: string, input: import('@/repositories/interfaces').ShippingNoteCarrierInput) {
    const updated = await logisticsService.assignCarrier(id, input)
    await refresh()
    return updated
  }
  async function markLabelPrinted(id: string) {
    const updated = await logisticsService.markLabelPrinted(id)
    await refresh()
    return updated
  }
  async function startPicking(id: string) {
    const updated = await logisticsService.startPicking(id)
    await refresh()
    return updated
  }
  async function loadShippingNote(id: string, userId: string) {
    const updated = await logisticsService.loadShippingNote(id, userId)
    await refresh()
    return updated
  }

  const focused = computed(() => board.value?.focused ?? null)

  return {
    board,
    focused,
    loading: computed(() => loading.value),
    error,
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
    refresh,
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
  }
}

export type NoteBoardRow = {
  note: ShippingNote
  code: string
  statusLabel: string
  warehouseName: string
  warehouseAddress: string
  driverName: string
  driverPhone: string
  vehicleLabel: string
  date: string
  linesCount: number
}

export type VehicleBoardRow = {
  vehicle: Vehicle
  statusLabel: string
  warehouseName: string
  driverName: string
  driverId?: string | null
}

export type DriverBoardRow = {
  driver: Driver
  name: string
  statusLabel: string
  vehicleLabel: string
}

export function useDeliveries() {
  const list = useAsyncList(() => deliveryService.list())
  async function confirmDelivery(
    id: string,
    signedBy?: string,
    proof?: import('@/repositories/interfaces').DeliveryProofInput,
  ) {
    await deliveryService.updateStatus(id, 'delivered', undefined, signedBy, proof)
    await list.refresh(true)
  }
  async function failDelivery(id: string, reason: string) {
    await deliveryService.updateStatus(id, 'failed', reason)
    await list.refresh(true)
  }
  async function createDelivery(input: DeliveryInput) {
    const created = await deliveryService.create(input)
    await list.refresh(true)
    return created
  }
  async function updateDelivery(id: string, input: Partial<DeliveryInput>) {
    const updated = await deliveryService.update(id, input)
    await list.refresh(true)
    return updated
  }
  return {
    deliveries: list.data,
    loading: list.loading,
    error: list.error,
    confirmDelivery,
    failDelivery,
    createDelivery,
    updateDelivery,
    refresh: list.refresh,
  }
}

export function useShipments() {
  const list = useAsyncList(() => logisticsService.shipments())
  async function createShipment(input: ShipmentInput) {
    const created = await logisticsService.createShipment(input)
    await list.refresh(true)
    return created
  }
  async function updateShipment(id: string, input: Partial<ShipmentInput>) {
    const updated = await logisticsService.updateShipment(id, input)
    await list.refresh(true)
    return updated
  }
  return {
    shipments: list.data,
    loading: list.loading,
    error: list.error,
    createShipment,
    updateShipment,
    refresh: list.refresh,
  }
}

export function useRoutes() {
  const list = useAsyncList(() => logisticsService.routes())
  async function createRoute(input: RouteInput) {
    const created = await logisticsService.createRoute(input)
    await list.refresh(true)
    return created
  }
  async function updateRoute(id: string, input: Partial<RouteInput>) {
    const updated = await logisticsService.updateRoute(id, input)
    await list.refresh(true)
    return updated
  }
  return {
    routes: list.data,
    loading: list.loading,
    error: list.error,
    createRoute,
    updateRoute,
    refresh: list.refresh,
  }
}

export function useVehicles() {
  const list = useAsyncList(() => logisticsService.vehicles())
  async function createVehicle(input: VehicleInput) {
    const created = await logisticsService.createVehicle(input)
    await list.refresh(true)
    return created
  }
  async function updateVehicle(id: string, input: Partial<VehicleInput>) {
    const updated = await logisticsService.updateVehicle(id, input)
    await list.refresh(true)
    return updated
  }
  return {
    vehicles: list.data,
    loading: list.loading,
    error: list.error,
    createVehicle,
    updateVehicle,
    refresh: list.refresh,
  }
}

export function useDrivers() {
  const list = useAsyncList(() => logisticsService.drivers())
  async function createDriver(input: DriverInput) {
    const created = await logisticsService.createDriver(input)
    await list.refresh(true)
    return created
  }
  async function updateDriver(id: string, input: Partial<DriverInput>) {
    const updated = await logisticsService.updateDriver(id, input)
    await list.refresh(true)
    return updated
  }
  return {
    drivers: list.data,
    loading: list.loading,
    error: list.error,
    createDriver,
    updateDriver,
    refresh: list.refresh,
  }
}

export function useShippingNotes() {
  const list = useAsyncList(() => logisticsService.shippingNotes())
  async function createShippingNote(input: ShippingNoteInput) {
    const created = await logisticsService.createShippingNote(input)
    await list.refresh(true)
    return created
  }
  async function updateShippingNote(id: string, input: Partial<ShippingNoteInput>) {
    const updated = await logisticsService.updateShippingNote(id, input)
    await list.refresh(true)
    return updated
  }
  async function assignCarrier(id: string, input: import('@/repositories/interfaces').ShippingNoteCarrierInput) {
    const updated = await logisticsService.assignCarrier(id, input)
    await list.refresh(true)
    return updated
  }
  async function markLabelPrinted(id: string) {
    const updated = await logisticsService.markLabelPrinted(id)
    await list.refresh(true)
    return updated
  }
  async function startPicking(id: string) {
    const updated = await logisticsService.startPicking(id)
    await list.refresh(true)
    return updated
  }
  async function loadShippingNote(id: string, userId: string) {
    const updated = await logisticsService.loadShippingNote(id, userId)
    await list.refresh(true)
    return updated
  }
  return {
    shippingNotes: list.data,
    loading: list.loading,
    error: list.error,
    createShippingNote,
    updateShippingNote,
    assignCarrier,
    markLabelPrinted,
    startPicking,
    loadShippingNote,
    refresh: list.refresh,
  }
}

export function useDriverToday() {
  const { currentUser } = useCurrentUser()
  const day = ref(opsToday())
  const deliveriesList = useAsyncList(async () => {
    const driverId = currentUser.value?.driverId
    if (!driverId) return []
    return deliveryService.forDriver(driverId)
  })
  const routesList = useAsyncList(() => logisticsService.routes())
  const shipmentsList = useAsyncList(() => logisticsService.shipments())

  const driverId = computed(() => currentUser.value?.driverId)
  const myDeliveries = computed(() =>
    deliveriesList.data.value.filter((item) => item.driverId === driverId.value),
  )
  const myRoutes = computed(() => routesList.data.value.filter((item) => item.driverId === driverId.value))
  const myShipments = computed(() => shipmentsList.data.value.filter((item) => item.driverId === driverId.value))

  const days = computed(() => {
    const keys = new Set<string>([opsToday()])
    myDeliveries.value.forEach((item) => keys.add(item.scheduledAt.slice(0, 10)))
    myRoutes.value.forEach((item) => keys.add(item.date))
    myShipments.value.forEach((item) => keys.add(item.date.slice(0, 10)))
    return [...keys].sort()
  })

  const dayDeliveries = computed(() =>
    myDeliveries.value
      .filter((item) => item.scheduledAt.slice(0, 10) === day.value)
      .sort((a, b) => a.sequence - b.sequence || a.scheduledAt.localeCompare(b.scheduledAt)),
  )
  const dayRoutes = computed(() => myRoutes.value.filter((item) => item.date === day.value))
  const dayShipments = computed(() =>
    myShipments.value
      .filter((item) => item.date.slice(0, 10) === day.value)
      .sort((a, b) => a.date.localeCompare(b.date)),
  )
  const remaining = computed(() =>
    dayDeliveries.value.filter((item) => item.status !== 'delivered' && item.status !== 'failed'),
  )
  const next = computed(() => remaining.value[0] ?? null)
  const loading = computed(
    () => deliveriesList.loading.value || routesList.loading.value || shipmentsList.loading.value,
  )

  async function completeDelivery(
    id: string,
    signedBy?: string,
    proof?: import('@/repositories/interfaces').DeliveryProofInput,
  ) {
    const result = await deliveryService.updateStatus(id, 'delivered', undefined, signedBy, proof)
    await deliveriesList.refresh(true)
    return result
  }
  async function failDelivery(id: string, reason: string) {
    const result = await deliveryService.updateStatus(id, 'failed', reason)
    await deliveriesList.refresh(true)
    return result
  }
  async function completeCurrent() {
    if (!next.value) return
    await completeDelivery(next.value.id)
  }

  return {
    day,
    days,
    deliveries: dayDeliveries,
    routes: dayRoutes,
    shipments: dayShipments,
    remaining,
    next,
    loading,
    error: deliveriesList.error,
    completeCurrent,
    completeDelivery,
    failDelivery,
    refresh: async () => {
      await Promise.all([deliveriesList.refresh(true), routesList.refresh(true), shipmentsList.refresh(true)])
    },
  }
}
