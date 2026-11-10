import type { Warehouse } from '@/types'
import type { WarehouseRepository } from '@/repositories/interfaces'
import { uid } from '@/utils/helpers'
import { assertCanAddWarehouse } from '@/utils/planLimits'
import { db, mutate, withLatency } from './db'

export class MockWarehouseRepository implements WarehouseRepository {
  list() {
    return withLatency(() => db().warehouses)
  }

  getById(id: string) {
    return withLatency(() => db().warehouses.find((item) => item.id === id) ?? null)
  }

  create(input: Omit<Warehouse, 'id'>) {
    return mutate(() => {
      assertCanAddWarehouse(input.companyId)
      const warehouse: Warehouse = { id: uid('wh'), ...input }
      db().warehouses.push(warehouse)
      if (warehouse.companyId) {
        const company = db().companies.find((item) => item.id === warehouse.companyId)
        if (company) company.warehousesCount += 1
      }
      db().products.forEach((product) => {
        db().stock.push({
          id: uid('stk'),
          productId: product.id,
          warehouseId: warehouse.id,
          quantity: 0,
          reserved: 0,
          enabled: true,
        })
      })
      return warehouse
    })
  }

  update(id: string, input: Partial<Warehouse>) {
    return mutate(() => {
      const warehouse = db().warehouses.find((item) => item.id === id)
      if (!warehouse) throw new Error('Entrepôt introuvable')
      Object.assign(warehouse, input)
      return warehouse
    })
  }
}
