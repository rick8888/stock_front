import type { StockPlacementRepository } from '@/repositories/interfaces'
import { db, withLatency } from './db'
import { buildPickPath, suggestPutawayLocation } from '@/utils/placements'

export class MockStockPlacementRepository implements StockPlacementRepository {
  list(warehouseId?: string, productId?: string) {
    return withLatency(() =>
      db().stockPlacements.filter(
        (row) => (!warehouseId || row.warehouseId === warehouseId) && (!productId || row.productId === productId),
      ),
    )
  }

  pickPath(warehouseId: string, lines: { productId: string; quantity: number; productName?: string; sku?: string }[]) {
    return withLatency(() => buildPickPath(warehouseId, lines))
  }

  suggestPutaway(warehouseId: string, productId: string) {
    return withLatency(() => suggestPutawayLocation(warehouseId, productId))
  }
}
