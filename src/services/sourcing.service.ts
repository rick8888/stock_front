import type { Product, Supplier, SupplierProduct } from '@/types'
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

/** Conditions d'achat applicables à une quantité commandée. */
export interface PurchaseTerms {
  minOrderQty?: number | null
  orderMultiple?: number | null
}

/**
 * Applique le minimum de commande puis le colisage, dans cet ordre —
 * le moteur de réapprovisionnement serveur procède de la même façon.
 */
export function applyPurchaseTerms(quantity: number, terms?: PurchaseTerms) {
  if (quantity <= 0) return 0
  let result = quantity
  if (terms?.minOrderQty && result < terms.minOrderQty) result = terms.minOrderQty
  if (terms?.orderMultiple && terms.orderMultiple > 1) {
    result = Math.ceil(result / terms.orderMultiple) * terms.orderMultiple
  }
  return result
}

/** Conditions d'achat d'un article chez un fournisseur, indexées par "supplierId|productId". */
export function keyPurchaseTerms(catalog: SupplierProduct[]) {
  return new Map(catalog.map((row) => [`${row.supplierId}|${row.productId}`, row]))
}

/**
 * Quantité à commander pour couvrir une ligne de demande : le besoin net
 * déduit le stock disponible et ce qui est déjà en route, puis les
 * conditions du fournisseur s'appliquent si elles sont connues.
 */
export function quantityToOrder(line: RequestLineView, terms?: PurchaseTerms) {
  const net = Math.max(0, line.quantity - line.available - line.inTransit)
  return applyPurchaseTerms(net, terms)
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
  catalog?: SupplierProduct[],
): SourcingOffer[] {
  const merged = mergeOverviewsForSourcing(overviews)
  if (!merged) return []
  return buildSourcingOffers({ overview: merged, products, suppliers, catalog })
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
  catalog?: SupplierProduct[]
}): SourcingOffer[] {
  const needed = input.overview.lines
    .map((line) => ({ line, quantity: quantityToOrder(line) }))
    .filter((item) => item.quantity > 0)
  if (!needed.length) return []
  const terms = keyPurchaseTerms(input.catalog ?? [])

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
    // Minimum de commande et colisage diffèrent d'un fournisseur à l'autre :
    // la quantité comparée doit être celle qu'il faudrait réellement commander.
    const lines = needed.map((item) => ({
      line: item.line,
      quantity: applyPurchaseTerms(item.quantity, terms.get(`${supplier.id}|${item.line.productId}`)),
    }))
    const amount = lines.reduce((sum, item) => sum + item.line.unitPrice * factor * item.quantity, 0)
    const quantity = lines.reduce((sum, item) => sum + item.quantity, 0)
    const unitPrice = quantity ? amount / quantity : 0
    const reasons: string[] = []
    if (supplier.id === preferredId) reasons.push('Fournisseur habituel de l’article')
    reasons.push(`Fiabilité ${supplier.reliability}%`)
    reasons.push(`Délai annoncé ${supplier.leadTimeDays} j`)
    const adjusted = lines.filter(
      (item) => item.quantity !== needed.find((row) => row.line.productId === item.line.productId)?.quantity,
    )
    if (adjusted.length) {
      reasons.push(`Quantité ajustée au minimum/colisage sur ${adjusted.length} article(s)`)
    }
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
