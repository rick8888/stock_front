import { apiConfig } from '@/config/api'
import type {
  AlertRepository,
  AuthRepository,
  DeliveryRepository,
  FinanceRepository,
  LogisticsRepository,
  PlanningRepository,
  ProcurementRepository,
  ProductRepository,
  PurchaseRepository,
  ConsultationRepository,
  ReceiptRepository,
  RoleRepository,
  StockRepository,
  SupplierRepository,
  TaskRepository,
  UserRepository,
  WarehouseRepository,
  PlatformRepository,
} from '@/repositories/interfaces'
import { MockProductRepository } from '@/repositories/mock/product.repository'
import { MockWarehouseRepository } from '@/repositories/mock/warehouse.repository'
import { MockStockRepository } from '@/repositories/mock/stock.repository'
import { MockSupplierRepository } from '@/repositories/mock/supplier.repository'
import { MockProcurementRepository } from '@/repositories/mock/procurement.repository'
import { MockPurchaseRepository } from '@/repositories/mock/purchase.repository'
import { MockConsultationRepository } from '@/repositories/mock/consultation.repository'
import { MockReceiptRepository } from '@/repositories/mock/receipt.repository'
import { MockDeliveryRepository } from '@/repositories/mock/delivery.repository'
import { MockLogisticsRepository } from '@/repositories/mock/logistics.repository'
import { MockTaskRepository } from '@/repositories/mock/task.repository'
import { MockAlertRepository, MockPlanningRepository } from '@/repositories/mock/alert.repository'
import { MockFinanceRepository } from '@/repositories/mock/finance.repository'
import { MockAuthRepository, MockRoleRepository, MockUserRepository } from '@/repositories/mock/user.repository'
import { MockPlatformRepository } from '@/repositories/mock/platform.repository'
import {
  ApiAlertRepository,
  ApiAuthRepository,
  ApiConsultationRepository,
  ApiDeliveryRepository,
  ApiFinanceRepository,
  ApiLogisticsRepository,
  ApiPlanningRepository,
  ApiPlatformRepository,
  ApiProcurementRepository,
  ApiProductRepository,
  ApiPurchaseRepository,
  ApiReceiptRepository,
  ApiRoleRepository,
  ApiStockRepository,
  ApiSupplierRepository,
  ApiTaskRepository,
  ApiUserRepository,
  ApiWarehouseRepository,
} from '@/repositories/api'

const useApi = apiConfig.useApi

export const productRepository: ProductRepository = useApi ? new ApiProductRepository() : new MockProductRepository()
export const warehouseRepository: WarehouseRepository = useApi
  ? new ApiWarehouseRepository()
  : new MockWarehouseRepository()
export const stockRepository: StockRepository = useApi ? new ApiStockRepository() : new MockStockRepository()
export const supplierRepository: SupplierRepository = useApi ? new ApiSupplierRepository() : new MockSupplierRepository()
export const procurementRepository: ProcurementRepository = useApi
  ? new ApiProcurementRepository()
  : new MockProcurementRepository()
export const purchaseRepository: PurchaseRepository = useApi ? new ApiPurchaseRepository() : new MockPurchaseRepository()
export const consultationRepository: ConsultationRepository = useApi
  ? new ApiConsultationRepository()
  : new MockConsultationRepository()
export const receiptRepository: ReceiptRepository = useApi ? new ApiReceiptRepository() : new MockReceiptRepository()
export const deliveryRepository: DeliveryRepository = useApi ? new ApiDeliveryRepository() : new MockDeliveryRepository()
export const logisticsRepository: LogisticsRepository = useApi
  ? new ApiLogisticsRepository()
  : new MockLogisticsRepository()
export const taskRepository: TaskRepository = useApi ? new ApiTaskRepository() : new MockTaskRepository()
export const alertRepository: AlertRepository = useApi ? new ApiAlertRepository() : new MockAlertRepository()
export const planningRepository: PlanningRepository = useApi ? new ApiPlanningRepository() : new MockPlanningRepository()
export const financeRepository: FinanceRepository = useApi ? new ApiFinanceRepository() : new MockFinanceRepository()
export const userRepository: UserRepository = useApi ? new ApiUserRepository() : new MockUserRepository()
export const roleRepository: RoleRepository = useApi ? new ApiRoleRepository() : new MockRoleRepository()
export const authRepository: AuthRepository = useApi ? new ApiAuthRepository() : new MockAuthRepository()
export const platformRepository: PlatformRepository = useApi ? new ApiPlatformRepository() : new MockPlatformRepository()
