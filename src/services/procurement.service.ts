import { procurementRepository, userRepository, warehouseRepository, stockRepository } from '@/repositories'
import { productService } from './product.service'
import { taskService } from './task.service'
import { buildRequestOverviews } from './request.overview'
import { requestCode } from '@/lib/utils'
import type { ProcurementItem, ProcurementRequest } from '@/types'

function mergeItems(items: ProcurementItem[]): ProcurementItem[] {
  const map = new Map<string, number>()
  for (const item of items) {
    const quantity = Number(item.quantity)
    if (!item.productId || !Number.isFinite(quantity) || quantity <= 0) continue
    map.set(item.productId, (map.get(item.productId) ?? 0) + quantity)
  }
  return [...map.entries()].map(([productId, quantity]) => ({ productId, quantity }))
}

export const procurementService = {
  list: () => procurementRepository.list(),
  board: (query?: import('@/repositories/interfaces').ProcurementBoardQuery) => procurementRepository.board(query),
  sourcing: (requestIds: string[]) => procurementRepository.sourcing(requestIds),
  create: (input: Omit<ProcurementRequest, 'id' | 'createdAt' | 'status'> & { status?: ProcurementRequest['status'] }) => {
    const items = mergeItems(input.items)
    if (!items.length) throw new Error('Ajoutez au moins un article')
    return procurementRepository.create({ ...input, items })
  },
  updateStatus: (id: string, status: ProcurementRequest['status'], extras?: Partial<ProcurementRequest>) =>
    procurementRepository.updateStatus(id, status, extras),
  reject: (id: string) => procurementRepository.updateStatus(id, 'rejected'),
  requestChanges: (id: string) => procurementRepository.updateStatus(id, 'draft'),
  submit: (id: string) => procurementRepository.updateStatus(id, 'submitted'),

  async approve(id: string) {
    const [requests, products, warehouses, users, stock] = await Promise.all([
      procurementRepository.list(),
      productService.list(),
      warehouseRepository.list(),
      userRepository.list(),
      stockRepository.list(),
    ])
    const request = requests.find((item) => item.id === id)
    if (!request) throw new Error('Demande introuvable')
    const view = buildRequestOverviews({
      requests: [request],
      products,
      warehouses,
      users,
      stock,
      orders: [],
      receipts: [],
    })[0]
    const warehouse = warehouses.find((item) => item.id === request.warehouseId)
    const buyer = users.find((item) => item.role === 'PROCUREMENT')
    const storekeeper = users.find((item) => item.id === warehouse?.managerUserId)
    const toBuyer = view.decision !== 'issue'
    const assignee = toBuyer ? buyer : storekeeper ?? buyer
    const now = new Date().toISOString()
    const updated = await procurementRepository.updateStatus(id, 'approved', {
      assigneeId: assignee?.id,
      assignedRole: toBuyer ? 'PROCUREMENT' : 'WAREHOUSE_MANAGER',
      handedOffAt: now,
      decidedAt: now,
    })
    if (assignee) {
      await taskService.create({
        title: toBuyer ? `Traiter ${view.code}` : `Sortir le stock — ${view.code}`,
        description: view.request.note,
        assigneeId: assignee.id,
        dueAt: now,
        status: 'todo',
        priority: view.priority === 'high' ? 'high' : 'medium',
        relatedType: 'procurement',
        relatedId: request.id,
      })
    }
    return updated
  },

  async takeCharge(id: string) {
    return procurementRepository.updateStatus(id, 'approved', { takenAt: new Date().toISOString() })
  },

  async issueFromRequest(id: string, userId: string) {
    const requests = await procurementRepository.list()
    const request = requests.find((item) => item.id === id)
    if (!request) throw new Error('Demande introuvable')
    const code = requestCode(request.id, request.code)
    for (const item of request.items) {
      await stockRepository.issue(item.productId, request.warehouseId, item.quantity, userId, `Sortie ${code}`, code)
    }
    return procurementRepository.updateStatus(id, 'closed')
  },
}
