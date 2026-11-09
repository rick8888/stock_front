import { ROLE_PERMISSIONS } from '@/mocks/roles'
import type { Alert, PermissionKey, RoleKey, User } from '@/types'

const DOMAIN_PERMISSION: Record<Alert['domain'], PermissionKey[]> = {
  stock: ['stock.view'],
  procurement: ['procurement.view', 'purchase.view'],
  logistics: ['delivery.view'],
  finance: ['finance.view'],
  task: ['task.view'],
}

const OVERSIGHT: RoleKey[] = ['SUPER_ADMIN', 'ADMIN', 'AUDITOR']

export function alertVisibleTo(alert: Alert, user: User): boolean {
  const permissions = ROLE_PERMISSIONS[user.role]
  const needed = DOMAIN_PERMISSION[alert.domain]
  if (!needed.some((key) => permissions.includes(key))) return false

  if (alert.warehouseId && user.warehouseIds.length && !user.warehouseIds.includes(alert.warehouseId)) {
    return false
  }

  if (user.role === 'DRIVER') {
    if (alert.userId) return alert.userId === user.id
    return alert.roles?.includes('DRIVER') ?? false
  }

  if (OVERSIGHT.includes(user.role)) return true
  if (alert.userId === user.id) return true
  if (alert.roles?.length) return alert.roles.includes(user.role)
  return true
}

export function alertHref(alert: Alert, role: RoleKey): string {
  if (role === 'DRIVER') return '/driver/today'
  if (alert.domain === 'stock') {
    if (alert.relatedId?.startsWith('rcp')) return '/procurement?tab=receipts'
    return '/stock'
  }
  if (alert.domain === 'procurement') {
    if (alert.relatedId?.startsWith('po')) return '/procurement?tab=orders'
    return '/procurement'
  }
  if (alert.domain === 'logistics') {
    if (alert.relatedId?.startsWith('bl')) return '/logistics?tab=notes'
    return '/logistics'
  }
  if (alert.domain === 'finance') return '/finance'
  return '/tasks'
}

export function alertsDescription(role?: RoleKey): string {
  if (role === 'WAREHOUSE_MANAGER') return 'Stock, réceptions et sorties de vos entrepôts.'
  if (role === 'PROCUREMENT') return 'Ruptures, commandes et demandes à traiter.'
  if (role === 'FINANCE') return 'Budgets, factures et engagements d’achat.'
  if (role === 'DISPATCHER') return 'Tournées, bons à affecter, retards et incidents.'
  if (role === 'DRIVER') return 'Vos livraisons et messages de tournée.'
  if (role === 'MANAGER') return 'Priorités ops — stock, achats, livraisons.'
  if (role === 'ADMIN' || role === 'SUPER_ADMIN') return 'Tous les signaux de la plateforme.'
  if (role === 'AUDITOR') return 'Signaux consultables, sans action.'
  return 'Ce qui peut encore changer le cours de la journée.'
}
