import type { WarehouseLocation } from '@/types'
import type { WarehouseLocationInput, WarehouseLocationRepository } from '@/repositories/interfaces'
import { uid } from '@/utils/helpers'
import { db, mutate, withLatency } from './db'

export class MockWarehouseLocationRepository implements WarehouseLocationRepository {
  list(warehouseId?: string) {
    return withLatency(() =>
      db()
        .warehouseLocations.filter((row) => !warehouseId || row.warehouseId === warehouseId)
        .slice()
        .sort((a, b) => a.code.localeCompare(b.code)),
    )
  }

  getById(id: string) {
    return withLatency(() => db().warehouseLocations.find((row) => row.id === id) ?? null)
  }

  create(input: WarehouseLocationInput) {
    return mutate(() => {
      const aisle = input.aisle.trim().toUpperCase()
      const rack = input.rack.trim().toUpperCase()
      const bin = input.bin.trim().toUpperCase()
      if (!aisle || !rack || !bin) throw new Error('Allée, rack et bac sont requis')
      const code = (input.code?.trim() || `${aisle}-${rack}-${bin}`).toUpperCase()
      if (db().warehouseLocations.some((row) => row.warehouseId === input.warehouseId && row.code === code)) {
        throw new Error(`L’emplacement ${code} existe déjà`)
      }
      const location: WarehouseLocation = {
        id: uid('loc'),
        warehouseId: input.warehouseId,
        code,
        aisle,
        rack,
        bin,
        type: input.type ?? 'pick',
        active: input.active ?? true,
      }
      db().warehouseLocations.unshift(location)
      return location
    })
  }

  update(id: string, input: Partial<WarehouseLocationInput>) {
    return mutate(() => {
      const location = db().warehouseLocations.find((row) => row.id === id)
      if (!location) throw new Error('Emplacement introuvable')
      if (input.aisle) location.aisle = input.aisle.trim().toUpperCase()
      if (input.rack) location.rack = input.rack.trim().toUpperCase()
      if (input.bin) location.bin = input.bin.trim().toUpperCase()
      if (input.type) location.type = input.type
      if (input.active !== undefined) location.active = input.active
      location.code = (input.code?.trim() || `${location.aisle}-${location.rack}-${location.bin}`).toUpperCase()
      return location
    })
  }
}
