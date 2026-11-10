import { receiptRepository, warehouseRepository } from '@/repositories'
import { taskService } from './task.service'
import type { PurchaseOrder, Receipt } from '@/types'

export const receiptService = {
  list: () => receiptRepository.list(),
  create: (input: Omit<Receipt, 'id'>) => receiptRepository.create(input),
  validate: (
    id: string,
    received: number,
    userId: string,
    lines?: { productId: string; received: number; lotCode?: string; expiryDate?: string; locationId?: string }[],
  ) => receiptRepository.validate(id, received, userId, lines),

  async createFromOrder(order: PurchaseOrder) {
    const existing = await receiptRepository.list()
    if (existing.some((item) => item.purchaseOrderId === order.id)) return existing.find((item) => item.purchaseOrderId === order.id)!
    const items = order.items.map((item) => ({ productId: item.productId, expected: item.quantity, received: 0 }))
    const expected = items.reduce((sum, item) => sum + item.expected, 0)
    const warehouses = await warehouseRepository.list()
    const warehouse = warehouses.find((item) => item.id === order.warehouseId)
    const receipt = await receiptRepository.create({
      purchaseOrderId: order.id,
      warehouseId: order.warehouseId,
      expected,
      received: 0,
      date: `${order.expectedDate}T09:00:00.000Z`,
      status: 'pending',
      userId: warehouse?.managerUserId ?? '',
      items,
    })
    if (warehouse?.managerUserId) {
      await taskService.create({
        title: `Réceptionner ${order.code ?? order.id.toUpperCase()}`,
        description: `Contrôler l’arrivage puis mettre le stock à jour.`,
        assigneeId: warehouse.managerUserId,
        dueAt: `${order.expectedDate}T10:00:00.000Z`,
        status: 'todo',
        priority: 'high',
        relatedType: 'receipt',
        relatedId: receipt.id,
      })
    }
    return receipt
  },
}
