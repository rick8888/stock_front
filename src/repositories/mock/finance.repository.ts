import type { FinanceRepository } from '@/repositories/interfaces'
import { uid } from '@/utils/helpers'
import { db, mutate, withLatency } from './db'

export class MockFinanceRepository implements FinanceRepository {
  invoices() {
    return withLatency(() => db().invoices)
  }

  payments() {
    return withLatency(() => db().payments)
  }

  budgets() {
    return withLatency(() => db().budgets)
  }

  expenses() {
    return withLatency(() => db().expenses)
  }

  payInvoice(id: string) {
    return mutate(() => {
      const invoice = db().invoices.find((item) => item.id === id)
      if (!invoice) throw new Error('Facture introuvable')
      invoice.status = 'paid'
      db().payments.unshift({
        id: uid('pay'),
        invoiceId: id,
        amount: invoice.amount,
        date: new Date().toISOString(),
      })
    })
  }
}
