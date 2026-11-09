import { consultationRepository, procurementRepository, stockRepository, supplierRepository } from '@/repositories'
import { productService } from './product.service'
import { purchaseService } from './purchase.service'
import { buildRequestOverviews } from './request.overview'
import { mergeOverviewsForSourcing, quantityToOrder, supplierPriceFactor } from './sourcing.service'
import { addDays, todayIso, uid } from '@/utils/helpers'
import type { Consultation, SupplierQuote } from '@/types'

export const consultationService = {
  list: () => consultationRepository.list(),

  async forRequests(requestIds: string[]) {
    const ids = [...new Set(requestIds)]
    const list = await consultationRepository.list()
    return list.find(
      (item) =>
        !['cancelled'].includes(item.status) &&
        item.procurementRequestIds.some((id) => ids.includes(id)),
    )
  },

  async launch(requestIds: string[], supplierIds: string[], note?: string) {
    const ids = [...new Set(requestIds)]
    const uniqueSuppliers = [...new Set(supplierIds)]
    if (uniqueSuppliers.length < 2) throw new Error('Choisissez au moins deux fournisseurs')
    const existing = await this.forRequests(ids)
    if (existing && !['awarded', 'cancelled'].includes(existing.status)) {
      throw new Error('Une consultation est déjà en cours pour cette demande')
    }
    const [requests, products, suppliers, stock] = await Promise.all([
      procurementRepository.list(),
      productService.list(),
      supplierRepository.list(),
      stockRepository.list(),
    ])
    const selected = ids.map((id) => {
      const request = requests.find((item) => item.id === id)
      if (!request) throw new Error('Demande introuvable')
      return request
    })
    const warehouses = new Set(selected.map((item) => item.warehouseId))
    if (warehouses.size !== 1) throw new Error('Consultation uniquement sur un même entrepôt')
    const overviews = buildRequestOverviews({
      requests: selected,
      products,
      warehouses: [],
      users: [],
      stock,
      orders: [],
      receipts: [],
    })
    const merged = mergeOverviewsForSourcing(overviews)
    if (!merged) throw new Error('Rien à consulter')
    const items = merged.lines
      .map((line) => ({ productId: line.productId, quantity: quantityToOrder(line) }))
      .filter((line) => line.quantity > 0)
    if (!items.length) throw new Error('Stock suffisant — pas de consultation')
    const now = new Date().toISOString()
    const quotes: SupplierQuote[] = uniqueSuppliers.map((supplierId) => {
      const supplier = suppliers.find((item) => item.id === supplierId)
      const factor = supplierPriceFactor(supplierId) * (0.96 + (supplierId.length % 5) * 0.015)
      const lines = items.map((item) => {
        const product = products.find((row) => row.id === item.productId)
        const unitPrice = Math.round((product?.price ?? 0) * factor * 100) / 100
        return { productId: item.productId, quantity: item.quantity, unitPrice }
      })
      const amount = Math.round(lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0))
      const lead = Math.max(2, (supplier?.leadTimeDays ?? 4) + (supplierId.includes('abc') ? -1 : 0))
      return {
        id: uid('qt'),
        supplierId,
        status: 'received' as const,
        receivedAt: now,
        validUntil: todayIso(addDays(new Date(), 7)),
        leadTimeDays: lead,
        amount,
        lines,
      }
    })
    return consultationRepository.create({
      status: 'quoted',
      procurementRequestIds: ids,
      warehouseId: selected[0].warehouseId,
      supplierIds: uniqueSuppliers,
      items,
      quotes,
      sentAt: now,
      quotedAt: now,
      note,
    })
  },

  async cancel(id: string) {
    return consultationRepository.update(id, { status: 'cancelled' })
  },

  async attachFile(consultationId: string, quoteId: string, file: NonNullable<SupplierQuote['file']>) {
    const list = await consultationRepository.list()
    const consultation = list.find((item) => item.id === consultationId)
    if (!consultation) throw new Error('Consultation introuvable')
    if (['awarded', 'cancelled'].includes(consultation.status)) {
      throw new Error('Consultation déjà close')
    }
    const quotes = consultation.quotes.map((item) => (item.id === quoteId ? { ...item, file } : item))
    if (!quotes.some((item) => item.id === quoteId)) throw new Error('Devis introuvable')
    return consultationRepository.update(consultationId, { quotes })
  },

  async cancelOpenFor(requestIds: string[]) {
    const ids = [...new Set(requestIds)]
    const list = await consultationRepository.list()
    await Promise.all(
      list
        .filter(
          (item) =>
            !['awarded', 'cancelled'].includes(item.status) &&
            item.procurementRequestIds.some((id) => ids.includes(id)),
        )
        .map((item) => consultationRepository.update(item.id, { status: 'cancelled' })),
    )
  },

  async award(consultationId: string, quoteId: string) {
    const list = await consultationRepository.list()
    const consultation = list.find((item) => item.id === consultationId)
    if (!consultation) throw new Error('Consultation introuvable')
    if (consultation.status === 'awarded') throw new Error('Devis déjà retenu')
    const quote = consultation.quotes.find((item) => item.id === quoteId)
    if (!quote || quote.status !== 'received') throw new Error('Devis introuvable')
    if (!quote.file) throw new Error('Joignez le fichier devis du fournisseur avant de retenir cette offre')
    const order = await purchaseService.createFromQuote(consultation, quote)
    return consultationRepository.update(consultationId, {
      status: 'awarded',
      awardedAt: new Date().toISOString(),
      awardedQuoteId: quoteId,
    }).then(() => order)
  },
}
