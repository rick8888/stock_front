import { computed, ref } from 'vue'
import { taskService, alertService, planningService } from '@/services/task.service'
import { financeService } from '@/services/finance.service'
import { analyticsService } from '@/services/analytics.service'
import { receiptService } from '@/services/receipt.service'
import { adminService } from '@/services/task.service'
import { emitDataChanged } from '@/utils/events'
import { useAsyncList } from './useAsyncList'
import { useCurrentUser } from './useAuth'
import { usePermissions } from './usePermissions'
import type { TaskPriority } from '@/types'
import type { UserInput } from '@/repositories/interfaces'

export function useTasks() {
  const { currentUser } = useCurrentUser()
  /** Liste déjà filtrée « mes tâches » par l’API / le mock. */
  const list = useAsyncList(() => taskService.list())
  const board = useAsyncList(async () => {
    const payload = await taskService.board()
    return [payload]
  })

  const mine = computed(() => list.data.value)
  const boardData = computed(() => board.data.value[0] ?? null)

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
    await Promise.all([list.refresh(true), board.refresh(true)])
    emitDataChanged()
  }

  async function completeTask(id: string) {
    await taskService.update(id, { status: 'done' })
    await Promise.all([list.refresh(true), board.refresh(true)])
    emitDataChanged()
  }

  return {
    tasks: list.data,
    mine,
    board: boardData,
    boardLoading: board.loading,
    loading: computed(() => list.loading.value || board.loading.value),
    error: computed(() => list.error.value || board.error.value),
    createTask,
    completeTask,
    refresh: async (silent = true) => {
      await Promise.all([list.refresh(silent), board.refresh(silent)])
    },
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
  const board = ref<import('@/repositories/interfaces').PlanningBoard | null>(null)
  const loading = ref(true)
  const error = ref<string | null>(null)
  let lastBoardQuery: import('@/repositories/interfaces').PlanningBoardQuery = {}

  async function loadBoard(query: import('@/repositories/interfaces').PlanningBoardQuery = {}, silent = true) {
    lastBoardQuery = query
    if (!silent) loading.value = true
    error.value = null
    try {
      board.value = await planningService.board(query)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Une erreur est survenue'
    } finally {
      loading.value = false
    }
  }

  return {
    board,
    loading,
    error,
    loadBoard,
    refresh: (silent = true) => loadBoard(lastBoardQuery, silent),
  }
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
