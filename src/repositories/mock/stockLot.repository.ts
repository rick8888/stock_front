import type { StockLotRepository } from '@/repositories/interfaces'
import { db, withLatency } from './db'

export class MockStockLotRepository implements StockLotRepository {
  list(warehouseId?: string, productId?: string) {
    return withLatency(() =>
      db()
        .stockLots.filter((row) => (!warehouseId || row.warehouseId === warehouseId) && (!productId || row.productId === productId))
        .slice()
        .sort((a, b) => (a.expiryDate ?? '9999').localeCompare(b.expiryDate ?? '9999')),
    )
  }
}
