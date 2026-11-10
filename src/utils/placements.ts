import type { PickPathStep, StockPlacement, WarehouseLocation } from '@/types'
import { db } from '@/repositories/mock/db'
import { uid } from '@/utils/helpers'

export function putawayPlacement(
  productId: string,
  warehouseId: string,
  quantity: number,
  locationId?: string,
  lotId?: string,
) {
  const location = resolveLocation(warehouseId, locationId, productId)
  if (!location) return null
  const existing = db().stockPlacements.find(
    (row) =>
      row.productId === productId &&
      row.warehouseId === warehouseId &&
      row.locationId === location.id &&
      (row.lotId ?? undefined) === (lotId ?? undefined),
  )
  if (existing) {
    existing.quantity += quantity
    return existing
  }
  const placement: StockPlacement = {
    id: uid('plc'),
    productId,
    warehouseId,
    locationId: location.id,
    lotId,
    quantity,
  }
  db().stockPlacements.unshift(placement)
  return placement
}

export function consumePlacementPath(productId: string, warehouseId: string, quantity: number) {
  let remaining = quantity
  const locations = new Map(db().warehouseLocations.filter((row) => row.warehouseId === warehouseId).map((row) => [row.id, row]))
  const rows = db()
    .stockPlacements.filter((row) => row.productId === productId && row.warehouseId === warehouseId && row.quantity > 0)
    .slice()
    .sort((a, b) => (locations.get(a.locationId)?.code ?? 'ZZZ').localeCompare(locations.get(b.locationId)?.code ?? 'ZZZ'))
  for (const row of rows) {
    if (remaining <= 0) break
    const take = Math.min(row.quantity, remaining)
    row.quantity -= take
    remaining -= take
  }
}

export function buildPickPath(
  warehouseId: string,
  lines: { productId: string; quantity: number; productName?: string; sku?: string }[],
): PickPathStep[] {
  const locations = new Map(
    db()
      .warehouseLocations.filter((row) => row.warehouseId === warehouseId && row.active !== false)
      .map((row) => [row.id, row]),
  )
  const steps: PickPathStep[] = []
  for (const line of lines) {
    const rows = db()
      .stockPlacements.filter((row) => row.productId === line.productId && row.warehouseId === warehouseId && row.quantity > 0)
      .slice()
      .sort((a, b) => (locations.get(a.locationId)?.code ?? 'ZZZ').localeCompare(locations.get(b.locationId)?.code ?? 'ZZZ'))
    let left = line.quantity
    if (!rows.length) {
      steps.push({
        productId: line.productId,
        productName: line.productName ?? line.productId,
        sku: line.sku,
        quantity: line.quantity,
        unlocated: true,
      })
      continue
    }
    for (const row of rows) {
      if (left <= 0) break
      const take = Math.min(left, row.quantity)
      const loc = locations.get(row.locationId)
      steps.push({
        productId: line.productId,
        productName: line.productName ?? line.productId,
        sku: line.sku,
        quantity: take,
        locationId: row.locationId,
        locationCode: loc?.code,
        aisle: loc?.aisle,
        rack: loc?.rack,
        bin: loc?.bin,
        unlocated: false,
      })
      left -= take
    }
    if (left > 0) {
      steps.push({
        productId: line.productId,
        productName: line.productName ?? line.productId,
        sku: line.sku,
        quantity: left,
        unlocated: true,
      })
    }
  }
  return steps.sort((a, b) => (a.locationCode ?? 'ZZZ').localeCompare(b.locationCode ?? 'ZZZ'))
}

export function suggestPutawayLocation(warehouseId: string, productId: string): WarehouseLocation | null {
  const existing = db().stockPlacements.find(
    (row) => row.productId === productId && row.warehouseId === warehouseId && row.quantity > 0,
  )
  if (existing) {
    return db().warehouseLocations.find((row) => row.id === existing.locationId) ?? null
  }
  const candidates = db()
    .warehouseLocations.filter((row) => row.warehouseId === warehouseId && row.active !== false)
    .slice()
    .sort((a, b) => `${a.type === 'pick' ? '0' : '1'}${a.code}`.localeCompare(`${b.type === 'pick' ? '0' : '1'}${b.code}`))
  return candidates[0] ?? null
}

function resolveLocation(warehouseId: string, locationId: string | undefined, productId: string) {
  if (locationId) {
    const location = db().warehouseLocations.find((row) => row.id === locationId && row.warehouseId === warehouseId)
    if (!location || location.active === false) throw new Error('Emplacement introuvable')
    return location
  }
  return suggestPutawayLocation(warehouseId, productId)
}
