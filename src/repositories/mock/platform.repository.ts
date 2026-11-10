import type {
  BillingInterval,
  Company,
  CompanyStatus,
  PlatformInvoice,
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
} from '@/types'
import type { CompanyInput, PlanInput, PlatformRepository } from '@/repositories/interfaces'
import { uid, DEMO_TODAY } from '@/utils/helpers'
import { db, mutate, withLatency } from './db'

function nextInvoiceNumber() {
  const count = db().platformInvoices.length + 1
  return `BS-2026-${String(count).padStart(3, '0')}`
}

function periodEnd(interval: BillingInterval, from = DEMO_TODAY) {
  const date = new Date(`${from}T12:00:00`)
  if (interval === 'yearly') date.setFullYear(date.getFullYear() + 1)
  else date.setMonth(date.getMonth() + 1)
  return date.toISOString().slice(0, 10)
}

function trialEnd(from = DEMO_TODAY) {
  const date = new Date(`${from}T12:00:00`)
  date.setDate(date.getDate() + 14)
  return date.toISOString().slice(0, 10)
}

function addDays(from: string, days: number) {
  const date = new Date(`${from}T12:00:00`)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

export class MockPlatformRepository implements PlatformRepository {
  companies() {
    return withLatency(() => [...db().companies])
  }

  plans() {
    return withLatency(() => [...db().plans])
  }

  subscriptions() {
    return withLatency(() => [...db().subscriptions])
  }

  invoices() {
    return withLatency(() => [...db().platformInvoices])
  }

  createCompany(input: CompanyInput) {
    return mutate(() => {
      const name = input.name.trim()
      if (name.length < 2) throw new Error('Le nom de l’entreprise est requis.')
      const plan = db().plans.find((item) => item.id === input.planId)
      if (!plan || !plan.active) throw new Error('Plan introuvable.')
      const company: Company = {
        id: uid('co'),
        name,
        legalName: input.legalName.trim() || name,
        ice: input.ice.trim(),
        city: input.city.trim(),
        email: input.email.trim().toLowerCase(),
        phone: input.phone.trim(),
        status: 'trial',
        createdAt: DEMO_TODAY,
        usersCount: 1,
        warehousesCount: 1,
      }
      const ends = trialEnd()
      const subscription: Subscription = {
        id: uid('sub'),
        companyId: company.id,
        planId: plan.id,
        status: 'trialing',
        interval: input.interval,
        startedAt: DEMO_TODAY,
        currentPeriodEnd: ends,
        trialEndsAt: ends,
        seats: 1,
      }
      db().companies.unshift(company)
      db().subscriptions.unshift(subscription)
      return company
    })
  }

  updateCompany(id: string, input: Partial<CompanyInput> & { status?: CompanyStatus }) {
    return mutate(() => {
      const company = db().companies.find((item) => item.id === id)
      if (!company) throw new Error('Entreprise introuvable.')
      if (input.name !== undefined) company.name = input.name.trim()
      if (input.legalName !== undefined) company.legalName = input.legalName.trim()
      if (input.ice !== undefined) company.ice = input.ice.trim()
      if (input.city !== undefined) company.city = input.city.trim()
      if (input.email !== undefined) company.email = input.email.trim().toLowerCase()
      if (input.phone !== undefined) company.phone = input.phone.trim()
      if (input.status) {
        company.status = input.status
        const subscription = db().subscriptions.find((item) => item.companyId === id)
        if (subscription) {
          if (input.status === 'suspended') subscription.status = 'paused'
          if (input.status === 'churned') subscription.status = 'canceled'
          if (input.status === 'active' && (subscription.status === 'paused' || subscription.status === 'canceled')) {
            subscription.status = 'active'
          }
          if (input.status === 'trial') subscription.status = 'trialing'
        }
      }
      return company
    })
  }

  createPlan(input: PlanInput) {
    return mutate(() => {
      const name = input.name.trim()
      if (name.length < 2) throw new Error('Le nom du plan est requis.')
      const code = (input.code.trim() || name).toLowerCase().replace(/[^a-z0-9]+/g, '-')
      if (db().plans.some((item) => item.code === code)) throw new Error('Ce code de plan existe déjà.')
      const plan: SubscriptionPlan = {
        id: uid('plan'),
        name,
        code,
        description: input.description.trim(),
        monthlyPrice: Math.max(0, Math.round(input.monthlyPrice)),
        yearlyPrice: Math.max(0, Math.round(input.yearlyPrice)),
        maxUsers: Math.max(0, Math.round(input.maxUsers)),
        maxWarehouses: Math.max(0, Math.round(input.maxWarehouses)),
        modules: [...input.modules],
        active: input.active,
      }
      db().plans.push(plan)
      return plan
    })
  }

  updatePlan(id: string, input: Partial<PlanInput>) {
    return mutate(() => {
      const plan = db().plans.find((item) => item.id === id)
      if (!plan) throw new Error('Plan introuvable.')
      if (input.name !== undefined) plan.name = input.name.trim()
      if (input.description !== undefined) plan.description = input.description.trim()
      if (input.monthlyPrice !== undefined) plan.monthlyPrice = Math.max(0, Math.round(input.monthlyPrice))
      if (input.yearlyPrice !== undefined) plan.yearlyPrice = Math.max(0, Math.round(input.yearlyPrice))
      if (input.maxUsers !== undefined) plan.maxUsers = Math.max(0, Math.round(input.maxUsers))
      if (input.maxWarehouses !== undefined) plan.maxWarehouses = Math.max(0, Math.round(input.maxWarehouses))
      if (input.modules) plan.modules = [...input.modules]
      if (input.active !== undefined) plan.active = input.active
      return plan
    })
  }

  changeSubscription(
    companyId: string,
    input: { planId?: string; interval?: BillingInterval; status?: SubscriptionStatus },
  ) {
    return mutate(() => {
      const subscription = db().subscriptions.find((item) => item.companyId === companyId)
      if (!subscription) throw new Error('Abonnement introuvable.')
      const company = db().companies.find((item) => item.id === companyId)
      if (input.planId) {
        const plan = db().plans.find((item) => item.id === input.planId)
        if (!plan) throw new Error('Plan introuvable.')
        subscription.planId = plan.id
      }
      if (input.interval) {
        subscription.interval = input.interval
        subscription.currentPeriodEnd = periodEnd(input.interval)
      }
      if (input.status) {
        subscription.status = input.status
        if (company) {
          if (input.status === 'paused') company.status = 'suspended'
          if (input.status === 'canceled') company.status = 'churned'
          if (input.status === 'active') company.status = 'active'
          if (input.status === 'trialing') company.status = 'trial'
        }
      }
      if (input.planId || input.interval) {
        const plan = db().plans.find((item) => item.id === subscription.planId)
        if (plan && subscription.status === 'active') {
          const invoice: PlatformInvoice = {
            id: uid('pinv'),
            companyId,
            subscriptionId: subscription.id,
            number: nextInvoiceNumber(),
            amount: subscription.interval === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice,
            status: 'open',
            issuedAt: DEMO_TODAY,
            dueDate: addDays(DEMO_TODAY, 14),
          }
          db().platformInvoices.unshift(invoice)
        }
      }
      return subscription
    })
  }

  payInvoice(id: string) {
    return mutate(() => {
      const invoice = db().platformInvoices.find((item) => item.id === id)
      if (!invoice) throw new Error('Facture introuvable.')
      if (invoice.status === 'paid') throw new Error('Facture déjà payée.')
      if (invoice.status !== 'open' && invoice.status !== 'overdue') throw new Error('Cette facture n’est pas payable.')
      invoice.status = 'paid'
      invoice.paidAt = DEMO_TODAY
      invoice.paymentProvider = 'stub'
      invoice.paymentRef = `STUB-${uid('pay').slice(-10).toUpperCase()}`
      const overdue = db().platformInvoices.some(
        (item) => item.companyId === invoice.companyId && (item.status === 'overdue' || item.status === 'open'),
      )
      const subscription = db().subscriptions.find((item) => item.companyId === invoice.companyId)
      const company = db().companies.find((item) => item.id === invoice.companyId)
      if (!overdue && subscription?.status === 'past_due') {
        subscription.status = 'active'
        if (company && company.status !== 'suspended') company.status = 'active'
      }
      return {
        invoice: { ...invoice },
        payment: {
          provider: 'stub',
          paymentRef: invoice.paymentRef,
          status: 'succeeded',
        },
      }
    })
  }

  checkout(input: { companyId?: string; planId?: string; interval?: BillingInterval; invoiceId?: string } = {}) {
    return Promise.resolve({
      url: `https://checkout.stripe.test/mock?company=${input.companyId ?? ''}&plan=${input.planId ?? ''}`,
      provider: 'stripe',
      sessionId: 'cs_mock',
    })
  }

  portal(input: { companyId?: string } = {}) {
    return Promise.resolve({
      url: `https://billing.stripe.test/mock?company=${input.companyId ?? ''}`,
      provider: 'stripe',
    })
  }
}
