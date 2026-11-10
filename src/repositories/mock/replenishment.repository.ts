import type { ReplenishmentRepository } from '@/repositories/interfaces'
import type { ReplenishmentSuggestion } from '@/types'
import { db, withLatency } from './db'

const OPEN_ORDER_STATUSES = new Set(['draft', 'sent', 'confirmed', 'partial', 'delayed'])
const PENDING_REQUEST_STATUSES = new Set(['submitted', 'approved'])
const DEFAULT_LEAD_TIME_DAYS = 5
const REVIEW_PERIOD_DAYS = 7

/**
 * Approximation hors ligne des propositions de réapprovisionnement.
 *
 * Le vrai moteur vit côté API : il s'appuie sur l'historique des sorties, le catalogue
 * fournisseur et les conditions par entrepôt, dont le jeu de démonstration ne dispose pas.
 * Cette implémentation se contente du seuil et du délai déclarés, sans variabilité ni
 * contrainte de commande, et le signale dans les motifs.
 */
export class MockReplenishmentRepository implements ReplenishmentRepository {
  list(warehouseId?: string) {
    return withLatency(() => this.build(warehouseId))
  }

  compute(warehouseId: string) {
    return withLatency(() => this.build(warehouseId))
  }

  private build(warehouseId?: string): ReplenishmentSuggestion[] {
    const data = db()
    const products = new Map(data.products.map((item) => [item.id, item]))
    const suppliers = new Map(data.suppliers.map((item) => [item.id, item]))

    return data.stock
      .filter((row) => row.enabled !== false && (!warehouseId || row.warehouseId === warehouseId))
      .map((row): ReplenishmentSuggestion | null => {
        const product = products.get(row.productId)
        if (!product || product.archived) return null

        const supplier = product.supplierId ? suppliers.get(product.supplierId) : undefined
        const leadTimeDays = supplier?.leadTimeDays ?? DEFAULT_LEAD_TIME_DAYS
        const avgDailyDemand = product.dailyDemand || 0
        const available = Math.max(0, row.quantity - (row.reserved || 0))
        const inTransit = this.incoming(row.productId, row.warehouseId)
        const pendingNeed = this.pending(row.productId, row.warehouseId)

        // Sans historique, l'écart-type est inconnu : le seuil manuel tient lieu
        // de stock de sécurité, comme le fait le moteur en l'absence de données.
        const safetyStock = product.minStock ?? 0
        const reorderPoint = Math.max(Math.ceil(avgDailyDemand * leadTimeDays) + safetyStock, safetyStock)
        const targetLevel = Math.max(reorderPoint + Math.ceil(avgDailyDemand * REVIEW_PERIOD_DAYS), reorderPoint)

        const netPosition = available + inTransit - pendingNeed
        const rawQuantity = Math.max(0, targetLevel - netPosition)
        const suggestedQuantity = netPosition <= reorderPoint ? rawQuantity : 0
        if (suggestedQuantity <= 0) return null

        const coverDays = avgDailyDemand > 0 ? Math.round((available / avgDailyDemand) * 10) / 10 : null
        const unitPrice = product.price ?? null

        return {
          id: `rsg-mock-${row.id}`,
          productId: row.productId,
          warehouseId: row.warehouseId,
          supplierId: product.supplierId || null,
          policy: 'rop',
          avgDailyDemand,
          demandStdDev: 0,
          leadTimeDays,
          leadTimeStdDev: 0,
          serviceLevel: null,
          safetyStock,
          reorderPoint,
          targetLevel,
          available,
          inTransit,
          pendingNeed,
          rawQuantity,
          suggestedQuantity,
          minOrderQty: null,
          orderMultiple: null,
          unitPrice,
          estimatedCost: unitPrice === null ? null : Math.round(unitPrice * suggestedQuantity * 100) / 100,
          coverDays,
          risk: this.risk(available, netPosition, safetyStock, reorderPoint, coverDays, leadTimeDays),
          reasons: [
            'Estimation hors ligne : ni historique de sorties ni conditions fournisseur',
            `Point de commande ${reorderPoint} = demande ${avgDailyDemand}/j × délai ${leadTimeDays} j + seuil ${safetyStock}`,
            ...(coverDays !== null ? [`Couverture actuelle : ${coverDays} jours`] : []),
            ...(pendingNeed > 0 ? [`Demandes validées à servir : ${pendingNeed}`] : []),
            ...(inTransit > 0 ? [`Déjà commandé : ${inTransit}`] : []),
          ],
          computedAt: new Date().toISOString(),
        }
      })
      .filter((row): row is ReplenishmentSuggestion => row !== null)
      .sort((a, b) => b.suggestedQuantity - a.suggestedQuantity)
  }

  private incoming(productId: string, warehouseId: string): number {
    return db()
      .purchaseOrders.filter(
        (order) => OPEN_ORDER_STATUSES.has(order.status) && order.warehouseId === warehouseId,
      )
      .reduce(
        (sum, order) =>
          sum +
          order.items
            .filter((item) => item.productId === productId)
            .reduce((qty, item) => qty + item.quantity, 0),
        0,
      )
  }

  private pending(productId: string, warehouseId: string): number {
    return db()
      .procurementRequests.filter(
        (request) =>
          PENDING_REQUEST_STATUSES.has(request.status) && request.warehouseId === warehouseId,
      )
      .reduce(
        (sum, request) =>
          sum +
          request.items
            .filter((item) => item.productId === productId)
            .reduce((qty, item) => qty + item.quantity, 0),
        0,
      )
  }

  private risk(
    available: number,
    netPosition: number,
    safetyStock: number,
    reorderPoint: number,
    coverDays: number | null,
    leadTimeDays: number,
  ): ReplenishmentSuggestion['risk'] {
    if (available <= 0) return 'high'
    if (netPosition <= safetyStock) return 'high'
    if (coverDays !== null && leadTimeDays > 0 && coverDays <= leadTimeDays) return 'high'
    if (netPosition <= reorderPoint) return 'medium'
    return 'low'
  }
}
