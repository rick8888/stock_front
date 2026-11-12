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
  const related = alert.relatedId ?? ''
  if (alert.domain === 'stock') {
    if (related.startsWith('rcp') || related.startsWith('rcpt')) {
      return `/procurement?tab=receipts&receipt=${related}`
    }
    const warehouse = alert.warehouseId ? `&warehouse=${alert.warehouseId}` : ''
    if (alert.action === 'replenish' && related && !related.startsWith('stk')) {
      return `/analytics/forecasts?product=${related}${warehouse}&action=da`
    }
    if (related.startsWith('stk') || related.includes(':')) {
      return '/stock'
    }
    return related ? `/stock?article=${related}${warehouse}` : '/stock'
  }
  if (alert.domain === 'procurement') {
    if (related.startsWith('po') || related.startsWith('ord')) {
      const suffix = alert.action === 'receive' ? '&action=receive' : ''
      return `/procurement?tab=orders&order=${related}${suffix}`
    }
    if (related.startsWith('pr') || related.startsWith('da')) {
      return `/procurement?request=${related}`
    }
    return '/procurement'
  }
  if (alert.domain === 'logistics') {
    if (related.startsWith('bl') || related.startsWith('sn')) {
      return `/logistics?tab=notes&note=${related}`
    }
    if (related.startsWith('dlv') || related.startsWith('del')) {
      return `/logistics?tab=deliveries&delivery=${related}`
    }
    if (related.startsWith('rt')) {
      return `/logistics?tab=routes&route=${related}`
    }
    return '/logistics'
  }
  if (alert.domain === 'finance') return '/finance'
  return '/tasks'
}

export function alertActionLabel(alert: Alert): string {
  if (alert.action === 'replenish') return 'Créer la DA'
  if (alert.action === 'receive') return 'Ouvrir le BR'
  if (alert.action === 'stock') return 'Voir le stock'
  if (alert.action === 'dispatch') return 'Voir la livraison'
  return 'Traiter'
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
