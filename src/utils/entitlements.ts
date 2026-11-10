import type { Entitlements, PlanModule, Subscription, SubscriptionPlan, Company } from '@/types'

export function buildEntitlements(input: {
  company?: Company | null
  subscription?: Subscription | null
  plan?: SubscriptionPlan | null
  bypass?: boolean
}): Entitlements {
  if (input.bypass) {
    return {
      companyId: null,
      planId: null,
      planName: 'Plateforme',
      status: 'active',
      modules: ['stock', 'procurement', 'purchasing', 'logistics', 'assistant', 'analytics', 'finance'],
      maxUsers: 0,
      maxWarehouses: 0,
      usersCount: 0,
      warehousesCount: 0,
      seats: 0,
      unlimitedUsers: true,
      unlimitedWarehouses: true,
      canAddUser: true,
      canAddWarehouse: true,
    }
  }
  const company = input.company
  const subscription = input.subscription
  const plan = input.plan
  const status = subscription?.status ?? 'active'
  const blocked = ['canceled', 'paused'].includes(status) || company?.status === 'suspended'
  const maxUsers = plan?.maxUsers ?? 0
  const maxWarehouses = plan?.maxWarehouses ?? 0
  const usersCount = company?.usersCount ?? 0
  const warehousesCount = company?.warehousesCount ?? 0
  const modules = blocked ? [] : ((plan?.modules ?? []) as PlanModule[])
  return {
    companyId: company?.id ?? null,
    planId: plan?.id ?? null,
    planName: plan?.name ?? 'Sans plan',
    status,
    modules,
    maxUsers,
    maxWarehouses,
    usersCount,
    warehousesCount,
    seats: subscription?.seats ?? usersCount,
    unlimitedUsers: maxUsers === 0,
    unlimitedWarehouses: maxWarehouses === 0,
    canAddUser: !blocked && (maxUsers === 0 || usersCount < maxUsers),
    canAddWarehouse: !blocked && (maxWarehouses === 0 || warehousesCount < maxWarehouses),
  }
}

export function moduleForPath(path: string): PlanModule | null {
  if (path.startsWith('/stock')) return 'stock'
  if (path.startsWith('/procurement') || path.startsWith('/purchasing')) return 'procurement'
  if (path.startsWith('/logistics') || path.startsWith('/driver')) return 'logistics'
  if (path.startsWith('/finance')) return 'finance'
  if (path.startsWith('/analytics')) return 'analytics'
  if (path.startsWith('/assistant')) return 'assistant'
  return null
}
