import type {
  Company,
  PlatformInvoice,
  Subscription,
  SubscriptionPlan,
} from '@/types'
import { platformRepository } from '@/repositories'

export function monthlyRecurring(plan: SubscriptionPlan, interval: Subscription['interval']) {
  return interval === 'yearly' ? Math.round(plan.yearlyPrice / 12) : plan.monthlyPrice
}

export function isBillable(status: Subscription['status']) {
  return status === 'active' || status === 'past_due'
}

export function buildPlatformSnapshot(
  companies: Company[],
  plans: SubscriptionPlan[],
  subscriptions: Subscription[],
  invoices: PlatformInvoice[],
) {
  const planById = Object.fromEntries(plans.map((plan) => [plan.id, plan]))
  const mrr = subscriptions.reduce((sum, item) => {
    if (!isBillable(item.status)) return sum
    const plan = planById[item.planId]
    return sum + (plan ? monthlyRecurring(plan, item.interval) : 0)
  }, 0)
  const overdue = invoices.filter((item) => item.status === 'overdue')
  return {
    companies: companies.length,
    active: companies.filter((item) => item.status === 'active').length,
    trial: companies.filter((item) => item.status === 'trial').length,
    suspended: companies.filter((item) => item.status === 'suspended').length,
    mrr,
    overdueAmount: overdue.reduce((sum, item) => sum + item.amount, 0),
    overdueCount: overdue.length,
  }
}

export function companyRows(
  companies: Company[],
  plans: SubscriptionPlan[],
  subscriptions: Subscription[],
  invoices: PlatformInvoice[],
) {
  const planById = Object.fromEntries(plans.map((plan) => [plan.id, plan]))
  return companies.map((company) => {
    const subscription = subscriptions.find((item) => item.companyId === company.id)
    const plan = subscription ? planById[subscription.planId] : undefined
    const unpaid = invoices
      .filter((item) => item.companyId === company.id && (item.status === 'open' || item.status === 'overdue'))
      .reduce((sum, item) => sum + item.amount, 0)
    return {
      company,
      subscription,
      plan,
      mrr: plan && subscription && isBillable(subscription.status) ? monthlyRecurring(plan, subscription.interval) : 0,
      unpaid,
    }
  })
}

export const platformService = {
  companies: () => platformRepository.companies(),
  plans: () => platformRepository.plans(),
  subscriptions: () => platformRepository.subscriptions(),
  invoices: () => platformRepository.invoices(),
  createCompany: (input: Parameters<typeof platformRepository.createCompany>[0]) =>
    platformRepository.createCompany(input),
  updateCompany: (...args: Parameters<typeof platformRepository.updateCompany>) =>
    platformRepository.updateCompany(...args),
  createPlan: (input: Parameters<typeof platformRepository.createPlan>[0]) => platformRepository.createPlan(input),
  updatePlan: (...args: Parameters<typeof platformRepository.updatePlan>) => platformRepository.updatePlan(...args),
  changeSubscription: (...args: Parameters<typeof platformRepository.changeSubscription>) =>
    platformRepository.changeSubscription(...args),
  payInvoice: (id: string) => platformRepository.payInvoice(id),
}
