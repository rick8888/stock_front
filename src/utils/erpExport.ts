import { downloadCsv } from '@/utils/csv'
import { getCarrier } from '@/services/carriers.service'
import type { ShippingNote } from '@/types'
import { opsToday } from '@/utils/helpers'

/** Export stub ERP / Excel (CSV UTF-8) des bons de livraison. */
export function exportShippingNotesErpCsv(notes: ShippingNote[], warehouseName: (id: string) => string) {
  const headers = [
    'bl_code',
    'warehouse',
    'client',
    'address',
    'city',
    'status',
    'carrier_code',
    'carrier_name',
    'tracking_number',
    'lines_count',
    'pieces',
    'created_at',
    'loaded_at',
    'external_ref',
  ]
  const rows = notes.map((note) => {
    const carrier = getCarrier(note.carrierId)
    return [
      note.code,
      warehouseName(note.warehouseId),
      note.client,
      note.address,
      note.city,
      note.status,
      carrier?.code ?? '',
      note.carrierName ?? carrier?.name ?? '',
      note.trackingNumber ?? '',
      note.lines.length,
      note.lines.reduce((sum, line) => sum + line.quantity, 0),
      note.createdAt?.slice(0, 19) ?? '',
      note.loadedAt?.slice(0, 19) ?? '',
      note.trackingNumber ? `ERP-${note.trackingNumber}` : note.code,
    ]
  })
  downloadCsv(`bravo-stock-erp-bl-${opsToday()}`, headers, rows)
}
