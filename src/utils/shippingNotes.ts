import type { ShippingNote } from '@/types'

export function shippingNoteLabel(note: ShippingNote) {
  return `${note.code} · ${note.client} · ${note.city}`
}

export function availableShippingNotes(
  notes: ShippingNote[],
  options: {
    warehouseId?: string
    keepIds?: string[]
    excludeAssignedToOtherDelivery?: string
    excludeAssignedToOtherShipment?: string
  } = {},
) {
  const keep = new Set(options.keepIds?.filter(Boolean) ?? [])
  return notes.filter((note) => {
    if (keep.has(note.id)) return true
    if (options.warehouseId && note.warehouseId !== options.warehouseId) return false
    if (note.status === 'delivered') return false
    if (
      options.excludeAssignedToOtherDelivery !== undefined &&
      note.deliveryId &&
      note.deliveryId !== options.excludeAssignedToOtherDelivery
    ) {
      return false
    }
    if (
      options.excludeAssignedToOtherShipment !== undefined &&
      note.shipmentId &&
      note.shipmentId !== options.excludeAssignedToOtherShipment
    ) {
      return false
    }
    return note.status === 'ready' || note.status === 'picking' || note.status === 'loaded'
  })
}
