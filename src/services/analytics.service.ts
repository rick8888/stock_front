import { stockService } from './stock.service'
import { purchaseService } from './purchase.service'
import { deliveryService } from './delivery.service'
import { supplierService } from './supplier.service'
import { productService } from './product.service'
import { stockRepository } from '@/repositories'

export const analyticsService = {
  async snapshot(warehouseIds?: string[]) {
    const [risks, delayed, atRisk, suppliers, products, movements] = await Promise.all([
      stockService.risks(warehouseIds),
      purchaseService.delayed(),
      deliveryService.atRisk(),
      supplierService.list(),
      productService.list(),
      stockRepository.movements(),
    ])
    const issued = movements.filter((item) => item.type === 'issue').reduce((sum, item) => sum + item.quantity, 0)
    const received = movements
      .filter((item) => item.type === 'receive')
      .reduce((sum, item) => sum + item.quantity, 0)
    return {
      stockRisks: risks.length,
      delayedOrders: delayed.length,
      deliveryRisks: atRisk.length,
      weakSuppliers: suppliers.filter((item) => item.reliability < 75).length,
      catalogSize: products.length,
      issued,
      received,
      netFlow: received - issued,
    }
  },
}
