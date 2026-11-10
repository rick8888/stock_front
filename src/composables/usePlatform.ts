import { computed } from 'vue'
import { platformService, buildPlatformSnapshot, companyRows } from '@/services/platform.service'
import { adminService } from '@/services/task.service'
import { useAsyncList } from './useAsyncList'
import type { CompanyInput, PlanInput } from '@/repositories/interfaces'
import type { BillingInterval, CompanyStatus, SubscriptionStatus } from '@/types'

export function usePlatform() {
  const companies = useAsyncList(() => platformService.companies())
  const plans = useAsyncList(() => platformService.plans())
  const subscriptions = useAsyncList(() => platformService.subscriptions())
  const invoices = useAsyncList(() => platformService.invoices())
  const users = useAsyncList(() => adminService.users())

  const snapshot = computed(() =>
    buildPlatformSnapshot(companies.data.value, plans.data.value, subscriptions.data.value, invoices.data.value),
  )

  const rows = computed(() =>
    companyRows(companies.data.value, plans.data.value, subscriptions.data.value, invoices.data.value),
  )

  async function refreshAll(silent = true) {
    await Promise.all([
      companies.refresh(silent),
      plans.refresh(silent),
      subscriptions.refresh(silent),
      invoices.refresh(silent),
      users.refresh(silent),
    ])
  }

  async function createCompany(input: CompanyInput) {
    await platformService.createCompany(input)
    await refreshAll()
  }

  async function updateCompany(id: string, input: Parameters<typeof platformService.updateCompany>[1]) {
    await platformService.updateCompany(id, input)
    await refreshAll()
  }

  async function setCompanyStatus(id: string, status: CompanyStatus) {
    await platformService.updateCompany(id, { status })
    await refreshAll()
  }

  async function createPlan(input: PlanInput) {
    await platformService.createPlan(input)
    await refreshAll()
  }

  async function updatePlan(id: string, input: Partial<PlanInput>) {
    await platformService.updatePlan(id, input)
    await refreshAll()
  }

  async function changeSubscription(
    companyId: string,
    input: { planId?: string; interval?: BillingInterval; status?: SubscriptionStatus },
  ) {
    await platformService.changeSubscription(companyId, input)
    await refreshAll()
  }

  async function payInvoice(id: string) {
    const result = await platformService.payInvoice(id)
    if (result?.url) {
      window.location.assign(result.url)
      return
    }
    await refreshAll()
  }

  return {
    companies: companies.data,
    plans: plans.data,
    subscriptions: subscriptions.data,
    invoices: invoices.data,
    users: users.data,
    snapshot,
    rows,
    loading: companies.loading,
    error: companies.error,
    createCompany,
    updateCompany,
    setCompanyStatus,
    createPlan,
    updatePlan,
    changeSubscription,
    payInvoice,
    refresh: refreshAll,
  }
}
