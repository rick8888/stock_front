import type { Supplier } from '@/types'
import type { SupplierInput } from '@/repositories/interfaces'
import { supplierRepository } from '@/repositories'

export const supplierService = {
  list: () => supplierRepository.list(),
  getById: (id: string) => supplierRepository.getById(id),
  create: (input: SupplierInput) => supplierRepository.create(input),
  update: (id: string, input: Partial<SupplierInput>) => supplierRepository.update(id, input),
  async findByName(name: string): Promise<Supplier | undefined> {
    const list = await supplierRepository.list()
    const q = name.toLowerCase()
    return list.find((item) => item.name.toLowerCase().includes(q))
  },
}
