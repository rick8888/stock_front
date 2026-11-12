import type {
  Alert,
  Delivery,
  DeliveryStatus,
  Driver,
  Invoice,
  PermissionKey,
  PlanningEvent,
  Consultation,
  ProcurementRequest,
  Product,
  PurchaseOrder,
  Receipt,
  Role,
  Route,
  Shipment,
  StockItem,
  StockMovement,
  Supplier,
  Task,
  User,
  Vehicle,
  Warehouse,
  ShippingNote,
  Budget,
  Expense,
  Payment,
  InventorySession,
  RoleKey,
  BillingInterval,
  Company,
  CompanyStatus,
  PlanModule,
  PlatformInvoice,
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
} from '@/types'

export interface ProductInput {
  name: string
  sku: string
  categoryId: string
  unit: string
  minStock: number
  maxStock?: number
  price: number
  supplierId: string
  dailyDemand: number
  description?: string
  barcode?: string
  imageUrl?: string
  images?: string[]
  trackLots?: boolean
}

export type ReceiptValidateLine = {
  productId: string
  received: number
  lotCode?: string
  expiryDate?: string
  locationId?: string
}

export interface WarehouseLocationInput {
  warehouseId: string
  aisle: string
  rack: string
  bin: string
  code?: string
  type?: import('@/types').LocationType
  active?: boolean
}

export interface WarehouseLocationRepository {
  list(warehouseId?: string): Promise<import('@/types').WarehouseLocation[]>
  getById(id: string): Promise<import('@/types').WarehouseLocation | null>
  create(input: WarehouseLocationInput): Promise<import('@/types').WarehouseLocation>
  update(id: string, input: Partial<WarehouseLocationInput>): Promise<import('@/types').WarehouseLocation>
}

export interface StockPlacementRepository {
  list(warehouseId?: string, productId?: string): Promise<import('@/types').StockPlacement[]>
  pickPath(
    warehouseId: string,
    lines: { productId: string; quantity: number; productName?: string; sku?: string }[],
  ): Promise<import('@/types').PickPathStep[]>
  suggestPutaway(warehouseId: string, productId: string): Promise<import('@/types').WarehouseLocation | null>
}

export interface ProductRepository {
  list(): Promise<Product[]>
  getById(id: string): Promise<Product | null>
  create(input: ProductInput): Promise<Product>
  update(id: string, input: Partial<ProductInput>): Promise<Product>
  archive(id: string): Promise<void>
}

export interface WarehouseRepository {
  list(): Promise<Warehouse[]>
  getById(id: string): Promise<Warehouse | null>
  create(input: Omit<Warehouse, 'id'>): Promise<Warehouse>
  update(id: string, input: Partial<Warehouse>): Promise<Warehouse>
}

export interface StockOverviewBoard {
  rows: import('@/types').StockOverviewRow[]
  counts: {
    all: number
    critical: number
    watch: number
    on_order: number
    normal: number
  }
  closedWarehouseIds: string[]
  today: string
}

export interface StockRepository {
  list(): Promise<StockItem[]>
  overview(): Promise<StockOverviewBoard>
  movements(): Promise<StockMovement[]>
  inventories(): Promise<InventorySession[]>
  receive(productId: string, warehouseId: string, quantity: number, userId: string, note: string, reference?: string): Promise<void>
  issue(productId: string, warehouseId: string, quantity: number, userId: string, note: string, reference?: string): Promise<void>
  transfer(
    productId: string,
    fromWarehouseId: string,
    toWarehouseId: string,
    quantity: number,
    userId: string,
    note?: string,
  ): Promise<void>
  adjust(productId: string, warehouseId: string, quantity: number, userId: string, note: string): Promise<void>
  toggleAssignment(productId: string, warehouseId: string, enabled: boolean): Promise<void>
  startInventory(
    warehouseId: string,
    userId: string,
    scope?: import('@/types').InventoryScope,
  ): Promise<InventorySession>
  saveInventory(id: string, lines: { productId: string; counted: number }[]): Promise<InventorySession>
  submitInventory(id: string, userId: string): Promise<InventorySession>
  completeInventory(id: string, userId: string): Promise<InventorySession>
  returnStock(productId: string, warehouseId: string, quantity: number, userId: string, note: string, reference?: string): Promise<void>
  closeDay(warehouseId: string, userId: string): Promise<void>
}

export interface SupplierInput {
  name: string
  contact: string
  email: string
  phone: string
  city: string
  address?: string
  ice?: string
  category?: string
  paymentTerms?: string
  note?: string
  leadTimeDays: number
}

export interface SupplierRepository {
  list(): Promise<Supplier[]>
  getById(id: string): Promise<Supplier | null>
  create(input: SupplierInput): Promise<Supplier>
  update(id: string, input: Partial<SupplierInput>): Promise<Supplier>
}

export interface SupplierProductRepository {
  list(): Promise<import('@/types').SupplierProduct[]>
}

export interface ProcurementBoardQuery {
  section?: 'requests' | 'orders' | 'receipts' | 'suppliers'
  filter?: string
  page?: number
  pageSize?: number
  focusId?: string
}

export interface ProcurementFormOptions {
  products: Array<{
    id: string
    name: string
    sku: string
    unit: string
    price: number
    barcode?: string | null
    supplierId?: string | null
    archived?: boolean
  }>
  warehouses: Array<{ id: string; name: string }>
  suppliers: import('@/types').Supplier[]
}

export interface ProcurementBoard {
  section: 'requests' | 'orders' | 'receipts' | 'suppliers'
  filter: string
  page: number
  pageSize: number
  total: number
  pages: number
  counts: Record<string, number>
  items: unknown[]
  focused?: unknown | null
  readyToPurchase?: import('@/services/request.overview').RequestOverview[]
  formOptions?: ProcurementFormOptions
}

export interface ProcurementSourcingResult {
  requestIds: string[]
  offers: import('@/services/sourcing.service').SourcingOffer[]
}

export interface ProcurementRepository {
  list(): Promise<ProcurementRequest[]>
  board(query?: ProcurementBoardQuery): Promise<ProcurementBoard>
  sourcing(requestIds: string[]): Promise<ProcurementSourcingResult>
  create(input: Omit<ProcurementRequest, 'id' | 'createdAt' | 'status'> & { status?: ProcurementRequest['status'] }): Promise<ProcurementRequest>
  updateStatus(
    id: string,
    status: ProcurementRequest['status'],
    extras?: Partial<ProcurementRequest>,
  ): Promise<ProcurementRequest>
}

export interface PurchaseRepository {
  list(): Promise<PurchaseOrder[]>
  create(input: Omit<PurchaseOrder, 'id' | 'createdAt'>): Promise<PurchaseOrder>
  createFromOffer?(requestIds: string[], supplierId: string): Promise<PurchaseOrder>
  updateStatus(id: string, status: PurchaseOrder['status']): Promise<PurchaseOrder>
}

export interface ConsultationRepository {
  list(): Promise<Consultation[]>
  create(input: Omit<Consultation, 'id' | 'createdAt'>): Promise<Consultation>
  update(id: string, input: Partial<Consultation>): Promise<Consultation>
}

export interface ReceiptRepository {
  list(): Promise<Receipt[]>
  validate(id: string, received: number, userId: string, lines?: ReceiptValidateLine[]): Promise<Receipt>
  create(input: Omit<Receipt, 'id'>): Promise<Receipt>
  /** Crée (ou renvoie) le BR lié à un OA — idempotent côté API. */
  createFromOrder(purchaseOrderId: string): Promise<Receipt>
}

export interface DeliveryLineInput {
  productId: string
  quantity: number
}

export interface DeliveryInput {
  shippingNoteId: string
  client?: string
  address?: string
  city?: string
  lat?: number
  lng?: number
  scheduledAt: string
  routeId: string
  notes?: string
  lines?: DeliveryLineInput[]
  sequence?: number
  status?: DeliveryStatus
}

export interface RouteStopInput {
  id?: string
  shippingNoteId: string
  client?: string
  address?: string
  city?: string
  scheduledAt: string
  status?: DeliveryStatus
  notes?: string
}

export interface RouteInput {
  name: string
  date: string
  driverId: string
  vehicleId: string
  warehouseId: string
  status?: Route['status']
  stops?: RouteStopInput[]
}

export interface RouteAssistInput {
  warehouseId: string
  date?: string
  driverId?: string
  vehicleId?: string
  stops: {
    key: string
    shippingNoteId: string
    client?: string
    city?: string
    address?: string
    scheduledAt?: string
    status?: DeliveryStatus
    lat?: number
    lng?: number
  }[]
}

export interface ShipmentInput {
  originWarehouseId: string
  destinationWarehouseId?: string
  destination?: string
  vehicleId: string
  driverId: string
  routeId?: string
  date: string
  eta?: string
  notes?: string
  shippingNoteIds: string[]
  lines?: DeliveryLineInput[]
  status?: Shipment['status']
}

export interface DriverInput {
  firstName: string
  lastName: string
  phone: string
  email?: string
  warehouseId?: string
  vehicleId?: string
  status?: Driver['status']
}

export interface VehicleInput {
  name: string
  plate: string
  warehouseId: string
  status?: Vehicle['status']
  driverId?: string
}

export interface ShippingNoteInput {
  warehouseId: string
  customerId?: string
  addressId?: string
  client: string
  address: string
  city: string
  lines: DeliveryLineInput[]
  notes?: string
  carrierId?: string
  trackingNumber?: string
  createdByUserId?: string
}

export interface ShippingNoteCarrierInput {
  carrierId: string
  trackingNumber?: string
  book?: boolean
}

export interface CustomerInput {
  name: string
  phone?: string
  email?: string
  ice?: string
  notes?: string
  active?: boolean
  addresses: {
    id?: string
    label: string
    address: string
    city: string
    isDefault?: boolean
    lat?: number
    lng?: number
  }[]
}

export interface CustomerRepository {
  list(): Promise<import('@/types').Customer[]>
  getById(id: string): Promise<import('@/types').Customer | null>
  create(input: CustomerInput): Promise<import('@/types').Customer>
  update(id: string, input: Partial<CustomerInput>): Promise<import('@/types').Customer>
}

export interface StockLotRepository {
  list(warehouseId?: string, productId?: string): Promise<import('@/types').StockLot[]>
}

export interface ReplenishmentRepository {
  list(warehouseId?: string): Promise<import('@/types').ReplenishmentSuggestion[]>
  compute(warehouseId: string, refreshDemand?: boolean): Promise<import('@/types').ReplenishmentSuggestion[]>
  simulate(
    warehouseId: string,
    options?: { serviceLevel?: number; leadTimeDays?: number },
  ): Promise<import('@/types').ReplenishmentSuggestion[]>
}

export interface AnalyticsRepository {
  snapshot(): Promise<{
    otifRate: number
    otifDelivered: number
    otifOnTime: number
    stockouts: number
    stockWatch: number
    delayedOrders: number
    failedDeliveries: number
    deliveryCostMad: number
    costPerDelivery: number
    issued: number
    received: number
    netFlow: number
    windowDays: number
  }>
}

export interface DeliveryProofInput {
  signedBy?: string
  signatureDataUrl?: string
  lat?: number
  lng?: number
  signedAt?: string
}

export interface DeliveryRepository {
  list(): Promise<Delivery[]>
  updateStatus(
    id: string,
    status: Delivery['status'],
    note?: string,
    signedBy?: string,
    proof?: DeliveryProofInput,
  ): Promise<Delivery>
  create(input: DeliveryInput): Promise<Delivery>
  update(id: string, input: Partial<DeliveryInput>): Promise<Delivery>
}

export interface LogisticsBoardQuery {
  section?: 'notes' | 'deliveries' | 'routes' | 'shipments' | 'fleet'
  filter?: string
  page?: number
  pageSize?: number
  focusId?: string
}

export interface LogisticsFormOptions {
  products: Array<{
    id: string
    name: string
    sku: string
    unit: string
    barcode?: string | null
    trackLots?: boolean
    archived?: boolean
  }>
  warehouses: Array<{
    id: string
    name: string
    city?: string
    address?: string
    lat?: number | null
    lng?: number | null
  }>
  customers: Array<{
    id: string
    name: string
    phone?: string
    email?: string
    addresses?: import('@/types').Customer['addresses']
  }>
  vehicles: import('@/types').Vehicle[]
  drivers: Array<import('@/types').Driver & { name?: string }>
  carriers: import('@/types').Carrier[]
  routes: Array<Pick<import('@/types').Route, 'id' | 'name' | 'warehouseId' | 'driverId' | 'vehicleId' | 'status' | 'date'>>
  shippingNotes: import('@/types').ShippingNote[]
  deliveries: import('@/types').Delivery[]
}

export interface LogisticsBoard {
  section: 'notes' | 'deliveries' | 'routes' | 'shipments' | 'fleet'
  filter: string
  page: number
  pageSize: number
  total: number
  pages: number
  counts: Record<string, number>
  metrics: {
    readyNotes: number
    risk: number
    moving: number
    delivered: number
    routes: number
  }
  items: unknown[]
  focused?: unknown | null
  formOptions?: LogisticsFormOptions
  vehicles?: unknown[]
  drivers?: unknown[]
}

export interface LogisticsRepository {
  board(query?: LogisticsBoardQuery): Promise<LogisticsBoard>
  shipments(): Promise<Shipment[]>
  routes(): Promise<Route[]>
  vehicles(): Promise<Vehicle[]>
  drivers(): Promise<Driver[]>
  carriers(): Promise<import('@/types').Carrier[]>
  shippingNotes(): Promise<ShippingNote[]>
  createShippingNote(input: ShippingNoteInput): Promise<ShippingNote>
  updateShippingNote(id: string, input: Partial<ShippingNoteInput>): Promise<ShippingNote>
  assignCarrier(id: string, input: ShippingNoteCarrierInput): Promise<ShippingNote>
  markLabelPrinted(id: string): Promise<ShippingNote>
  startPicking(id: string): Promise<ShippingNote>
  updateVehicle(id: string, input: Partial<VehicleInput>): Promise<Vehicle>
  createVehicle(input: VehicleInput): Promise<Vehicle>
  createDriver(input: DriverInput): Promise<Driver>
  updateDriver(id: string, input: Partial<DriverInput>): Promise<Driver>
  createRoute(input: RouteInput): Promise<Route>
  updateRoute(id: string, input: Partial<RouteInput>): Promise<Route>
  assistRoute(input: RouteAssistInput): Promise<import('@/services/route.assist').RouteAssistResult>
  createShipment(input: ShipmentInput): Promise<Shipment>
  updateShipment(id: string, input: Partial<ShipmentInput>): Promise<Shipment>
  loadShippingNote(id: string, userId: string): Promise<ShippingNote>
}

export interface TrackingRepository {
  live(): Promise<import('@/types').LiveRouteTracking[]>
  route(id: string): Promise<import('@/types').RouteTrackingSnapshot>
  ping(input: import('@/types').TrackingPingInput): Promise<{
    event: import('@/types').TrackingEvent
    route: import('@/types').Route
    etaAt?: string
  }>
}

export interface TaskBoard {
  tasks: Task[]
  counts: { open: number; today: number; overdue: number; done: number }
  groups: { id: string; title: string; items: Task[] }[]
  done: Task[]
}

export interface TaskRepository {
  list(): Promise<Task[]>
  board(): Promise<TaskBoard>
  create(input: Omit<Task, 'id'>): Promise<Task>
  update(id: string, input: Partial<Task>): Promise<Task>
}

export interface AlertRepository {
  list(): Promise<Alert[]>
  markRead(id: string): Promise<void>
}

export interface NotificationRepository {
  list(): Promise<import('@/types').AppNotification[]>
  markRead(id: string): Promise<void>
  markAllRead(): Promise<{ marked: number }>
}

export interface TodayRepository {
  brief(): Promise<import('@/services/today.service').TodayBrief>
}

export interface PlanningBoard {
  today: string
  selectedDay: string
  weekOffset: number
  type: string
  counts: { today: number; week: number; next: number }
  weekDays: { key: string; count: number; isToday: boolean }[]
  types: { id: string; count: number }[]
  dayEvents: PlanningEvent[]
  upcoming: PlanningEvent[]
  events: PlanningEvent[]
}

export interface PlanningBoardQuery {
  weekOffset?: number
  day?: string
  type?: string
}

export interface PlanningRepository {
  list(from?: string, to?: string): Promise<PlanningEvent[]>
  board(query?: PlanningBoardQuery): Promise<PlanningBoard>
}

export interface FinanceRepository {
  invoices(): Promise<Invoice[]>
  payments(): Promise<Payment[]>
  budgets(): Promise<Budget[]>
  expenses(): Promise<Expense[]>
  payInvoice(id: string): Promise<void>
}

export interface UserInput {
  firstName: string
  lastName: string
  email?: string
  password?: string
  role: RoleKey
  title?: string
  warehouseIds?: string[]
  productIds?: string[]
  regionIds?: string[]
  phone?: string
  createdByUserId?: string
  companyId?: string
}

export interface UserRepository {
  list(): Promise<User[]>
  getById(id: string): Promise<User | null>
  findByEmail(email: string): Promise<User | null>
  create(input: UserInput): Promise<User>
  update(id: string, input: Partial<UserInput>): Promise<User>
}

export interface RoleRepository {
  list(): Promise<Role[]>
}

export interface AuthRepository {
  login(email: string, password: string): Promise<User>
  logout(): Promise<void>
  restore(userId: string): Promise<User | null>
}

export interface CompanyInput {
  name: string
  legalName: string
  ice: string
  city: string
  email: string
  phone: string
  planId: string
  interval: BillingInterval
}

export interface PlanInput {
  name: string
  code: string
  description: string
  monthlyPrice: number
  yearlyPrice: number
  maxUsers: number
  maxWarehouses: number
  modules: PlanModule[]
  active: boolean
}

export interface BillingSession {
  url: string
  provider: string
  sessionId?: string
}

export interface PlatformPayResult {
  url?: string
  sessionId?: string
  provider?: string
  invoice?: PlatformInvoice
  payment?: { provider: string; paymentRef: string; status: string }
}

export interface PlatformRepository {
  companies(): Promise<Company[]>
  plans(): Promise<SubscriptionPlan[]>
  subscriptions(): Promise<Subscription[]>
  invoices(): Promise<PlatformInvoice[]>
  createCompany(input: CompanyInput): Promise<Company>
  updateCompany(id: string, input: Partial<CompanyInput> & { status?: CompanyStatus }): Promise<Company>
  createPlan(input: PlanInput): Promise<SubscriptionPlan>
  updatePlan(id: string, input: Partial<PlanInput>): Promise<SubscriptionPlan>
  changeSubscription(
    companyId: string,
    input: { planId?: string; interval?: BillingInterval; status?: SubscriptionStatus },
  ): Promise<Subscription>
  payInvoice(id: string): Promise<PlatformPayResult>
  checkout(input?: { companyId?: string; planId?: string; interval?: BillingInterval; invoiceId?: string }): Promise<BillingSession>
  portal(input?: { companyId?: string }): Promise<BillingSession>
}

export type { PermissionKey }
