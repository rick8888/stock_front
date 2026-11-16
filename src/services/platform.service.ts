import type {
  Company,
  PlatformInvoice,
  Subscription,
  SubscriptionPlan,
} from '@/types'
import { platformRepository } from '@/repositories'
import { countryCurrency, DEFAULT_BILLING_COUNTRY } from '@/config/billingCountries'
import { addMoney, companyCountry, invoiceCurrency, monthlyRecurring, type MoneyTotals } from './platform.pricing'

export * from './platform.pricing'

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
  const countryById = Object.fromEntries(companies.map((company) => [company.id, companyCountry(company)]))
  // Une devise par pays : les montants ne s'additionnent pas entre devises.
  const mrr: MoneyTotals = {}
  for (const item of subscriptions) {
    const plan = planById[item.planId]
    if (!plan || !isBillable(item.status)) continue
    const country = countryById[item.companyId] ?? DEFAULT_BILLING_COUNTRY
    addMoney(mrr, countryCurrency(country), monthlyRecurring(plan, item.interval, country))
  }
  const overdue = invoices.filter((item) => item.status === 'overdue')
  const overdueAmount: MoneyTotals = {}
  for (const item of overdue) addMoney(overdueAmount, invoiceCurrency(item), item.amount)
  return {
    companies: companies.length,
    active: companies.filter((item) => item.status === 'active').length,
    trial: companies.filter((item) => item.status === 'trial').length,
    suspended: companies.filter((item) => item.status === 'suspended').length,
    mrr,
    overdueAmount,
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
    const country = companyCountry(company)
    const unpaid = invoices
      .filter((item) => item.companyId === company.id && (item.status === 'open' || item.status === 'overdue'))
      .reduce((sum, item) => sum + item.amount, 0)
    return {
      company,
      subscription,
      plan,
      country,
      currency: countryCurrency(country),
      mrr:
        plan && subscription && isBillable(subscription.status)
          ? monthlyRecurring(plan, subscription.interval, country)
          : 0,
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
  checkout: (...args: Parameters<typeof platformRepository.checkout>) => platformRepository.checkout(...args),
  portal: (...args: Parameters<typeof platformRepository.portal>) => platformRepository.portal(...args),
}

export function openBillingUrl(url?: string) {
  if (!url) return false
  window.location.assign(url)
  return true
}
