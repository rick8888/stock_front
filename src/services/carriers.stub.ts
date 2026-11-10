import { carriers as catalog } from '@/mocks/carriers'
import type { Carrier } from '@/types'

export function listCarriers(activeOnly = true): Carrier[] {
  return catalog.filter((item) => (activeOnly ? item.active !== false : true))
}

export function getCarrier(id?: string | null): Carrier | undefined {
  if (!id) return undefined
  return catalog.find((item) => item.id === id)
}

export function carrierTrackingUrl(carrier: Carrier | undefined, trackingNumber?: string | null): string | null {
  if (!carrier?.trackingUrlTemplate || !trackingNumber) return null
  return carrier.trackingUrlTemplate.replace('{tracking}', encodeURIComponent(trackingNumber))
}

/** Génère un numéro de suivi stub (format transporteur-like). */
export function bookTrackingNumber(carrier: Carrier, noteCode: string): string {
  const stamp = Date.now().toString(36).toUpperCase().slice(-6)
  const suffix = noteCode.replace(/[^A-Z0-9]/gi, '').slice(-5).toUpperCase() || 'BL'
  if (carrier.kind === 'own_fleet') return `FLEET-${suffix}-${stamp}`
  return `${carrier.code}-${suffix}-${stamp}`
}
