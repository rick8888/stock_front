import { financeRepository } from '@/repositories'

export const financeService = {
  invoices: () => financeRepository.invoices(),
  payments: () => financeRepository.payments(),
  budgets: () => financeRepository.budgets(),
  expenses: () => financeRepository.expenses(),
  payInvoice: (id: string) => financeRepository.payInvoice(id),
}
