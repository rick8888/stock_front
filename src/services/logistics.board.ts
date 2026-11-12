import type { MockDatabase } from '@/types'
import type { LogisticsBoard, LogisticsBoardQuery } from '@/repositories/interfaces'
import { deliveryOverview, routeOverview, shipmentOverview } from '@/services/logistics.overview'
import { listCarriers } from '@/services/carriers.service'
import { DRIVER_LABEL, SHIPPING_NOTE_LABEL, VEHICLE_LABEL } from '@/config/logistics'

function paginate<T>(
  items: T[],
  page: number,
  pageSize: number,
  focusId: string | undefined,
  idOf: (item: T) => string,
): Pick<LogisticsBoard, 'page' | 'pageSize' | 'total' | 'pages' | 'items' | 'focused'> {
  const total = items.length
  const size = Math.max(1, Math.min(50, pageSize))
  let pages = Math.max(1, Math.ceil(total / size))
  let current = Math.max(1, Math.min(page, pages))
  let focused: T | null = null
  if (focusId) {
    const index = items.findIndex((item) => idOf(item) === focusId)
    if (index >= 0) {
      focused = items[index]!
      current = Math.floor(index / size) + 1
      pages = Math.max(1, Math.ceil(total / size))
    }
  }
  return {
    page: current,
    pageSize: size,
    total,
    pages,
    items: items.slice((current - 1) * size, current * size),
    focused,
  }
}

function formOptionsFromDb(db: MockDatabase, warehouseIds?: string[]) {
  const warehouses = db.warehouses
    .filter((item) => item.active !== false)
    .filter((item) => !warehouseIds?.length || warehouseIds.includes(item.id))
    .map((item) => ({
      id: item.id,
      name: item.name,
      city: item.city,
      address: item.address,
      lat: item.lat,
      lng: item.lng,
    }))
  const products = db.products
    .filter((item) => !item.archived)
    .map((item) => ({
      id: item.id,
      name: item.name,
      sku: item.sku,
      unit: item.unit,
      barcode: item.barcode ?? null,
      trackLots: item.trackLots ?? false,
      archived: false,
    }))
  const customers = (db.customers ?? [])
    .filter((item) => item.active !== false)
    .map((item) => ({
      id: item.id,
      name: item.name,
      phone: item.phone,
      email: item.email,
      addresses: item.addresses ?? [],
    }))
  const vehicles = db.vehicles.map((item) => ({
    id: item.id,
    name: item.name,
    plate: item.plate,
    warehouseId: item.warehouseId,
    status: item.status,
  }))
  const drivers = db.drivers.map((item) => {
    const user = db.users.find((row) => row.id === item.userId)
    return {
      id: item.id,
      userId: item.userId,
      phone: item.phone,
      vehicleId: item.vehicleId,
      status: item.status,
      name: user ? `${user.firstName} ${user.lastName}` : item.id,
    }
  })
  const routes = db.routes.map((item) => ({
    id: item.id,
    name: item.name,
    warehouseId: item.warehouseId,
    driverId: item.driverId,
    vehicleId: item.vehicleId,
    status: item.status,
    date: item.date,
  }))
  const scopedNotes = (db.shippingNotes ?? []).filter(
    (item) => !warehouseIds?.length || warehouseIds.includes(item.warehouseId),
  )
  const scopedDeliveries = db.deliveries.filter(
    (item) => !warehouseIds?.length || warehouseIds.includes(item.warehouseId),
  )
  return {
    products,
    warehouses,
    customers,
    vehicles,
    drivers,
    carriers: listCarriers(false),
    routes,
    shippingNotes: scopedNotes,
    deliveries: scopedDeliveries,
  }
}

function personName(db: MockDatabase, driverId: string) {
  const driver = db.drivers.find((item) => item.id === driverId)
  const user = db.users.find((item) => item.id === driver?.userId)
  return user ? `${user.firstName} ${user.lastName}` : driverId
}

function vehicleLabel(db: MockDatabase, vehicleId: string) {
  const vehicle = db.vehicles.find((item) => item.id === vehicleId)
  return vehicle ? `${vehicle.name} · ${vehicle.plate}` : vehicleId
}

export function buildLogisticsBoard(
  db: MockDatabase,
  query: LogisticsBoardQuery = {},
  options: { warehouseIds?: string[] } = {},
): LogisticsBoard {
  const section = query.section ?? 'deliveries'
  const page = query.page ?? 1
  const pageSize = query.pageSize ?? 8
  const focusId = query.focusId
  const warehouseIds = options.warehouseIds
  const formOptions = formOptionsFromDb(db, warehouseIds)

  let deliveries = db.deliveries
  let notes = db.shippingNotes ?? []
  let routes = db.routes
  let shipments = db.shipments
  let vehicles = db.vehicles
  let drivers = db.drivers
  if (warehouseIds?.length) {
    deliveries = deliveries.filter((item) => warehouseIds.includes(item.warehouseId))
    notes = notes.filter((item) => warehouseIds.includes(item.warehouseId))
    routes = routes.filter((item) => warehouseIds.includes(item.warehouseId))
    shipments = shipments.filter((item) => warehouseIds.includes(item.originWarehouseId))
    vehicles = vehicles.filter((item) => warehouseIds.includes(item.warehouseId))
  }

  const metrics = {
    readyNotes: notes.filter((item) => ['ready', 'picking', 'loaded'].includes(item.status)).length,
    risk: deliveries.filter((item) => item.status === 'at_risk' || item.status === 'failed').length,
    moving: deliveries.filter((item) => item.status === 'in_transit').length,
    delivered: deliveries.filter((item) => item.status === 'delivered').length,
    routes: routes.filter((item) => item.status === 'in_progress').length,
  }

  const ctx = {
    warehouses: db.warehouses,
    drivers: db.drivers,
    users: db.users,
    vehicles: db.vehicles,
    routes,
    deliveries,
  }

  if (section === 'notes') {
    const filter = query.filter ?? 'ready'
    const rows = [...notes]
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '') || a.code.localeCompare(b.code))
      .map((note) => {
        const delivery = note.deliveryId ? deliveries.find((item) => item.id === note.deliveryId) : undefined
        const shipment = note.shipmentId ? shipments.find((item) => item.id === note.shipmentId) : undefined
        const driverId = delivery?.driverId ?? shipment?.driverId
        const vehicleId = delivery?.vehicleId ?? shipment?.vehicleId
        const warehouse = db.warehouses.find((item) => item.id === note.warehouseId)
        return {
          note,
          code: note.code,
          statusLabel: SHIPPING_NOTE_LABEL[note.status],
          warehouseName: warehouse?.name ?? note.warehouseId,
          warehouseAddress: warehouse?.address ?? '',
          driverName: driverId ? personName(db, driverId) : '',
          driverPhone: driverId ? (db.drivers.find((item) => item.id === driverId)?.phone ?? '') : '',
          vehicleLabel: vehicleId ? vehicleLabel(db, vehicleId) : '',
          date: note.createdAt ?? note.loadedAt ?? delivery?.scheduledAt ?? shipment?.date ?? '',
          linesCount: note.lines?.length ?? 0,
        }
      })
    const counts = {
      ready: rows.filter((item) => item.note.status === 'ready').length,
      picking: rows.filter((item) => item.note.status === 'picking').length,
      loaded: rows.filter((item) => item.note.status === 'loaded').length,
      assigned: rows.filter((item) => item.note.status === 'assigned').length,
      delivered: rows.filter((item) => item.note.status === 'delivered').length,
      all: rows.length,
    }
    const filtered = filter === 'all' ? rows : rows.filter((item) => item.note.status === filter)
    return {
      section: 'notes',
      filter,
      counts,
      metrics,
      formOptions,
      ...paginate(filtered, page, pageSize, focusId, (item) => item.note.id),
    }
  }

  if (section === 'routes') {
    const filter = query.filter ?? 'all'
    const rows = routes.map((route) => routeOverview(route, ctx))
    const counts = {
      all: rows.length,
      planned: rows.filter((item) => item.route.status === 'planned').length,
      in_progress: rows.filter((item) => item.route.status === 'in_progress').length,
      done: rows.filter((item) => item.route.status === 'done').length,
    }
    const filtered = filter === 'all' ? rows : rows.filter((item) => item.route.status === filter)
    return {
      section: 'routes',
      filter,
      counts,
      metrics,
      formOptions,
      ...paginate(filtered, page, pageSize, focusId, (item) => item.route.id),
    }
  }

  if (section === 'shipments') {
    const filter = query.filter ?? 'all'
    const rows = shipments.map((shipment) => shipmentOverview(shipment, ctx))
    const counts = {
      all: rows.length,
      in_transit: rows.filter((item) => item.shipment.status === 'in_transit').length,
      delayed: rows.filter((item) => item.shipment.status === 'delayed').length,
      preparing: rows.filter((item) => item.shipment.status === 'preparing').length,
      done: rows.filter((item) => item.shipment.status === 'done').length,
    }
    const filtered = filter === 'all' ? rows : rows.filter((item) => item.shipment.status === filter)
    return {
      section: 'shipments',
      filter,
      counts,
      metrics,
      formOptions,
      ...paginate(filtered, page, pageSize, focusId, (item) => item.shipment.id),
    }
  }

  if (section === 'fleet') {
    const filter = query.filter ?? 'all'
    const vehicleRows = vehicles.map((vehicle) => {
      const driver = drivers.find((item) => item.vehicleId === vehicle.id)
      return {
        vehicle,
        statusLabel: VEHICLE_LABEL[vehicle.status],
        warehouseName: db.warehouses.find((item) => item.id === vehicle.warehouseId)?.name ?? vehicle.warehouseId,
        driverName: driver ? personName(db, driver.id) : 'Aucun chauffeur affecté',
        driverId: driver?.id ?? null,
      }
    })
    const driverRows = drivers.map((driver) => {
      const vehicle = driver.vehicleId ? vehicles.find((item) => item.id === driver.vehicleId) : undefined
      return {
        driver,
        name: personName(db, driver.id),
        statusLabel: DRIVER_LABEL[driver.status],
        vehicleLabel: vehicle ? `${vehicle.name} · ${vehicle.plate}` : 'Aucun véhicule affecté',
      }
    })
    const counts = {
      vehicles: vehicleRows.length,
      drivers: driverRows.length,
      on_mission: vehicleRows.filter((item) => item.vehicle.status === 'on_mission').length,
      on_route: driverRows.filter((item) => item.driver.status === 'on_route').length,
      all: vehicleRows.length + driverRows.length,
    }
    if (filter === 'drivers') {
      return {
        section: 'fleet',
        filter,
        counts,
        metrics,
        formOptions,
        vehicles: vehicleRows,
        drivers: paginate(driverRows, page, pageSize, focusId, (item) => item.driver.id).items,
        ...paginate(driverRows, page, pageSize, focusId, (item) => item.driver.id),
      }
    }
    const pageData = paginate(vehicleRows, page, pageSize, focusId, (item) => item.vehicle.id)
    return {
      section: 'fleet',
      filter: filter === 'vehicles' ? 'vehicles' : 'all',
      counts,
      metrics,
      formOptions,
      vehicles: pageData.items,
      drivers: driverRows,
      ...pageData,
    }
  }

  const filter = query.filter ?? 'all'
  const rows = [...deliveries]
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
    .map((delivery) => deliveryOverview(delivery, ctx))
  const counts = {
    all: rows.length,
    at_risk: rows.filter((item) => item.delivery.status === 'at_risk' || item.delivery.status === 'failed').length,
    in_transit: rows.filter((item) => item.delivery.status === 'in_transit').length,
    prepared: rows.filter((item) => item.delivery.status === 'prepared').length,
    delivered: rows.filter((item) => item.delivery.status === 'delivered').length,
  }
  const filtered = rows.filter((item) => {
    if (filter === 'all') return true
    if (filter === 'at_risk') return item.delivery.status === 'at_risk' || item.delivery.status === 'failed'
    return item.delivery.status === filter
  })

  return {
    section: 'deliveries',
    filter,
    counts,
    metrics,
    formOptions,
    ...paginate(filtered, page, pageSize, focusId, (item) => item.delivery.id),
  }
}
