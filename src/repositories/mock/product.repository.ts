import type { Product } from '@/types'
import type { ProductInput, ProductRepository } from '@/repositories/interfaces'
import { uid } from '@/utils/helpers'
import { db, mutate, withLatency } from './db'

export class MockProductRepository implements ProductRepository {
  list() {
    return withLatency(() => db().products.filter((item) => !item.archived))
  }

  getById(id: string) {
    return withLatency(() => db().products.find((item) => item.id === id) ?? null)
  }

  create(input: ProductInput) {
    return mutate(() => {
      const product: Product = { id: uid('prd'), archived: false, ...input }
      db().products.unshift(product)
      db().warehouses.forEach((warehouse) => {
        db().stock.push({
          id: uid('stk'),
          productId: product.id,
          warehouseId: warehouse.id,
          quantity: 0,
          reserved: 0,
          enabled: true,
        })
      })
      return product
    })
  }

  update(id: string, input: Partial<ProductInput>) {
    return mutate(() => {
      const product = db().products.find((item) => item.id === id)
      if (!product) throw new Error('Produit introuvable')
      Object.assign(product, input)
      return product
    })
  }

  archive(id: string) {
    return mutate(() => {
      const product = db().products.find((item) => item.id === id)
      if (!product) throw new Error('Produit introuvable')
      product.archived = true
    })
  }
}
