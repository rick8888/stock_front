import type { Budget, Expense, Invoice, Payment } from '@/types'

export const invoices: Invoice[] = [
  {
    id: 'inv-92',
    supplierId: 'sup-abc',
    purchaseOrderId: 'po-1051',
    amount: 428000,
    status: 'paid',
    dueDate: '2026-08-18',
  },
  {
    id: 'inv-91',
    supplierId: 'sup-global',
    purchaseOrderId: 'po-1048',
    amount: 312000,
    status: 'paid',
    dueDate: '2026-08-20',
  },
  {
    id: 'inv-90',
    supplierId: 'sup-atlas',
    purchaseOrderId: 'po-1046',
    amount: 286000,
    status: 'paid',
    dueDate: '2026-08-22',
  },
  {
    id: 'inv-89',
    supplierId: 'sup-maghreb',
    purchaseOrderId: 'po-1044',
    amount: 334000,
    status: 'paid',
    dueDate: '2026-08-24',
  },
  {
    id: 'inv-88',
    supplierId: 'sup-atlas',
    purchaseOrderId: 'po-1042',
    amount: 486000,
    status: 'overdue',
    dueDate: '2026-08-25',
  },
  {
    id: 'inv-87',
    supplierId: 'sup-nord',
    purchaseOrderId: 'po-1038',
    amount: 214000,
    status: 'pending',
    dueDate: '2026-08-30',
  },
  {
    id: 'inv-86',
    supplierId: 'sup-abc',
    purchaseOrderId: 'po-1041',
    amount: 248000,
    status: 'pending',
    dueDate: '2026-09-05',
  },
  {
    id: 'inv-85',
    supplierId: 'sup-global',
    purchaseOrderId: 'po-1039',
    amount: 172000,
    status: 'pending',
    dueDate: '2026-09-08',
  },
]

export const payments: Payment[] = [
  { id: 'pay-25', invoiceId: 'inv-92', amount: 428000, date: '2026-08-18T10:00:00.000Z' },
  { id: 'pay-24', invoiceId: 'inv-91', amount: 312000, date: '2026-08-20T11:20:00.000Z' },
  { id: 'pay-23', invoiceId: 'inv-90', amount: 286000, date: '2026-08-22T09:40:00.000Z' },
  { id: 'pay-22', invoiceId: 'inv-89', amount: 334000, date: '2026-08-24T10:00:00.000Z' },
]

export const budgets: Budget[] = [
  { id: 'bdg-achats', name: 'Achats août', period: '2026-08', allocated: 3200000, spent: 1480000 },
  { id: 'bdg-log', name: 'Logistique août', period: '2026-08', allocated: 1200000, spent: 620000 },
  { id: 'bdg-tr', name: 'Transport août', period: '2026-08', allocated: 800000, spent: 280000 },
  { id: 'bdg-flotte', name: 'Flotte août', period: '2026-08', allocated: 520000, spent: 100000 },
]

export const expenses: Expense[] = [
  { id: 'exp-01', label: 'Commandes fournisseurs', amount: 1480000, date: '2026-08-20', category: 'Achats' },
  { id: 'exp-02', label: 'Gasoil et tournées', amount: 620000, date: '2026-08-26', category: 'Logistique' },
  { id: 'exp-03', label: 'Transport inter-dépôts', amount: 280000, date: '2026-08-22', category: 'Transport' },
  { id: 'exp-04', label: 'Maintenance flotte', amount: 100000, date: '2026-08-21', category: 'Autres' },
]
