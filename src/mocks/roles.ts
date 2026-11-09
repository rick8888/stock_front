import type { PermissionKey, Role, RoleKey } from '@/types'
import { ALL_PERMISSIONS } from './permissions'

const viewOnly = ALL_PERMISSIONS.filter(
  (key) =>
    !key.startsWith('platform.') &&
    !key.startsWith('account.') &&
    (key.endsWith('.view') || key === 'assistant.use'),
)

function of(...keys: PermissionKey[]): PermissionKey[] {
  return keys
}

export const ROLE_PERMISSIONS: Record<RoleKey, PermissionKey[]> = {
  SUPER_ADMIN: of('platform.view', 'platform.companies', 'platform.plans', 'platform.billing'),
  TENANT_OWNER: of('account.view', 'account.company', 'account.admins', 'account.billing'),
  ADMIN: ALL_PERMISSIONS.filter(
    (key) => key !== 'finance.payment' && !key.startsWith('platform.') && !key.startsWith('account.'),
  ),
  MANAGER: of(
    'product.view',
    'warehouse.view',
    'stock.view',
    'stock.inventory',
    'procurement.view',
    'procurement.create',
    'procurement.approve',
    'purchase.view',
    'purchase.create',
    'delivery.view',
    'analytics.view',
    'task.view',
    'task.create',
    'task.update',
    'assistant.use',
    'finance.view',
  ),
  WAREHOUSE_MANAGER: of(
    'product.view',
    'warehouse.view',
    'stock.view',
    'stock.receive',
    'stock.issue',
    'stock.transfer',
    'stock.adjust',
    'stock.inventory',
    'procurement.view',
    'procurement.create',
    'purchase.view',
    'delivery.view',
    'delivery.prepare',
    'task.view',
    'task.create',
    'task.update',
    'assistant.use',
  ),
  PROCUREMENT: of(
    'product.view',
    'product.create',
    'product.update',
    'stock.view',
    'warehouse.view',
    'procurement.view',
    'procurement.create',
    'purchase.view',
    'purchase.create',
    'purchase.update',
    'task.view',
    'task.create',
    'task.update',
    'assistant.use',
  ),
  FINANCE: of(
    'purchase.view',
    'procurement.view',
    'finance.view',
    'finance.invoice',
    'finance.payment',
    'finance.budget',
    'analytics.view',
    'task.view',
    'task.create',
    'assistant.use',
  ),
  DISPATCHER: of(
    'delivery.view',
    'delivery.create',
    'delivery.update',
    'stock.view',
    'warehouse.view',
    'task.view',
    'task.create',
    'task.update',
    'assistant.use',
  ),
  DRIVER: of('delivery.view', 'delivery.confirm', 'task.view', 'assistant.use'),
  AUDITOR: viewOnly,
}

export const roles: Role[] = [
  {
    id: 'role-super',
    key: 'SUPER_ADMIN',
    name: 'Super administrateur',
    description: 'Propriétaire Bravo.Stock : entreprises, plans, abonnements, facturation.',
    permissions: ROLE_PERMISSIONS.SUPER_ADMIN,
  },
  {
    id: 'role-owner',
    key: 'TENANT_OWNER',
    name: 'Propriétaire',
    description: 'Compte entreprise : administrateurs, abonnement, factures Bravo.Stock.',
    permissions: ROLE_PERMISSIONS.TENANT_OWNER,
  },
  {
    id: 'role-admin',
    key: 'ADMIN',
    name: 'Administrateur',
    description: 'Configuration opérationnelle : utilisateurs, entrepôts, catalogue.',
    permissions: ROLE_PERMISSIONS.ADMIN,
  },
  {
    id: 'role-manager',
    key: 'MANAGER',
    name: 'Manager',
    description: 'Priorités, alertes, décisions opérationnelles.',
    permissions: ROLE_PERMISSIONS.MANAGER,
  },
  {
    id: 'role-wh',
    key: 'WAREHOUSE_MANAGER',
    name: 'Gestionnaire d’entrepôt',
    description: 'Stock, réceptions, mouvements, bons de livraison.',
    permissions: ROLE_PERMISSIONS.WAREHOUSE_MANAGER,
  },
  {
    id: 'role-proc',
    key: 'PROCUREMENT',
    name: 'Approvisionnement',
    description: 'Besoins, fournisseurs, commandes, délais.',
    permissions: ROLE_PERMISSIONS.PROCUREMENT,
  },
  {
    id: 'role-fin',
    key: 'FINANCE',
    name: 'Finance',
    description: 'Achats, factures, budgets, paiements.',
    permissions: ROLE_PERMISSIONS.FINANCE,
  },
  {
    id: 'role-disp',
    key: 'DISPATCHER',
    name: 'Dispatcher',
    description: 'Tournées, bons à affecter, véhicules, chauffeurs.',
    permissions: ROLE_PERMISSIONS.DISPATCHER,
  },
  {
    id: 'role-drv',
    key: 'DRIVER',
    name: 'Chauffeur',
    description: 'Tournée du jour et confirmations de livraison.',
    permissions: ROLE_PERMISSIONS.DRIVER,
  },
  {
    id: 'role-aud',
    key: 'AUDITOR',
    name: 'Auditeur',
    description: 'Consultation sans modification.',
    permissions: ROLE_PERMISSIONS.AUDITOR,
  },
]
