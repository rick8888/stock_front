import { computed } from 'vue'
import { taskService, alertService, planningService } from '@/services/task.service'
import { financeService } from '@/services/finance.service'
import { analyticsService } from '@/services/analytics.service'
import { receiptService } from '@/services/receipt.service'
import { adminService } from '@/services/task.service'
import { useAsyncList } from './useAsyncList'
import { useCurrentUser } from './useAuth'
import { usePermissions } from './usePermissions'
import type { TaskPriority } from '@/types'
import type { UserInput } from '@/repositories/interfaces'

export function useTasks() {
  const { currentUser } = useCurrentUser()
  const list = useAsyncList(() => taskService.list())
  const mine = computed(() => list.data.value.filter((item) => item.assigneeId === currentUser.value?.id))

  async function createTask(title: string, dueAt: string, priority: TaskPriority = 'medium', description = '') {
    if (!currentUser.value) throw new Error('Non connecté')
    await taskService.create({
      title,
      description,
      assigneeId: currentUser.value.id,
      dueAt,
      status: 'todo',
      priority,
    })
    await list.refresh(true)
  }

  async function completeTask(id: string) {
    await taskService.update(id, { status: 'done' })
    await list.refresh(true)
  }

  return {
    tasks: list.data,
    mine,
    loading: list.loading,
    error: list.error,
    createTask,
    completeTask,
    refresh: list.refresh,
  }
}

export function useAlerts() {
  const { currentUser } = useCurrentUser()
  const list = useAsyncList(() => alertService.list(currentUser.value))
  async function markRead(id: string) {
    await alertService.markRead(id)
    await list.refresh(true)
  }
  return { alerts: list.data, loading: list.loading, error: list.error, markRead, refresh: list.refresh }
}

export function usePlanning() {
  const list = useAsyncList(() => planningService.list())
  return { events: list.data, loading: list.loading, error: list.error, refresh: list.refresh }
}

export function useFinance() {
  const invoices = useAsyncList(() => financeService.invoices())
  const payments = useAsyncList(() => financeService.payments())
  const budgets = useAsyncList(() => financeService.budgets())
  const expenses = useAsyncList(() => financeService.expenses())
  const receipts = useAsyncList(() => receiptService.list())
  async function payInvoice(id: string) {
    const invoice = invoices.data.value.find((item) => item.id === id)
    const receipt = invoice
      ? receipts.data.value.find((item) => item.purchaseOrderId === invoice.purchaseOrderId)
      : undefined
    if (receipt && receipt.status !== 'validated') {
      throw new Error('Réceptionnez d’abord la commande avant de payer.')
    }
    if (!receipt) {
      throw new Error('Aucune réception liée à cette facture.')
    }
    await financeService.payInvoice(id)
    await invoices.refresh(true)
    await payments.refresh(true)
  }
  return {
    invoices: invoices.data,
    payments: payments.data,
    budgets: budgets.data,
    expenses: expenses.data,
    receipts: receipts.data,
    loading: invoices.loading,
    error: invoices.error,
    payInvoice,
    refresh: invoices.refresh,
  }
}

export function useAnalytics() {
  const { scopedWarehouseIds } = usePermissions()
  const list = useAsyncList(async () => [await analyticsService.snapshot(scopedWarehouseIds())])
  const snapshot = computed(() => list.data.value[0] ?? null)
  return { snapshot, loading: list.loading, error: list.error, refresh: list.refresh }
}

export function useAdminUsers() {
  const { currentUser } = useCurrentUser()
  const list = useAsyncList(() => adminService.users())
  const users = computed(() =>
    list.data.value.filter((user) => {
      if (user.role === 'SUPER_ADMIN' || user.role === 'TENANT_OWNER') return false
      if (currentUser.value?.companyId) return user.companyId === currentUser.value.companyId
      return true
    }),
  )

  async function createUser(input: UserInput) {
    const created = await adminService.createUser(input)
    await list.refresh(true)
    return created
  }

  async function updateUser(id: string, input: Partial<UserInput>) {
    const updated = await adminService.updateUser(id, input)
    await list.refresh(true)
    return updated
  }

  return {
    users,
    loading: list.loading,
    error: list.error,
    refresh: list.refresh,
    createUser,
    updateUser,
  }
}

export function useRoles() {
  const list = useAsyncList(() => adminService.roles())
  return { roles: list.data, loading: list.loading, error: list.error, refresh: list.refresh }
}
