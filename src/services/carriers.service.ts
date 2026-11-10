import { carriers as fallbackCatalog } from '@/mocks/carriers'
import { logisticsRepository } from '@/repositories'
import type { Carrier } from '@/types'

/** Cache alimenté par l’API (ou le mock) — les helpers sync lisent ici. */
let cache: Carrier[] = fallbackCatalog.map((item) => ({ ...item }))

export async function refreshCarriers(): Promise<Carrier[]> {
  try {
    const remote = await logisticsRepository.carriers()
    if (remote.length) cache = remote
  } catch {
    // Garde le catalogue local si l’API est indisponible.
  }
  return listCarriers(false)
}

export function listCarriers(activeOnly = true): Carrier[] {
  return cache.filter((item) => (activeOnly ? item.active !== false : true))
}

export function getCarrier(id?: string | null): Carrier | undefined {
  if (!id) return undefined
  return cache.find((item) => item.id === id)
}

export function carrierTrackingUrl(carrier: Carrier | undefined, trackingNumber?: string | null): string | null {
  if (!carrier?.trackingUrlTemplate || !trackingNumber) return null
  return carrier.trackingUrlTemplate.replace('{tracking}', encodeURIComponent(trackingNumber))
}

/** Génère un numéro de suivi local (mock / hors ligne). L’API a son propre booker. */
export function bookTrackingNumber(carrier: Carrier, noteCode: string): string {
  const stamp = Date.now().toString(36).toUpperCase().slice(-6)
  const suffix = noteCode.replace(/[^A-Z0-9]/gi, '').slice(-5).toUpperCase() || 'BL'
  if (carrier.kind === 'own_fleet') return `FLEET-${suffix}-${stamp}`
  return `${carrier.code}-${suffix}-${stamp}`
}
