import { receiptRepository } from '@/repositories'
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

  /**
   * Idempotent : renvoie le BR existant ou le crée (API = serveur, mock = local).
   * La création d’OA côté API déclenche déjà ce flux — cet appel couvre les OA orphelins.
   */
  async createFromOrder(order: PurchaseOrder | string) {
    const orderId = typeof order === 'string' ? order : order.id
    const existing = (await receiptRepository.list()).find((item) => item.purchaseOrderId === orderId)
    if (existing) return existing
    return receiptRepository.createFromOrder(orderId)
  },
}
