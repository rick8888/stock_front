import { supplierService } from '@/services/supplier.service'
import { useAsyncList } from './useAsyncList'
import type { SupplierInput } from '@/repositories/interfaces'

export function useSuppliers() {
  const { data: suppliers, loading, error, refresh } = useAsyncList(() => supplierService.list())

  async function createSupplier(input: SupplierInput) {
    await supplierService.create(input)
    await refresh(true)
  }

  async function updateSupplier(id: string, input: Partial<SupplierInput>) {
    await supplierService.update(id, input)
    await refresh(true)
  }

  return { suppliers, loading, error, createSupplier, updateSupplier, refresh }
}
