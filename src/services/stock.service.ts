import { stockRepository } from '@/repositories'
import type { ProcurementRequest, StockOverviewRow, StockRecommendation } from '@/types'

export { buildStockRows } from './stock.overview'

export const stockService = {
  list: () => stockRepository.list(),
  overview: () => stockRepository.overview(),
  movements: () => stockRepository.movements(),
  inventories: () => stockRepository.inventories(),
  receive: stockRepository.receive.bind(stockRepository),
  issue: stockRepository.issue.bind(stockRepository),
  transfer: stockRepository.transfer.bind(stockRepository),
  adjust: stockRepository.adjust.bind(stockRepository),
  returnStock: stockRepository.returnStock.bind(stockRepository),
  toggleAssignment: stockRepository.toggleAssignment.bind(stockRepository),
  startInventory: stockRepository.startInventory.bind(stockRepository),
  saveInventory: stockRepository.saveInventory.bind(stockRepository),
  submitInventory: stockRepository.submitInventory.bind(stockRepository),
  completeInventory: stockRepository.completeInventory.bind(stockRepository),
  closeDay: stockRepository.closeDay.bind(stockRepository),

  async coverageDays(productId: string, warehouseId?: string) {
    const board = await stockRepository.overview()
    const rows = board.rows.filter(
      (row) => row.productId === productId && (!warehouseId || row.warehouseId === warehouseId),
    )
    if (!rows.length) return Infinity
    const available = rows.reduce((sum, row) => sum + row.available, 0)
    const daily = rows[0]!.weeklyDemand / 7
    if (daily <= 0) return Infinity
    return available / daily
  },

  async risks(warehouseIds?: string[]) {
    const board = await stockRepository.overview()
    return board.rows
      .filter((row) => {
        if (warehouseIds?.length && !warehouseIds.includes(row.warehouseId)) return false
        return row.days <= 7 || row.available < row.minStock
      })
      .map((row) => ({
        product: { id: row.productId, name: row.productName, minStock: row.minStock, dailyDemand: row.weeklyDemand / 7 },
        warehouse: { id: row.warehouseId, name: row.warehouseName },
        available: row.available,
        days: row.days,
        belowMin: row.available < row.minStock,
      }))
      .sort((a, b) => a.days - b.days)
  },
}

/** Affiche la reco fournie par le board — pas de recalcul métier. */
export function recommendStock(row: StockOverviewRow, _requests: ProcurementRequest[] = []): StockRecommendation {
  return (
    row.recommendation ?? {
      quantity: 0,
      risk: row.status === 'critical' ? 'high' : row.status === 'watch' ? 'medium' : 'low',
      reasons: [],
    }
  )
}
