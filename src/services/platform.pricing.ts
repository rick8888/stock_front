/**
 * Tarifs par pays — sans dépendance aux repositories (utilisable par le mock comme par les pages).
 */
import type { Company, PlatformInvoice, Subscription, SubscriptionPlan } from '@/types'
import {
  countryCurrency,
  DEFAULT_BILLING_COUNTRY,
  type BillingCountry,
  type BillingCurrency,
} from '@/config/billingCountries'

export type MoneyTotals = Partial<Record<BillingCurrency, number>>

/** Tarif d'un plan dans un pays, ou null s'il n'y est pas proposé. */
export function planPrice(plan: SubscriptionPlan, country: BillingCountry = DEFAULT_BILLING_COUNTRY) {
  const row = plan.prices?.[country]
  if (row) return { monthly: row.monthly, yearly: row.yearly, currency: countryCurrency(country) }
  // Plans antérieurs aux tarifs par pays : prix historiques en MAD.
  if (country === DEFAULT_BILLING_COUNTRY && !plan.prices) {
    return { monthly: plan.monthlyPrice, yearly: plan.yearlyPrice, currency: countryCurrency(country) }
  }
  return null
}

export function plansForCountry(plans: SubscriptionPlan[], country: BillingCountry) {
  return plans.filter((plan) => planPrice(plan, country) !== null)
}

export function companyCountry(company?: Company | null): BillingCountry {
  return company?.country ?? DEFAULT_BILLING_COUNTRY
}

export function invoiceCurrency(invoice: PlatformInvoice): BillingCurrency {
  return invoice.currency ?? 'MAD'
}

export function monthlyRecurring(
  plan: SubscriptionPlan,
  interval: Subscription['interval'],
  country: BillingCountry = DEFAULT_BILLING_COUNTRY,
) {
  const price = planPrice(plan, country)
  if (!price) return 0
  return interval === 'yearly' ? Math.round(price.yearly / 12) : price.monthly
}

export function addMoney(totals: MoneyTotals, currency: BillingCurrency, value: number) {
  totals[currency] = (totals[currency] ?? 0) + value
}
