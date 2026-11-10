import type { MockDatabase } from '@/types'
import { users } from './users'
import { roles } from './roles'
import { permissions } from './permissions'
import { products } from './products'
import { categories } from './categories'
import { warehouses } from './warehouses'
import { stock } from './stock'
import { stockMovements } from './stockMovements'
import { suppliers } from './suppliers'
import { procurementRequests } from './procurementRequests'
import { consultations } from './consultations'
import { purchaseOrders } from './purchaseOrders'
import { receipts } from './receipts'
import { shipments } from './shipments'
import { deliveries } from './deliveries'
import { routes } from './routes'
import { vehicles } from './vehicles'
import { drivers } from './drivers'
import { shippingNotes } from './shippingNotes'
import { customers } from './customers'
import { stockLots } from './stockLots'
import { warehouseLocations } from './warehouseLocations'
import { stockPlacements } from './stockPlacements'
import { tasks } from './tasks'
import { alerts } from './alerts'
import { planning } from './planning'
import { invoices, payments, budgets, expenses } from './finance'
import { inventories, notifications } from './assistant'
import { companies, plans, subscriptions, platformInvoices } from './platform'

export function createSeed(): MockDatabase {
  return structuredClone({
    users,
    roles,
    permissions,
    categories,
    products,
    warehouses,
    stock,
    stockMovements,
    inventories,
    suppliers,
    procurementRequests,
    consultations,
    purchaseOrders,
    receipts,
    shipments,
    deliveries,
    routes,
    vehicles,
    drivers,
    shippingNotes,
    customers,
    stockLots,
    tasks,
    alerts,
    warehouseLocations,
    stockPlacements,
    planning,
    invoices,
    payments,
    budgets,
    expenses,
    notifications,
    auditLogs: [
      {
        id: 'aud-01',
        userId: 'usr-warehouse',
        action: 'Réception validée',
        entity: 'receipt',
        entityId: 'rcp-12',
        createdAt: '2026-08-23T14:00:00.000Z',
      },
      {
        id: 'aud-02',
        userId: 'usr-procurement',
        action: 'Commande envoyée',
        entity: 'purchase',
        entityId: 'po-1040',
        createdAt: '2026-08-25T12:00:00.000Z',
      },
    ],
    companies,
    plans,
    subscriptions,
    platformInvoices,
  })
}
