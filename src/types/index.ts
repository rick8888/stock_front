export type RoleKey =
  | 'SUPER_ADMIN'
  | 'TENANT_OWNER'
  | 'ADMIN'
  | 'MANAGER'
  | 'WAREHOUSE_MANAGER'
  | 'PROCUREMENT'
  | 'FINANCE'
  | 'DISPATCHER'
  | 'DRIVER'
  | 'AUDITOR'

export type PermissionKey =
  | 'product.view'
  | 'product.create'
  | 'product.update'
  | 'product.archive'
  | 'warehouse.view'
  | 'warehouse.create'
  | 'warehouse.update'
  | 'warehouse.assign'
  | 'stock.view'
  | 'stock.receive'
  | 'stock.issue'
  | 'stock.transfer'
  | 'stock.adjust'
  | 'stock.inventory'
  | 'procurement.view'
  | 'procurement.create'
  | 'procurement.approve'
  | 'purchase.view'
  | 'purchase.create'
  | 'purchase.update'
  | 'purchase.approve'
  | 'delivery.view'
  | 'delivery.create'
  | 'delivery.update'
  | 'delivery.confirm'
  | 'delivery.prepare'
  | 'finance.view'
  | 'finance.invoice'
  | 'finance.payment'
  | 'finance.budget'
  | 'user.view'
  | 'user.create'
  | 'user.update'
  | 'user.assign_role'
  | 'task.view'
  | 'task.create'
  | 'task.update'
  | 'analytics.view'
  | 'assistant.use'
  | 'platform.view'
  | 'platform.companies'
  | 'platform.plans'
  | 'platform.billing'
  | 'account.view'
  | 'account.company'
  | 'account.admins'
  | 'account.billing'

export interface UserScope {
  warehouseIds: string[]
  productIds: string[]
  regionIds: string[]
}

export interface User {
  id: string
  firstName: string
  lastName: string
  email: string
  password: string
  role: RoleKey
  title: string
  avatarHue: number
  warehouseIds: string[]
  productIds: string[]
  regionIds: string[]
  driverId?: string
  companyId?: string
}

export interface Role {
  id: string
  key: RoleKey
  name: string
  description: string
  permissions: PermissionKey[]
}

export interface Permission {
  id: PermissionKey
  group: string
  label: string
}

export interface Category {
  id: string
  name: string
}

export interface Product {
  id: string
  sku: string
  name: string
  categoryId: string
  unit: string
  minStock: number
  maxStock?: number
  price: number
  supplierId: string
  archived: boolean
  dailyDemand: number
  description?: string
  barcode?: string
  imageUrl?: string
  images?: string[]
  trackLots?: boolean
}

export interface CustomerAddress {
  id: string
  label: string
  address: string
  city: string
  isDefault?: boolean
}

export interface Customer {
  id: string
  name: string
  phone?: string
  email?: string
  ice?: string
  notes?: string
  active: boolean
  companyId?: string
  addresses: CustomerAddress[]
}

export interface StockLot {
  id: string
  productId: string
  warehouseId: string
  lotCode: string
  expiryDate?: string
  locationId?: string
  quantity: number
  companyId?: string
}

export type LocationType = 'pick' | 'bulk' | 'staging'

export interface WarehouseLocation {
  id: string
  warehouseId: string
  code: string
  aisle: string
  rack: string
  bin: string
  type: LocationType
  active: boolean
  companyId?: string
}

export interface StockPlacement {
  id: string
  productId: string
  warehouseId: string
  locationId: string
  lotId?: string
  quantity: number
  companyId?: string
}

export interface PickPathStep {
  productId: string
  productName: string
  sku?: string
  quantity: number
  locationId?: string | null
  locationCode?: string | null
  aisle?: string | null
  rack?: string | null
  bin?: string | null
  unlocated?: boolean
}

export interface Warehouse {
  id: string
  name: string
  city: string
  regionId: string
  address: string
  managerUserId: string
  capacity: number
  active: boolean
  companyId?: string
  lat?: number
  lng?: number
}

export interface StockItem {
  id: string
  productId: string
  warehouseId: string
  quantity: number
  reserved: number
  enabled: boolean
}

export type StockHealth = 'critical' | 'watch' | 'on_order' | 'normal'

export interface StockOverviewRow {
  id: string
  productId: string
  warehouseId: string
  productName: string
  sku: string
  unit: string
  categoryId: string
  warehouseName: string
  physical: number
  reserved: number
  available: number
  inTransit: number
  minStock: number
  maxStock: number
  days: number
  weeklyDemand: number
  leadTimeDays: number
  supplierId: string
  supplierName: string
  status: StockHealth
  flags: { onOrder: boolean }
  imageUrl?: string
  images?: string[]
  description?: string
  barcode?: string
}

export interface StockRecommendation {
  quantity: number
  risk: 'high' | 'medium' | 'low'
  reasons: string[]
}

export type StockMovementType = 'receive' | 'issue' | 'transfer' | 'adjust' | 'return'

export interface StockMovement {
  id: string
  productId: string
  type: StockMovementType
  quantity: number
  fromWarehouseId?: string
  toWarehouseId?: string
  userId: string
  date: string
  note: string
  reference?: string
}

export interface InventoryLine {
  productId: string
  expected: number
  counted: number
}

export type InventoryStatus = 'in_progress' | 'pending_review' | 'completed'

export type InventoryMode = 'full' | 'partial'

/** Filtres d’un cycle count (AND). Vide = plein entrepôt. */
export interface InventoryScope {
  categoryId?: string
  locationId?: string
  aisle?: string
  productIds?: string[]
}

export interface InventorySession {
  id: string
  warehouseId: string
  status: InventoryStatus
  mode?: InventoryMode
  scope?: InventoryScope
  counted: number
  expected: number
  startedAt: string
  completedAt?: string
  userId?: string
  countedByUserId?: string
  approvedByUserId?: string
  lines: InventoryLine[]
}

export interface Supplier {
  id: string
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
  reliability: number
  status: 'active' | 'pending'
}

export type ProcurementStatus =
  | 'draft'
  | 'submitted'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'ordered'
  | 'closed'
  | 'cancelled'

export type RequestPriority = 'low' | 'medium' | 'high'

export interface ProcurementItem {
  productId: string
  quantity: number
}

export interface ProcurementRequest {
  id: string
  code?: string
  requesterId: string
  warehouseId: string
  status: ProcurementStatus
  priority?: RequestPriority
  service?: string
  items: ProcurementItem[]
  createdAt: string
  submittedAt?: string
  decidedAt?: string
  decisionNote?: string
  note: string
  assigneeId?: string
  assignedRole?: 'PROCUREMENT' | 'WAREHOUSE_MANAGER'
  handedOffAt?: string
  takenAt?: string
}

export type ConsultationStatus = 'sent' | 'quoted' | 'awarded' | 'cancelled'

export interface QuoteLine {
  productId: string
  quantity: number
  unitPrice: number
}

export interface QuoteFile {
  name: string
  size: number
  type: string
  dataUrl: string
}

export interface SupplierQuote {
  id: string
  supplierId: string
  status: 'pending' | 'received' | 'declined'
  receivedAt?: string
  validUntil?: string
  leadTimeDays?: number
  amount?: number
  lines?: QuoteLine[]
  note?: string
  file?: QuoteFile
}

export interface Consultation {
  id: string
  code?: string
  status: ConsultationStatus
  procurementRequestIds: string[]
  warehouseId: string
  supplierIds: string[]
  items: ProcurementItem[]
  quotes: SupplierQuote[]
  createdAt: string
  sentAt?: string
  quotedAt?: string
  awardedAt?: string
  awardedQuoteId?: string
  note?: string
}

export interface TimelineStep {
  id: string
  label: string
  state: 'done' | 'current' | 'upcoming' | 'skipped'
  date?: string
  detail?: string
}

export type PurchaseStatus =
  | 'draft'
  | 'sent'
  | 'confirmed'
  | 'partial'
  | 'received'
  | 'delayed'
  | 'cancelled'

export interface PurchaseOrder {
  id: string
  code?: string
  supplierId: string
  warehouseId: string
  status: PurchaseStatus
  items: ProcurementItem[]
  expectedDate: string
  createdAt: string
  amount: number
  procurementRequestId?: string
  procurementRequestIds?: string[]
  consultationId?: string
  quoteId?: string
}

export type ReceiptStatus = 'pending' | 'checking' | 'partial' | 'validated'

export interface ReceiptLine {
  productId: string
  expected: number
  received: number
  lotCode?: string
  expiryDate?: string
  locationId?: string
}

export interface Receipt {
  id: string
  code?: string
  purchaseOrderId: string
  warehouseId: string
  expected: number
  received: number
  date: string
  status: ReceiptStatus
  userId: string
  items?: ReceiptLine[]
  note?: string
  checkedAt?: string
}

export interface GeoPoint {
  lat: number
  lng: number
  label?: string
  at?: string
}

export interface DeliveryNoteLine {
  productId: string
  productName: string
  sku?: string
  quantity: number
  unit: string
}

export type MapMarkerTone = 'done' | 'current' | 'pending' | 'risk' | 'origin'

export interface MapMarker {
  id: string
  lat: number
  lng: number
  kind: 'origin' | 'stop' | 'destination' | 'vehicle'
  label?: string
  sequence?: number
  tone?: MapMarkerTone
}

export type CarrierKind = 'own_fleet' | 'parcel' | 'freight'

export interface Carrier {
  id: string
  name: string
  code: string
  kind: CarrierKind
  trackingUrlTemplate?: string
  active: boolean
}

export interface ShippingNote {
  id: string
  code: string
  warehouseId: string
  customerId?: string
  addressId?: string
  client: string
  address: string
  city: string
  lines: DeliveryNoteLine[]
  status: 'ready' | 'assigned' | 'delivered'
  deliveryId?: string
  shipmentId?: string
  notes?: string
  carrierId?: string
  carrierName?: string
  trackingNumber?: string
  labelPrintedAt?: string
  bookedAt?: string
  createdAt?: string
  createdByUserId?: string
  loadedAt?: string
  loadedByUserId?: string
  stockReserved?: boolean
  inTransitToWarehouseId?: string
  stockReceivedAt?: string
}

export type ShipmentStatus = 'preparing' | 'in_transit' | 'done' | 'delayed'

export interface Shipment {
  id: string
  originWarehouseId: string
  destination: string
  destinationWarehouseId?: string
  vehicleId: string
  driverId: string
  routeId?: string
  date: string
  status: ShipmentStatus
  code?: string
  origin: GeoPoint
  destinationLocation: GeoPoint
  path?: GeoPoint[]
  currentPosition?: GeoPoint
  progress: number
  lines: DeliveryNoteLine[]
  eta?: string
  notes?: string
  shippingNoteIds?: string[]
}

export type DeliveryStatus = 'prepared' | 'in_transit' | 'delivered' | 'failed' | 'at_risk'

export interface Delivery {
  id: string
  client: string
  address: string
  city: string
  scheduledAt: string
  status: DeliveryStatus
  driverId: string
  vehicleId: string
  routeId: string
  sequence: number
  notes?: string
  code?: string
  warehouseId: string
  location: GeoPoint
  path?: GeoPoint[]
  currentPosition?: GeoPoint
  progress: number
  lines: DeliveryNoteLine[]
  signedAt?: string
  signedBy?: string
  signatureDataUrl?: string
  podLocation?: GeoPoint & { at?: string }
  eta?: string
  shippingNoteId?: string
}

export type RouteStatus = 'planned' | 'in_progress' | 'done'

export interface Route {
  id: string
  name: string
  date: string
  driverId: string
  vehicleId: string
  warehouseId: string
  status: RouteStatus
  distanceKm: number
  path?: GeoPoint[]
  currentPosition?: GeoPoint
  progress: number
}

export type VehicleStatus = 'available' | 'on_mission' | 'maintenance'

export interface Vehicle {
  id: string
  name: string
  plate: string
  status: VehicleStatus
  warehouseId: string
}

export interface Driver {
  id: string
  userId: string
  vehicleId?: string
  phone: string
  status: 'available' | 'on_route' | 'off'
}

export type TaskStatus = 'todo' | 'doing' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high'

export interface Task {
  id: string
  title: string
  description: string
  assigneeId: string
  dueAt: string
  status: TaskStatus
  priority: TaskPriority
  relatedType?: string
  relatedId?: string
}

export type AlertSeverity = 'critical' | 'warning' | 'info'

export interface Alert {
  id: string
  title: string
  message: string
  severity: AlertSeverity
  createdAt: string
  read: boolean
  domain: 'stock' | 'procurement' | 'logistics' | 'finance' | 'task'
  relatedId?: string
  warehouseId?: string
  userId?: string
  roles?: RoleKey[]
}

export interface PlanningEvent {
  id: string
  title: string
  date: string
  type: 'delivery' | 'receipt' | 'inventory' | 'meeting' | 'task'
  relatedId?: string
}

export interface Invoice {
  id: string
  supplierId: string
  purchaseOrderId: string
  amount: number
  status: 'draft' | 'pending' | 'paid' | 'overdue'
  dueDate: string
}

export interface Payment {
  id: string
  invoiceId: string
  amount: number
  date: string
}

export interface Budget {
  id: string
  name: string
  period: string
  allocated: number
  spent: number
}

export interface Expense {
  id: string
  label: string
  amount: number
  date: string
  category: string
}

export interface AppNotification {
  id: string
  title: string
  message: string
  createdAt: string
  read: boolean
  type: AlertSeverity
  userId?: string
}

export interface AuditLog {
  id: string
  userId: string
  action: string
  entity: string
  entityId: string
  createdAt: string
}

export interface AssistantMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  suggestions?: string[]
  proposedAction?: ProposedAction
  insights?: AssistantInsight[]
}

export interface AssistantInsight {
  title: string
  detail: string
  tone: AlertSeverity
}

export type ProposedActionType =
  | 'create_product'
  | 'create_supplier'
  | 'create_task'
  | 'create_procurement'
  | 'create_purchase'
  | 'receive_stock'
  | 'confirm_delivery'

export interface ProposedActionField {
  key: string
  label: string
  value: string
}

export interface ProposedAction {
  type: ProposedActionType
  summary: string
  fields: ProposedActionField[]
  payload: Record<string, string | number>
}

export interface AttentionItem {
  id: string
  title: string
  detail: string
  tone: AlertSeverity
  primaryLabel: string
  primaryTo?: string
  assistantPrompt?: string
  secondaryLabel?: string
  secondaryPrompt?: string
  secondaryTo?: string
}

export type CompanyStatus = 'active' | 'trial' | 'suspended' | 'churned'
export type BillingInterval = 'monthly' | 'yearly'
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'paused'
export type PlatformInvoiceStatus = 'draft' | 'open' | 'paid' | 'overdue' | 'void'
export type PlanModule = 'stock' | 'procurement' | 'purchasing' | 'logistics' | 'assistant' | 'analytics' | 'finance'

export interface Company {
  id: string
  name: string
  legalName: string
  ice: string
  city: string
  email: string
  phone: string
  status: CompanyStatus
  createdAt: string
  usersCount: number
  warehousesCount: number
}

export interface SubscriptionPlan {
  id: string
  name: string
  code: string
  description: string
  monthlyPrice: number
  yearlyPrice: number
  maxUsers: number
  maxWarehouses: number
  modules: PlanModule[]
  active: boolean
  stripePriceMonthly?: string
  stripePriceYearly?: string
}

export interface Subscription {
  id: string
  companyId: string
  planId: string
  status: SubscriptionStatus
  interval: BillingInterval
  startedAt: string
  currentPeriodEnd: string
  trialEndsAt?: string
  seats: number
  stripeCustomerId?: string
  stripeSubscriptionId?: string
}

export interface PlatformInvoice {
  id: string
  companyId: string
  subscriptionId: string
  number: string
  amount: number
  status: PlatformInvoiceStatus
  issuedAt: string
  dueDate: string
  paidAt?: string
  paymentProvider?: string
  paymentRef?: string
}

export interface Entitlements {
  companyId: string | null
  planId: string | null
  planName: string
  status: string
  modules: PlanModule[]
  maxUsers: number
  maxWarehouses: number
  usersCount: number
  warehousesCount: number
  seats: number
  unlimitedUsers: boolean
  unlimitedWarehouses: boolean
  canAddUser: boolean
  canAddWarehouse: boolean
}

export interface MockDatabase {
  users: User[]
  roles: Role[]
  permissions: Permission[]
  categories: Category[]
  products: Product[]
  warehouses: Warehouse[]
  stock: StockItem[]
  stockMovements: StockMovement[]
  inventories: InventorySession[]
  suppliers: Supplier[]
  procurementRequests: ProcurementRequest[]
  consultations: Consultation[]
  purchaseOrders: PurchaseOrder[]
  receipts: Receipt[]
  shipments: Shipment[]
  deliveries: Delivery[]
  routes: Route[]
  vehicles: Vehicle[]
  drivers: Driver[]
  shippingNotes: ShippingNote[]
  customers: Customer[]
  stockLots: StockLot[]
  warehouseLocations: WarehouseLocation[]
  stockPlacements: StockPlacement[]
  tasks: Task[]
  alerts: Alert[]
  planning: PlanningEvent[]
  invoices: Invoice[]
  payments: Payment[]
  budgets: Budget[]
  expenses: Expense[]
  notifications: AppNotification[]
  auditLogs: AuditLog[]
  companies: Company[]
  plans: SubscriptionPlan[]
  subscriptions: Subscription[]
  platformInvoices: PlatformInvoice[]
}
