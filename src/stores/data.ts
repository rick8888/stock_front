import { defineStore } from 'pinia'
import { reactive } from 'vue'
import type { MockDatabase } from '@/types'
import { createSeed } from '@/mocks'
import { emitDataChanged } from '@/utils/events'

const STORAGE_KEY = 'bravo-stock-ops-db-v25'

function load(): MockDatabase {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return createSeed()
    const parsed = JSON.parse(raw) as MockDatabase
    const seed = createSeed()
    return {
      ...seed,
      ...parsed,
      shippingNotes: Array.isArray(parsed.shippingNotes) ? parsed.shippingNotes : seed.shippingNotes,
      warehouseLocations: Array.isArray(parsed.warehouseLocations)
        ? parsed.warehouseLocations
        : seed.warehouseLocations,
      stockPlacements: Array.isArray(parsed.stockPlacements) ? parsed.stockPlacements : seed.stockPlacements,
    }
  } catch {
    return createSeed()
  }
}

export const useDataStore = defineStore('data', () => {
  const db = reactive(load()) as MockDatabase

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
    emitDataChanged()
  }

  function reset() {
    const seed = createSeed()
    ;(Object.keys(seed) as (keyof MockDatabase)[]).forEach((key) => {
      ;(db[key] as unknown[]) = seed[key] as unknown[]
    })
    persist()
  }

  return { db, persist, reset }
})
