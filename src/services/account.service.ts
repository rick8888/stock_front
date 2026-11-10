import { platformRepository, userRepository } from '@/repositories'
import type { CompanyInput } from '@/repositories/interfaces'
import type { BillingInterval, SubscriptionStatus } from '@/types'

function missing() {
  return new Error('Entreprise introuvable.')
}

export const accountService = {
  async company(companyId: string) {
    const company = (await platformRepository.companies()).find((item) => item.id === companyId)
    if (!company) throw missing()
    return company
  },

  async plans() {
    return (await platformRepository.plans()).filter((plan) => plan.active)
  },

  async subscription(companyId: string) {
    return (await platformRepository.subscriptions()).find((item) => item.companyId === companyId) ?? null
  },

  async invoices(companyId: string) {
    return (await platformRepository.invoices()).filter((item) => item.companyId === companyId)
  },

  async admins(companyId: string) {
    return (await userRepository.list()).filter(
      (user) => user.companyId === companyId && user.role === 'ADMIN',
    )
  },

  async updateCompany(companyId: string, input: Partial<Omit<CompanyInput, 'planId' | 'interval'>>) {
    const company = await this.company(companyId)
    return platformRepository.updateCompany(company.id, input)
  },

  async changeSubscription(
    companyId: string,
    input: { planId?: string; interval?: BillingInterval; status?: SubscriptionStatus },
  ) {
    const subscription = await this.subscription(companyId)
    if (!subscription) throw new Error('Abonnement introuvable.')
    return platformRepository.changeSubscription(companyId, input)
  },

  async payInvoice(companyId: string, invoiceId: string) {
    const invoice = (await this.invoices(companyId)).find((item) => item.id === invoiceId)
    if (!invoice) throw new Error('Facture introuvable.')
    return platformRepository.payInvoice(invoiceId)
  },

  checkout(input: { companyId?: string; planId?: string; interval?: BillingInterval; invoiceId?: string } = {}) {
    return platformRepository.checkout(input)
  },

  portal(input: { companyId?: string } = {}) {
    return platformRepository.portal(input)
  },
}
