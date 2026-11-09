import type { Product, Supplier } from '@/types'
import type { RequestLineView, RequestOverview } from './request.overview'

const PRICE_FACTOR: Record<string, number> = {
  'sup-atlas': 1,
  'sup-abc': 1.06,
  'sup-maghreb': 0.97,
  'sup-global': 1.03,
  'sup-nord': 0.91,
}

export interface SourcingOffer {
  supplierId: string
  supplierName: string
  city: string
  reliability: number
  leadTimeDays: number
  unitPrice: number
  amount: number
  quantity: number
  preferred: boolean
  recommended: boolean
  score: number
  reasons: string[]
}

export function supplierPriceFactor(supplierId: string) {
  return PRICE_FACTOR[supplierId] ?? 1
}

export function quantityToOrder(line: RequestLineView) {
  return Math.max(0, line.quantity - line.available)
}

export function mergeOverviewsForSourcing(overviews: RequestOverview[]): RequestOverview | null {
  if (!overviews.length) return null
  if (overviews.length === 1) return overviews[0]
  const linesMap = new Map<string, RequestLineView>()
  for (const overview of overviews) {
    for (const line of overview.lines) {
      const previous = linesMap.get(line.productId)
      if (previous) {
        previous.quantity += line.quantity
        previous.amount = previous.unitPrice * previous.quantity
      } else {
        linesMap.set(line.productId, { ...line })
      }
    }
  }
  const lines = [...linesMap.values()]
  const base = overviews[0]
  return {
    ...base,
    lines,
    total: lines.reduce((sum, line) => sum + line.amount, 0),
    code: overviews.map((item) => item.code).join(' · '),
  }
}

export function buildSourcingOffersFor(
  overviews: RequestOverview[],
  products: Product[],
  suppliers: Supplier[],
): SourcingOffer[] {
  const merged = mergeOverviewsForSourcing(overviews)
  if (!merged) return []
  return buildSourcingOffers({ overview: merged, products, suppliers })
}

export function isReadyToPurchase(overview: RequestOverview, userId?: string) {
  const request = overview.request
  return (
    request.status === 'approved' &&
    Boolean(request.takenAt) &&
    request.assignedRole === 'PROCUREMENT' &&
    overview.decision !== 'issue' &&
    !overview.linkedOrder &&
    (!userId || request.assigneeId === userId)
  )
}

export function buildSourcingOffers(input: {
  overview: RequestOverview
  products: Product[]
  suppliers: Supplier[]
}): SourcingOffer[] {
  const needed = input.overview.lines
    .map((line) => ({ line, quantity: quantityToOrder(line) }))
    .filter((item) => item.quantity > 0)
  if (!needed.length) return []

  const preferredIds = needed
    .map((item) => input.products.find((product) => product.id === item.line.productId)?.supplierId)
    .filter((id): id is string => Boolean(id))
  const preferredId = preferredIds[0]
  const active = input.suppliers.filter((item) => item.status === 'active')
  const ranked = [...active].sort((a, b) => b.reliability - a.reliability || a.leadTimeDays - b.leadTimeDays)
  const picked: Supplier[] = []
  const preferred = active.find((item) => item.id === preferredId)
  if (preferred) picked.push(preferred)
  ranked.forEach((item) => {
    if (picked.length >= 3) return
    if (!picked.some((existing) => existing.id === item.id)) picked.push(item)
  })

  const offers = picked.map((supplier) => {
    const factor = supplierPriceFactor(supplier.id)
    const amount = needed.reduce((sum, item) => sum + item.line.unitPrice * factor * item.quantity, 0)
    const quantity = needed.reduce((sum, item) => sum + item.quantity, 0)
    const unitPrice = quantity ? amount / quantity : 0
    const reasons: string[] = []
    if (supplier.id === preferredId) reasons.push('Fournisseur habituel de l’article')
    reasons.push(`Fiabilité ${supplier.reliability}%`)
    reasons.push(`Délai annoncé ${supplier.leadTimeDays} j`)
    const score =
      supplier.reliability * 0.5 +
      Math.max(0, 10 - supplier.leadTimeDays) * 4 +
      Math.max(0, 1.15 - factor) * 80
    return {
      supplierId: supplier.id,
      supplierName: supplier.name,
      city: supplier.city,
      reliability: supplier.reliability,
      leadTimeDays: supplier.leadTimeDays,
      unitPrice,
      amount,
      quantity,
      preferred: supplier.id === preferredId,
      recommended: false,
      score,
      reasons,
    }
  })

  const fastest = Math.min(...offers.map((item) => item.leadTimeDays))
  const cheapest = Math.min(...offers.map((item) => item.amount))
  const mostReliable = Math.max(...offers.map((item) => item.reliability))
  offers.forEach((offer) => {
    if (offer.leadTimeDays === fastest) offer.reasons.push('Délai le plus court')
    if (offer.amount === cheapest) offer.reasons.push('Meilleur prix')
    if (offer.reliability === mostReliable) offer.reasons.push('Meilleure fiabilité')
  })

  offers.sort((a, b) => b.score - a.score)
  if (offers[0]) offers[0].recommended = true
  return offers
}
