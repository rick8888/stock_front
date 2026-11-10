import type { StockLot } from '@/types'
import { db } from '@/repositories/mock/db'
import { uid } from '@/utils/helpers'

export function receiveLot(
  productId: string,
  warehouseId: string,
  quantity: number,
  lotCode?: string,
  expiryDate?: string,
  locationId?: string,
) {
  const code = (lotCode ?? '').trim() || `LOT-${uid('x').slice(-6).toUpperCase()}`
  const existing = db().stockLots.find(
    (row) =>
      row.productId === productId &&
      row.warehouseId === warehouseId &&
      row.lotCode.toLowerCase() === code.toLowerCase(),
  )
  if (existing) {
    existing.quantity += quantity
    if (expiryDate) existing.expiryDate = expiryDate
    if (locationId) existing.locationId = locationId
    return existing
  }
  const lot: StockLot = {
    id: uid('lot'),
    productId,
    warehouseId,
    lotCode: code,
    expiryDate,
    locationId,
    quantity,
  }
  db().stockLots.unshift(lot)
  return lot
}

/** FEFO : consomme les lots à DLC la plus proche. */
export function consumeLotsFefo(productId: string, warehouseId: string, quantity: number) {
  let remaining = quantity
  const lots = db()
    .stockLots.filter((row) => row.productId === productId && row.warehouseId === warehouseId && row.quantity > 0)
    .slice()
    .sort((a, b) => (a.expiryDate ?? '9999-12-31').localeCompare(b.expiryDate ?? '9999-12-31'))
  for (const lot of lots) {
    if (remaining <= 0) break
    const take = Math.min(lot.quantity, remaining)
    lot.quantity -= take
    remaining -= take
  }
  if (remaining > 0) {
    throw new Error('Stock lot insuffisant (FEFO)')
  }
}
