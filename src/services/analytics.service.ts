import { supplierService } from './supplier.service'
import { productService } from './product.service'
import { analyticsRepository } from '@/repositories'

export const analyticsService = {
  async snapshot(_warehouseIds?: string[]) {
    const [kpis, suppliers, products] = await Promise.all([
      analyticsRepository.snapshot(),
      supplierService.list(),
      productService.list(),
    ])
    return {
      ...kpis,
      stockRisks: kpis.stockouts + kpis.stockWatch,
      deliveryRisks: kpis.failedDeliveries + (kpis.otifDelivered - kpis.otifOnTime),
      weakSuppliers: suppliers.filter((item) => item.reliability < 75).length,
      catalogSize: products.length,
    }
  },
}
