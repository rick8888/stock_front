import { computed } from 'vue'
import { useAsyncList } from './useAsyncList'
import { useCurrentUser } from './useAuth'
import { accountService } from '@/services/account.service'
import { adminService } from '@/services/task.service'
import { monthlyRecurring, isBillable } from '@/services/platform.service'
import { analyticsService } from '@/services/analytics.service'
import { stockService } from '@/services/stock.service'
import { purchaseService } from '@/services/purchase.service'
import { deliveryService } from '@/services/delivery.service'
import { supplierService } from '@/services/supplier.service'
import type { CompanyInput, UserInput } from '@/repositories/interfaces'
import type { BillingInterval, SubscriptionStatus } from '@/types'

export function useAccount() {
  const { currentUser } = useCurrentUser()
  const companyId = computed(() => currentUser.value?.companyId ?? '')

  const companies = useAsyncList(async () => {
    if (!companyId.value) return []
    return [await accountService.company(companyId.value)]
  })
  const plans = useAsyncList(() => accountService.plans())
  const subscriptions = useAsyncList(async () => {
    if (!companyId.value) return []
    const item = await accountService.subscription(companyId.value)
    return item ? [item] : []
  })
  const invoices = useAsyncList(async () => {
    if (!companyId.value) return []
    return accountService.invoices(companyId.value)
  })
  const admins = useAsyncList(async () => {
    if (!companyId.value) return []
    return accountService.admins(companyId.value)
  })
  const health = useAsyncList(async () => [await analyticsService.snapshot()])
  const detail = useAsyncList(async () => {
    const [risks, delayed, atRisk, suppliers] = await Promise.all([
      stockService.risks(),
      purchaseService.delayed(),
      deliveryService.atRisk(),
      supplierService.list(),
    ])
    return [
      {
        risks: risks.slice(0, 8),
        delayed,
        atRisk,
        suppliers,
      },
    ]
  })

  const company = computed(() => companies.data.value[0] ?? null)
  const subscription = computed(() => subscriptions.data.value[0] ?? null)
  const plan = computed(() => plans.data.value.find((item) => item.id === subscription.value?.planId))
  const mrr = computed(() => {
    if (!plan.value || !subscription.value || !isBillable(subscription.value.status)) return 0
    return monthlyRecurring(plan.value, subscription.value.interval)
  })
  const unpaid = computed(() =>
    invoices.data.value
      .filter((item) => item.status === 'open' || item.status === 'overdue')
      .reduce((sum, item) => sum + item.amount, 0),
  )
  const ops = computed(() => health.data.value[0] ?? null)
  const opsDetail = computed(() => detail.data.value[0] ?? null)

  async function refreshAll(silent = true) {
    await Promise.all([
      companies.refresh(silent),
      plans.refresh(silent),
      subscriptions.refresh(silent),
      invoices.refresh(silent),
      admins.refresh(silent),
      health.refresh(silent),
      detail.refresh(silent),
    ])
  }

  async function updateCompany(input: Partial<Omit<CompanyInput, 'planId' | 'interval'>>) {
    if (!companyId.value) throw new Error('Compte sans entreprise.')
    await accountService.updateCompany(companyId.value, input)
    await refreshAll()
  }

  async function changeSubscription(input: {
    planId?: string
    interval?: BillingInterval
    status?: SubscriptionStatus
  }) {
    if (!companyId.value) throw new Error('Compte sans entreprise.')
    await accountService.changeSubscription(companyId.value, input)
    await refreshAll()
  }

  async function payInvoice(id: string) {
    if (!companyId.value) throw new Error('Compte sans entreprise.')
    const result = await accountService.payInvoice(companyId.value, id)
    if (result?.url) {
      window.location.assign(result.url)
      return
    }
    await refreshAll()
  }

  async function startCheckout(input: { planId?: string; interval?: BillingInterval } = {}) {
    if (!companyId.value) throw new Error('Compte sans entreprise.')
    const session = await accountService.checkout({
      companyId: companyId.value,
      planId: input.planId,
      interval: input.interval,
    })
    if (session.url) window.location.assign(session.url)
  }

  async function openPortal() {
    if (!companyId.value) throw new Error('Compte sans entreprise.')
    const session = await accountService.portal({ companyId: companyId.value })
    if (session.url) window.location.assign(session.url)
  }

  async function createAdmin(input: UserInput) {
    await adminService.createUser({
      ...input,
      role: 'ADMIN',
      createdByUserId: currentUser.value?.id,
    })
    await refreshAll()
  }

  async function updateAdmin(id: string, input: Partial<UserInput>) {
    await adminService.updateUser(id, {
      ...input,
      role: 'ADMIN',
      createdByUserId: currentUser.value?.id,
    })
    await refreshAll()
  }

  return {
    company,
    plan,
    plans: plans.data,
    subscription,
    invoices: invoices.data,
    admins: admins.data,
    mrr,
    unpaid,
    ops,
    opsDetail,
    loading: companies.loading,
    error: companies.error,
    updateCompany,
    changeSubscription,
    payInvoice,
    startCheckout,
    openPortal,
    createAdmin,
    updateAdmin,
    refresh: refreshAll,
  }
}
