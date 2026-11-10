import type { Customer } from '@/types'
import type { CustomerInput, CustomerRepository } from '@/repositories/interfaces'
import { uid } from '@/utils/helpers'
import { db, mutate, withLatency } from './db'

export class MockCustomerRepository implements CustomerRepository {
  list() {
    return withLatency(() => db().customers.filter((item) => item.active !== false))
  }

  getById(id: string) {
    return withLatency(() => db().customers.find((item) => item.id === id) ?? null)
  }

  create(input: CustomerInput) {
    return mutate(() => {
      const customer: Customer = {
        id: uid('cus'),
        name: input.name.trim(),
        phone: input.phone,
        email: input.email,
        ice: input.ice,
        notes: input.notes,
        active: input.active ?? true,
        addresses: input.addresses.map((row, index) => ({
          id: row.id ?? uid('adr'),
          label: row.label,
          address: row.address,
          city: row.city,
          isDefault: row.isDefault ?? index === 0,
        })),
      }
      db().customers.unshift(customer)
      return customer
    })
  }

  update(id: string, input: Partial<CustomerInput>) {
    return mutate(() => {
      const customer = db().customers.find((item) => item.id === id)
      if (!customer) throw new Error('Client introuvable')
      if (input.name) customer.name = input.name.trim()
      if (input.phone !== undefined) customer.phone = input.phone
      if (input.email !== undefined) customer.email = input.email
      if (input.ice !== undefined) customer.ice = input.ice
      if (input.notes !== undefined) customer.notes = input.notes
      if (input.active !== undefined) customer.active = input.active
      if (input.addresses) {
        customer.addresses = input.addresses.map((row, index) => ({
          id: row.id ?? uid('adr'),
          label: row.label,
          address: row.address,
          city: row.city,
          isDefault: row.isDefault ?? index === 0,
        }))
      }
      return customer
    })
  }
}
