import { computed } from 'vue'
import { useAsyncList } from '@/composables/useAsyncList'
import { customerRepository } from '@/repositories'
import type { CustomerInput } from '@/repositories/interfaces'

export function useCustomers() {
  const list = useAsyncList(() => customerRepository.list())
  const customers = computed(() => list.data.value)

  async function createCustomer(input: CustomerInput) {
    const created = await customerRepository.create(input)
    await list.refresh()
    return created
  }

  async function updateCustomer(id: string, input: Partial<CustomerInput>) {
    const updated = await customerRepository.update(id, input)
    await list.refresh()
    return updated
  }

  return {
    customers,
    loading: list.loading,
    error: list.error,
    refresh: list.refresh,
    createCustomer,
    updateCustomer,
  }
}
