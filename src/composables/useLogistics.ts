import { computed, ref } from 'vue'
import { deliveryService } from '@/services/delivery.service'
import { logisticsService } from '@/services/logistics.service'
import { useAsyncList } from './useAsyncList'
import { useCurrentUser } from './useAuth'
import { opsToday } from '@/utils/helpers'
import type { DeliveryInput, DriverInput, RouteInput, ShipmentInput, ShippingNoteInput, VehicleInput } from '@/repositories/interfaces'

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
