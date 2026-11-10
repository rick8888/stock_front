import { replenishmentRepository } from '@/repositories'
import type { ReplenishmentSuggestion } from '@/types'

export const replenishmentService = {
  list: (warehouseId?: string) => replenishmentRepository.list(warehouseId),

  /** Recalcule un entrepôt ; refreshDemand relit tout l'historique des sorties. */
  compute: (warehouseId: string, refreshDemand = false) =>
    replenishmentRepository.compute(warehouseId, refreshDemand),

  /** Recalcule plusieurs entrepôts et renvoie l'ensemble des propositions. */
  async computeMany(warehouseIds: string[], refreshDemand = false): Promise<ReplenishmentSuggestion[]> {
    const batches = await Promise.all(
      warehouseIds.map((id) => replenishmentRepository.compute(id, refreshDemand)),
    )
    return batches.flat()
  },
}

/** Valeur totale des propositions, pour arbitrer un budget d'achat. */
export function totalEstimatedCost(rows: ReplenishmentSuggestion[]): number {
  return rows.reduce((sum, row) => sum + (row.estimatedCost ?? 0), 0)
}

/**
 * Regroupe les propositions par fournisseur : c'est la maille de passation réelle
 * d'une commande, et celle qui permet d'atteindre un minimum de commande.
 */
export function groupBySupplier(rows: ReplenishmentSuggestion[]): Map<string, ReplenishmentSuggestion[]> {
  const groups = new Map<string, ReplenishmentSuggestion[]>()
  rows.forEach((row) => {
    const key = row.supplierId ?? ''
    const bucket = groups.get(key)
    if (bucket) bucket.push(row)
    else groups.set(key, [row])
  })
  return groups
}
