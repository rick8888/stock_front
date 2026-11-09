import { purchaseRepository, procurementRepository, stockRepository, supplierRepository, consultationRepository } from '@/repositories'
import { productService } from './product.service'
import { receiptService } from './receipt.service'
import { buildRequestOverviews, orderRequestIds } from './request.overview'
import { buildSourcingOffersFor, mergeOverviewsForSourcing, quantityToOrder } from './sourcing.service'
import { addDays, todayIso } from '@/utils/helpers'
import type { Consultation, PurchaseOrder, SupplierQuote } from '@/types'

export const purchaseService = {
  list: () => purchaseRepository.list(),
  create: (input: Omit<PurchaseOrder, 'id' | 'createdAt'>) => purchaseRepository.create(input),
  updateStatus: (id: string, status: PurchaseOrder['status']) => purchaseRepository.updateStatus(id, status),
  delayed: async () => {
    const orders = await purchaseRepository.list()
    const today = todayIso()
    return orders.filter(
      (order) =>
        order.status === 'delayed' ||
        (['sent', 'confirmed'].includes(order.status) && order.expectedDate < today),
    )
  },

  async createFromOffer(requestIds: string | string[], supplierId: string) {
    const ids = [...new Set(Array.isArray(requestIds) ? requestIds : [requestIds])]
    const [requests, products, suppliers, stock, existing] = await Promise.all([
      procurementRepository.list(),
      productService.list(),
      supplierRepository.list(),
      stockRepository.list(),
      purchaseRepository.list(),
    ])
    const selected = ids.map((id) => {
      const request = requests.find((item) => item.id === id)
      if (!request) throw new Error('Demande introuvable')
      return request
    })
    const warehouses = new Set(selected.map((item) => item.warehouseId))
    if (warehouses.size !== 1) throw new Error('Regrouper uniquement des demandes du même entrepôt')
    const alreadyOrdered = existing.some((order) => orderRequestIds(order).some((id) => ids.includes(id)))
    if (alreadyOrdered) throw new Error('Une commande existe déjà pour l’une de ces demandes')
    const open = await consultationRepository.list()
    await Promise.all(
      open
        .filter(
          (item) =>
            !['awarded', 'cancelled'].includes(item.status) &&
            item.procurementRequestIds.some((id) => ids.includes(id)),
        )
        .map((item) => consultationRepository.update(item.id, { status: 'cancelled' })),
    )
    const overviews = buildRequestOverviews({
      requests: selected,
      products,
      warehouses: [],
      users: [],
      stock,
      orders: existing,
      receipts: [],
    })
    const merged = mergeOverviewsForSourcing(overviews)
    if (!merged) throw new Error('Rien à commander')
    const offer = buildSourcingOffersFor(overviews, products, suppliers).find((item) => item.supplierId === supplierId)
    if (!offer) throw new Error('Offre fournisseur introuvable')
    const items = merged.lines
      .map((line) => ({ productId: line.productId, quantity: quantityToOrder(line) }))
      .filter((line) => line.quantity > 0)
    if (!items.length) throw new Error('Stock suffisant — pas d’ordre d’achat')
    const order = await purchaseRepository.create({
      supplierId,
      warehouseId: selected[0].warehouseId,
      status: 'sent',
      items,
      expectedDate: todayIso(addDays(new Date(), offer.leadTimeDays)),
      amount: Math.round(offer.amount),
      procurementRequestId: ids[0],
      procurementRequestIds: ids,
    })
    for (const id of ids) {
      await procurementRepository.updateStatus(id, 'ordered')
    }
    await receiptService.createFromOrder(order)
    return order
  },

  async createFromQuote(consultation: Consultation, quote: SupplierQuote) {
    const ids = consultation.procurementRequestIds
    const [requests, existing] = await Promise.all([procurementRepository.list(), purchaseRepository.list()])
    const selected = ids.map((id) => {
      const request = requests.find((item) => item.id === id)
      if (!request) throw new Error('Demande introuvable')
      return request
    })
    const alreadyOrdered = existing.some((order) => orderRequestIds(order).some((id) => ids.includes(id)))
    if (alreadyOrdered) throw new Error('Une commande existe déjà pour l’une de ces demandes')
    const items = (quote.lines ?? consultation.items).map((line) => ({
      productId: line.productId,
      quantity: line.quantity,
    }))
    if (!items.length) throw new Error('Devis sans article')
    const order = await purchaseRepository.create({
      supplierId: quote.supplierId,
      warehouseId: consultation.warehouseId,
      status: 'sent',
      items,
      expectedDate: todayIso(addDays(new Date(), quote.leadTimeDays ?? 4)),
      amount: Math.round(quote.amount ?? 0),
      procurementRequestId: ids[0],
      procurementRequestIds: ids,
      consultationId: consultation.id,
      quoteId: quote.id,
    })
    for (const id of ids) {
      await procurementRepository.updateStatus(id, 'ordered')
    }
    await receiptService.createFromOrder(order)
    return order
  },
}
