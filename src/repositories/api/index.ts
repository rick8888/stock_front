import { ApiError, getAccessToken, httpClient, setAccessToken, tokenFromPayload } from '@/services/http/http.client'
import type {
  AuthRepository,
  CompanyInput,
  DeliveryInput,
  DeliveryRepository,
  FinanceRepository,
  LogisticsRepository,
  PlanInput,
  PlatformRepository,
  ProcurementRepository,
  ProductInput,
  ProductRepository,
  PurchaseRepository,
  ReceiptRepository,
  RouteInput,
  ShipmentInput,
  ShippingNoteInput,
  VehicleInput,
  DriverInput,
  StockRepository,
  SupplierInput,
  SupplierRepository,
  TaskRepository,
  UserInput,
  UserRepository,
  WarehouseRepository,
  AlertRepository,
  PlanningRepository,
  RoleRepository,
  ConsultationRepository,
  CustomerRepository,
  CustomerInput,
  StockLotRepository,
  ReplenishmentRepository,
  BillingSession,
  PlatformPayResult,
  AnalyticsRepository,
  WarehouseLocationRepository,
  WarehouseLocationInput,
  StockPlacementRepository,
  SupplierProductRepository,
  TrackingRepository,
} from '@/repositories/interfaces'
import type {
  Delivery,
  ProcurementRequest,
  Product,
  PurchaseOrder,
  Receipt,
  Shipment,
  Route,
  Vehicle,
  Driver,
  Invoice,
  Payment,
  Budget,
  Expense,
  Task,
  User,
  Warehouse,
  Supplier,
  SupplierProduct,
  StockItem,
  StockMovement,
  InventorySession,
  ShippingNote,
  Customer,
  StockLot,
  ReplenishmentSuggestion,
  WarehouseLocation,
  StockPlacement,
  PickPathStep,
  Company,
  CompanyStatus,
  SubscriptionPlan,
  Subscription,
  PlatformInvoice,
  BillingInterval,
  SubscriptionStatus,
  Consultation,
  Alert,
  PlanningEvent,
  Role,
  LiveRouteTracking,
  RouteTrackingSnapshot,
  TrackingEvent,
  TrackingPingInput,
} from '@/types'

export class ApiProductRepository implements ProductRepository {
  list(): Promise<Product[]> {
    return httpClient.request('/products')
  }
  getById(id: string): Promise<Product | null> {
    return httpClient.request(`/products/${id}`)
  }
  create(input: ProductInput): Promise<Product> {
    return httpClient.request('/products', { method: 'POST', body: JSON.stringify(input) })
  }
  update(id: string, input: Partial<ProductInput>): Promise<Product> {
    return httpClient.request(`/products/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
  }
  archive(id: string): Promise<void> {
    return httpClient.request(`/products/${id}`, { method: 'DELETE' })
  }
}

export class ApiWarehouseRepository implements WarehouseRepository {
  list(): Promise<Warehouse[]> {
    return httpClient.request('/warehouses')
  }
  getById(id: string): Promise<Warehouse | null> {
    return httpClient.request(`/warehouses/${id}`)
  }
  create(input: Omit<Warehouse, 'id'>): Promise<Warehouse> {
    return httpClient.request('/warehouses', { method: 'POST', body: JSON.stringify(input) })
  }
  update(id: string, input: Partial<Warehouse>): Promise<Warehouse> {
    return httpClient.request(`/warehouses/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
  }
}

export class ApiStockRepository implements StockRepository {
  list(): Promise<StockItem[]> {
    return httpClient.request('/stock')
  }
  movements(): Promise<StockMovement[]> {
    return httpClient.request('/stock/movements')
  }
  inventories(): Promise<InventorySession[]> {
    return httpClient.request('/stock/inventories')
  }
  receive(productId: string, warehouseId: string, quantity: number, userId: string, note: string, reference?: string): Promise<void> {
    return httpClient.request('/stock/receive', {
      method: 'POST',
      body: JSON.stringify({ productId, warehouseId, quantity, userId, note, reference }),
    })
  }
  issue(productId: string, warehouseId: string, quantity: number, userId: string, note: string, reference?: string): Promise<void> {
    return httpClient.request('/stock/issue', {
      method: 'POST',
      body: JSON.stringify({ productId, warehouseId, quantity, userId, note, reference }),
    })
  }
  transfer(
    productId: string,
    fromWarehouseId: string,
    toWarehouseId: string,
    quantity: number,
    userId: string,
    note?: string,
  ): Promise<void> {
    return httpClient.request('/stock/transfer', {
      method: 'POST',
      body: JSON.stringify({ productId, fromWarehouseId, toWarehouseId, quantity, userId, note }),
    })
  }
  adjust(productId: string, warehouseId: string, quantity: number, userId: string, note: string): Promise<void> {
    return httpClient.request('/stock/adjust', {
      method: 'POST',
      body: JSON.stringify({ productId, warehouseId, quantity, userId, note }),
    })
  }
  toggleAssignment(productId: string, warehouseId: string, enabled: boolean): Promise<void> {
    return httpClient.request('/stock/assignment', {
      method: 'PATCH',
      body: JSON.stringify({ productId, warehouseId, enabled }),
    })
  }
  startInventory(
    warehouseId: string,
    userId: string,
    scope?: import('@/types').InventoryScope,
  ): Promise<InventorySession> {
    return httpClient.request('/stock/inventories', {
      method: 'POST',
      body: JSON.stringify({ warehouseId, userId, scope }),
    })
  }
  saveInventory(id: string, lines: { productId: string; counted: number }[]): Promise<InventorySession> {
    return httpClient.request(`/stock/inventories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ lines }),
    })
  }
  completeInventory(id: string, userId: string): Promise<InventorySession> {
    return httpClient.request(`/stock/inventories/${id}/complete`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    })
  }
  submitInventory(id: string, userId: string): Promise<InventorySession> {
    return httpClient.request(`/stock/inventories/${id}/submit`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    })
  }
  closeDay(warehouseId: string, userId: string): Promise<void> {
    return httpClient.request('/stock/close-day', {
      method: 'POST',
      body: JSON.stringify({ warehouseId, userId }),
    })
  }
  returnStock(
    productId: string,
    warehouseId: string,
    quantity: number,
    userId: string,
    note: string,
    reference?: string,
  ): Promise<void> {
    return httpClient.request('/stock/return', {
      method: 'POST',
      body: JSON.stringify({ productId, warehouseId, quantity, userId, note, reference }),
    })
  }
}

export class ApiSupplierRepository implements SupplierRepository {
  list(): Promise<Supplier[]> {
    return httpClient.request('/suppliers')
  }
  getById(id: string): Promise<Supplier | null> {
    return httpClient.request(`/suppliers/${id}`)
  }
  create(input: SupplierInput): Promise<Supplier> {
    return httpClient.request('/suppliers', { method: 'POST', body: JSON.stringify(input) })
  }
  update(id: string, input: Partial<SupplierInput>): Promise<Supplier> {
    return httpClient.request(`/suppliers/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
  }
}

export class ApiSupplierProductRepository implements SupplierProductRepository {
  list(): Promise<SupplierProduct[]> {
    return httpClient.request('/supplier-products')
  }
}

export class ApiProcurementRepository implements ProcurementRepository {
  list(): Promise<ProcurementRequest[]> {
    return httpClient.request('/procurement')
  }
  create(
    input: Omit<ProcurementRequest, 'id' | 'createdAt' | 'status'> & { status?: ProcurementRequest['status'] },
  ): Promise<ProcurementRequest> {
    return httpClient.request('/procurement', { method: 'POST', body: JSON.stringify(input) })
  }
  updateStatus(id: string, status: ProcurementRequest['status'], extras?: Partial<ProcurementRequest>): Promise<ProcurementRequest> {
    return httpClient.request(`/procurement/${id}`, { method: 'PATCH', body: JSON.stringify({ status, ...extras }) })
  }
}

export class ApiPurchaseRepository implements PurchaseRepository {
  list(): Promise<PurchaseOrder[]> {
    return httpClient.request('/purchases')
  }
  create(input: Omit<PurchaseOrder, 'id' | 'createdAt'>): Promise<PurchaseOrder> {
    return httpClient.request('/purchases', { method: 'POST', body: JSON.stringify(input) })
  }
  updateStatus(id: string, status: PurchaseOrder['status']): Promise<PurchaseOrder> {
    return httpClient.request(`/purchases/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) })
  }
}

export class ApiReceiptRepository implements ReceiptRepository {
  list(): Promise<Receipt[]> {
    return httpClient.request('/receipts')
  }
  create(input: Omit<Receipt, 'id'>): Promise<Receipt> {
    return httpClient.request('/receipts', { method: 'POST', body: JSON.stringify(input) })
  }
  createFromOrder(purchaseOrderId: string): Promise<Receipt> {
    return httpClient.request(`/receipts/from-order/${encodeURIComponent(purchaseOrderId)}`, {
      method: 'POST',
    })
  }
  validate(
    id: string,
    received: number,
    userId: string,
    lines?: { productId: string; received: number; lotCode?: string; expiryDate?: string; locationId?: string }[],
  ): Promise<Receipt> {
    return httpClient.request(`/receipts/${id}/validate`, {
      method: 'POST',
      body: JSON.stringify({ received, userId, lines }),
    })
  }
}

export class ApiDeliveryRepository implements DeliveryRepository {
  list(): Promise<Delivery[]> {
    return httpClient.request('/deliveries')
  }
  create(input: DeliveryInput): Promise<Delivery> {
    return httpClient.request('/deliveries', { method: 'POST', body: JSON.stringify(input) })
  }
  update(id: string, input: Partial<DeliveryInput>): Promise<Delivery> {
    return httpClient.request(`/deliveries/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
  }
  updateStatus(
    id: string,
    status: Delivery['status'],
    note?: string,
    signedBy?: string,
    proof?: import('@/repositories/interfaces').DeliveryProofInput,
  ): Promise<Delivery> {
    return httpClient.request(`/deliveries/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, note, signedBy, ...proof }),
    })
  }
}

export class ApiLogisticsRepository implements LogisticsRepository {
  shipments(): Promise<Shipment[]> {
    return httpClient.request('/shipments')
  }
  carriers(): Promise<import('@/types').Carrier[]> {
    return httpClient.request('/carriers')
  }
  routes(): Promise<Route[]> {
    return httpClient.request('/routes')
  }
  vehicles(): Promise<Vehicle[]> {
    return httpClient.request('/vehicles')
  }
  drivers(): Promise<Driver[]> {
    return httpClient.request('/drivers')
  }
  shippingNotes(): Promise<ShippingNote[]> {
    return httpClient.request('/shipping-notes')
  }
  createShippingNote(input: ShippingNoteInput): Promise<ShippingNote> {
    return httpClient.request('/shipping-notes', { method: 'POST', body: JSON.stringify(input) })
  }
  updateShippingNote(id: string, input: Partial<ShippingNoteInput>): Promise<ShippingNote> {
    return httpClient.request(`/shipping-notes/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
  }
  assignCarrier(id: string, input: import('@/repositories/interfaces').ShippingNoteCarrierInput): Promise<ShippingNote> {
    return httpClient.request(`/shipping-notes/${id}/carrier`, { method: 'PATCH', body: JSON.stringify(input) })
  }
  markLabelPrinted(id: string): Promise<ShippingNote> {
    return httpClient.request(`/shipping-notes/${id}/label-printed`, { method: 'POST' })
  }
  startPicking(id: string): Promise<ShippingNote> {
    return httpClient.request(`/shipping-notes/${id}/start-picking`, { method: 'POST' })
  }
  updateVehicle(id: string, input: Partial<VehicleInput>): Promise<Vehicle> {
    return httpClient.request(`/vehicles/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
  }
  createVehicle(input: VehicleInput): Promise<Vehicle> {
    return httpClient.request('/vehicles', { method: 'POST', body: JSON.stringify(input) })
  }
  createDriver(input: DriverInput): Promise<Driver> {
    return httpClient.request('/drivers', { method: 'POST', body: JSON.stringify(input) })
  }
  updateDriver(id: string, input: Partial<DriverInput>): Promise<Driver> {
    return httpClient.request(`/drivers/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
  }
  createRoute(input: RouteInput): Promise<Route> {
    return httpClient.request('/routes', { method: 'POST', body: JSON.stringify(input) })
  }
  updateRoute(id: string, input: Partial<RouteInput>): Promise<Route> {
    return httpClient.request(`/routes/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
  }
  createShipment(input: ShipmentInput): Promise<Shipment> {
    return httpClient.request('/shipments', { method: 'POST', body: JSON.stringify(input) })
  }
  updateShipment(id: string, input: Partial<ShipmentInput>): Promise<Shipment> {
    return httpClient.request(`/shipments/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
  }
  loadShippingNote(id: string, userId: string): Promise<ShippingNote> {
    return httpClient.request(`/shipping-notes/${id}/load`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    })
  }
}

export class ApiTrackingRepository implements TrackingRepository {
  live(): Promise<LiveRouteTracking[]> {
    return httpClient.request('/tracking/live')
  }
  route(id: string): Promise<RouteTrackingSnapshot> {
    return httpClient.request(`/tracking/routes/${encodeURIComponent(id)}`)
  }
  ping(input: TrackingPingInput): Promise<{ event: TrackingEvent; route: Route; etaAt?: string }> {
    return httpClient.request('/tracking/ping', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  }
}

export class ApiFinanceRepository implements FinanceRepository {
  invoices(): Promise<Invoice[]> {
    return httpClient.request('/finance/invoices')
  }
  payments(): Promise<Payment[]> {
    return httpClient.request('/finance/payments')
  }
  budgets(): Promise<Budget[]> {
    return httpClient.request('/finance/budgets')
  }
  expenses(): Promise<Expense[]> {
    return httpClient.request('/finance/expenses')
  }
  payInvoice(id: string): Promise<void> {
    return httpClient.request(`/finance/invoices/${id}/pay`, { method: 'POST' })
  }
}

export class ApiTaskRepository implements TaskRepository {
  list(): Promise<Task[]> {
    return httpClient.request('/tasks')
  }
  create(input: Omit<Task, 'id'>): Promise<Task> {
    return httpClient.request('/tasks', { method: 'POST', body: JSON.stringify(input) })
  }
  update(id: string, input: Partial<Task>): Promise<Task> {
    return httpClient.request(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
  }
}

export class ApiUserRepository implements UserRepository {
  list(): Promise<User[]> {
    return httpClient.request('/users')
  }
  getById(id: string): Promise<User | null> {
    return httpClient.request(`/users/${id}`)
  }
  findByEmail(email: string): Promise<User | null> {
    return httpClient.request(`/users?email=${encodeURIComponent(email)}`)
  }
  create(input: UserInput): Promise<User> {
    return httpClient.request('/users', { method: 'POST', body: JSON.stringify(input) })
  }
  update(id: string, input: Partial<UserInput>): Promise<User> {
    return httpClient.request(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
  }
}

export class ApiAuthRepository implements AuthRepository {
  async login(email: string, password: string): Promise<User> {
    const payload = await httpClient.request<{ access_token?: string; accessToken?: string; user: User }>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      },
    )
    setAccessToken(tokenFromPayload(payload))
    return payload.user
  }

  async logout(): Promise<void> {
    try {
      await httpClient.request('/auth/logout', { method: 'POST' })
    } finally {
      setAccessToken(null)
    }
  }

  async restore(_userId: string): Promise<User | null> {
    if (!getAccessToken()) return null
    try {
      return await httpClient.request<User>('/auth/me')
    } catch (err) {
      const refreshed = await this.refresh().catch(() => null)
      if (refreshed) return refreshed
      if (err instanceof ApiError && err.status === 401) {
        setAccessToken(null)
        return null
      }
      throw err
    }
  }

  private async refresh(): Promise<User | null> {
    const payload = await httpClient.request<{ access_token?: string; accessToken?: string; user: User }>(
      '/auth/refresh',
      { method: 'POST' },
    )
    const token = tokenFromPayload(payload)
    if (!token || !payload.user) return null
    setAccessToken(token)
    return payload.user
  }
}

export class ApiPlatformRepository implements PlatformRepository {
  companies(): Promise<Company[]> {
    return httpClient.request('/platform/companies')
  }
  plans(): Promise<SubscriptionPlan[]> {
    return httpClient.request('/platform/plans')
  }
  subscriptions(): Promise<Subscription[]> {
    return httpClient.request('/platform/subscriptions')
  }
  invoices(): Promise<PlatformInvoice[]> {
    return httpClient.request('/platform/invoices')
  }
  createCompany(input: CompanyInput): Promise<Company> {
    return httpClient.request('/platform/companies', { method: 'POST', body: JSON.stringify(input) })
  }
  updateCompany(id: string, input: Partial<CompanyInput> & { status?: CompanyStatus }): Promise<Company> {
    return httpClient.request(`/platform/companies/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
  }
  createPlan(input: PlanInput): Promise<SubscriptionPlan> {
    return httpClient.request('/platform/plans', { method: 'POST', body: JSON.stringify(input) })
  }
  updatePlan(id: string, input: Partial<PlanInput>): Promise<SubscriptionPlan> {
    return httpClient.request(`/platform/plans/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
  }
  changeSubscription(
    companyId: string,
    input: { planId?: string; interval?: BillingInterval; status?: SubscriptionStatus },
  ): Promise<Subscription> {
    return httpClient.request(`/platform/companies/${companyId}/subscription`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
  }
  payInvoice(id: string): Promise<PlatformPayResult> {
    return httpClient.request(`/platform/invoices/${id}/pay`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
  }
  checkout(
    input: { companyId?: string; planId?: string; interval?: BillingInterval; invoiceId?: string } = {},
  ): Promise<BillingSession> {
    return httpClient.request('/platform/billing/checkout', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  }
  portal(input: { companyId?: string } = {}): Promise<BillingSession> {
    return httpClient.request('/platform/billing/portal', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  }
}

export class ApiConsultationRepository implements ConsultationRepository {
  list(): Promise<Consultation[]> {
    return httpClient.request('/consultations')
  }
  create(input: Omit<Consultation, 'id' | 'createdAt'>): Promise<Consultation> {
    return httpClient.request('/consultations', { method: 'POST', body: JSON.stringify(input) })
  }
  update(id: string, input: Partial<Consultation>): Promise<Consultation> {
    return httpClient.request(`/consultations/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
  }
}

export class ApiAlertRepository implements AlertRepository {
  list(): Promise<Alert[]> {
    return httpClient.request('/alerts')
  }
  markRead(id: string): Promise<void> {
    return httpClient.request(`/alerts/${id}/read`, { method: 'POST' })
  }
}

export class ApiPlanningRepository implements PlanningRepository {
  list(from?: string, to?: string): Promise<PlanningEvent[]> {
    const query = new URLSearchParams()
    if (from) query.set('from', from)
    if (to) query.set('to', to)
    const suffix = query.toString() ? `?${query.toString()}` : ''
    return httpClient.request(`/planning${suffix}`)
  }
}

export class ApiRoleRepository implements RoleRepository {
  list(): Promise<Role[]> {
    return httpClient.request('/roles')
  }
}

export class ApiCustomerRepository implements CustomerRepository {
  list(): Promise<Customer[]> {
    return httpClient.request('/customers')
  }
  getById(id: string): Promise<Customer | null> {
    return httpClient.request(`/customers/${id}`)
  }
  create(input: CustomerInput): Promise<Customer> {
    return httpClient.request('/customers', { method: 'POST', body: JSON.stringify(input) })
  }
  update(id: string, input: Partial<CustomerInput>): Promise<Customer> {
    return httpClient.request(`/customers/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
  }
}

export class ApiStockLotRepository implements StockLotRepository {
  list(warehouseId?: string, productId?: string): Promise<StockLot[]> {
    const query = new URLSearchParams()
    if (warehouseId) query.set('warehouseId', warehouseId)
    if (productId) query.set('productId', productId)
    const suffix = query.toString() ? `?${query}` : ''
    return httpClient.request(`/stock/lots${suffix}`)
  }
}

export class ApiReplenishmentRepository implements ReplenishmentRepository {
  list(warehouseId?: string): Promise<ReplenishmentSuggestion[]> {
    const suffix = warehouseId ? `?warehouseId=${encodeURIComponent(warehouseId)}` : ''
    return httpClient.request(`/replenishment/suggestions${suffix}`)
  }
  compute(warehouseId: string, refreshDemand = false): Promise<ReplenishmentSuggestion[]> {
    return httpClient.request('/replenishment/compute', {
      method: 'POST',
      body: JSON.stringify({ warehouseId, refreshDemand }),
    })
  }
}

export class ApiAnalyticsRepository implements AnalyticsRepository {
  snapshot(): ReturnType<AnalyticsRepository['snapshot']> {
    return httpClient.request('/analytics/snapshot')
  }
}

export class ApiWarehouseLocationRepository implements WarehouseLocationRepository {
  list(warehouseId?: string): Promise<WarehouseLocation[]> {
    const suffix = warehouseId ? `?warehouseId=${encodeURIComponent(warehouseId)}` : ''
    return httpClient.request(`/locations${suffix}`)
  }
  getById(id: string): Promise<WarehouseLocation | null> {
    return httpClient.request(`/locations/${id}`)
  }
  create(input: WarehouseLocationInput): Promise<WarehouseLocation> {
    return httpClient.request('/locations', { method: 'POST', body: JSON.stringify(input) })
  }
  update(id: string, input: Partial<WarehouseLocationInput>): Promise<WarehouseLocation> {
    return httpClient.request(`/locations/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
  }
}

export class ApiStockPlacementRepository implements StockPlacementRepository {
  list(warehouseId?: string, productId?: string): Promise<StockPlacement[]> {
    const query = new URLSearchParams()
    if (warehouseId) query.set('warehouseId', warehouseId)
    if (productId) query.set('productId', productId)
    const suffix = query.toString() ? `?${query}` : ''
    return httpClient.request(`/stock/placements${suffix}`)
  }
  async pickPath(
    warehouseId: string,
    lines: { productId: string; quantity: number; productName?: string; sku?: string }[],
  ): Promise<PickPathStep[]> {
    const payload = await httpClient.request<{ items: PickPathStep[] }>('/stock/pick-path', {
      method: 'POST',
      body: JSON.stringify({ warehouseId, lines }),
    })
    return payload.items ?? []
  }
  suggestPutaway(warehouseId: string, productId: string): Promise<WarehouseLocation | null> {
    const query = new URLSearchParams({ warehouseId, productId })
    return httpClient.request(`/stock/suggest-putaway?${query}`)
  }
}
