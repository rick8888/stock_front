import { db } from '@/repositories/mock/db'

export function assertCanAddUser(companyId?: string) {
  if (!companyId) return
  const company = db().companies.find((item) => item.id === companyId)
  const subscription = db().subscriptions.find((item) => item.companyId === companyId)
  const plan = db().plans.find((item) => item.id === subscription?.planId)
  if (!company || !plan) return
  if (['canceled', 'paused'].includes(subscription?.status ?? '') || company.status === 'suspended') {
    throw new Error('Ajout d’utilisateur impossible avec cet abonnement.')
  }
  if (plan.maxUsers > 0 && company.usersCount >= plan.maxUsers) {
    throw new Error(`Limite du plan atteinte (${company.usersCount}/${plan.maxUsers} utilisateurs).`)
  }
}

export function assertCanAddWarehouse(companyId?: string) {
  if (!companyId) return
  const company = db().companies.find((item) => item.id === companyId)
  const subscription = db().subscriptions.find((item) => item.companyId === companyId)
  const plan = db().plans.find((item) => item.id === subscription?.planId)
  if (!company || !plan) return
  if (['canceled', 'paused'].includes(subscription?.status ?? '') || company.status === 'suspended') {
    throw new Error('Ajout d’entrepôt impossible avec cet abonnement.')
  }
  if (plan.maxWarehouses > 0 && company.warehousesCount >= plan.maxWarehouses) {
    throw new Error(`Limite du plan atteinte (${company.warehousesCount}/${plan.maxWarehouses} entrepôts).`)
  }
}
