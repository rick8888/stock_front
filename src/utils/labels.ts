import type { ShippingNote } from '@/types'
import { getCarrier } from '@/services/carriers.service'
import { assemblePdf, downloadBlob, type PdfLine } from '@/utils/pdf'

export interface PackageLabelInput {
  note: ShippingNote
  warehouseName: string
  issuerName: string
  packageIndex?: number
  packageCount?: number
}

export function shippingNoteLabelFilename(code: string) {
  return `etiquette-${code}`
}

export function buildShippingNoteLabelPdf(input: PackageLabelInput): Blob {
  const { note, warehouseName, issuerName } = input
  const pack = input.packageIndex && input.packageCount ? `${input.packageIndex}/${input.packageCount}` : '1/1'
  const carrier = getCarrier(note.carrierId)
  const lines: PdfLine[] = [
    { text: issuerName, size: 11, bold: true },
    { text: 'ETIQUETTE COLIS', size: 10 },
    { text: '', size: 8 },
    { text: note.code, size: 22, bold: true },
    { text: `Colis ${pack}`, size: 12, bold: true },
    { text: '', size: 8 },
    { text: 'Destinataire', size: 8, bold: true },
    { text: note.client, size: 14, bold: true },
    { text: note.address, size: 11 },
    { text: note.city, size: 11 },
    { text: '', size: 8 },
    { text: 'Expediteur', size: 8, bold: true },
    { text: warehouseName, size: 11 },
  ]
  if (carrier || note.trackingNumber) {
    lines.push({ text: '', size: 8 })
    lines.push({ text: 'Transporteur', size: 8, bold: true })
    lines.push({ text: note.carrierName ?? carrier?.name ?? '—', size: 12, bold: true })
    if (note.trackingNumber) {
      lines.push({ text: `Suivi ${note.trackingNumber}`, size: 11, bold: true })
    }
  }
  lines.push({ text: '', size: 8 })
  lines.push({
    text: `${note.lines.length} ligne(s) · ${note.lines.reduce((sum, line) => sum + line.quantity, 0)} piece(s)`,
    size: 9,
  })
  if (note.notes) {
    lines.push({ text: '', size: 6 })
    lines.push({ text: note.notes, size: 9 })
  }
  return assemblePdf(lines)
}

export function downloadShippingNoteLabel(input: PackageLabelInput) {
  const blob = buildShippingNoteLabelPdf(input)
  downloadBlob(blob, shippingNoteLabelFilename(input.note.code))
}
