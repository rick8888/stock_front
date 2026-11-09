import type { Supplier } from '@/types'
import type { SupplierInput, SupplierRepository } from '@/repositories/interfaces'
import { uid } from '@/utils/helpers'
import { db, mutate, withLatency } from './db'

export class MockSupplierRepository implements SupplierRepository {
  list() {
    return withLatency(() => db().suppliers)
  }

  getById(id: string) {
    return withLatency(() => db().suppliers.find((item) => item.id === id) ?? null)
  }

  create(input: SupplierInput) {
    return mutate(() => {
      const supplier: Supplier = {
        id: uid('sup'),
        reliability: 80,
        status: 'active',
        ...input,
      }
      db().suppliers.unshift(supplier)
      return supplier
    })
  }

  update(id: string, input: Partial<SupplierInput>) {
    return mutate(() => {
      const supplier = db().suppliers.find((item) => item.id === id)
      if (!supplier) throw new Error('Fournisseur introuvable')
      Object.assign(supplier, input)
      return supplier
    })
  }
}
