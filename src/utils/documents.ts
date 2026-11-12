import type { Company } from '@/types'
import { assemblePdf, downloadBlob, type PdfLine } from '@/utils/pdf'

export interface DocContact {
  label: string
  phone: string
  hint?: string
}

export interface DocLine {
  name: string
  sku?: string
  qty: string
  detail?: string
}

export interface DocParty {
  title: string
  name: string
  detail?: string
}

export interface OfficialDocPayload {
  title: string
  code: string
  date: string
  issuerName: string
  issuerLegal?: string
  issuerIce?: string
  issuerCity?: string
  issuerPhone?: string
  issuerEmail?: string
  parties?: DocParty[]
  lines: DocLine[]
  totalLabel?: string
  notes?: string
  signatures?: { label: string; name?: string }[]
}

let registeredDoc: OfficialDocPayload | null = null
let lastPdf: { blob: Blob; filename: string } | null = null

export function registerOfficialDoc(doc: OfficialDocPayload | null) {
  registeredDoc = doc
}

export function currentOfficialDoc() {
  return registeredDoc
}

export function lastGeneratedPdf() {
  return lastPdf
}

export function whatsappDigits(phone: string) {
  return phone.replace(/\D/g, '')
}

export function whatsappHref(phone: string, text: string) {
  const digits = whatsappDigits(phone)
  if (!digits) return ''
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}

export function printPdf(filename: string) {
  const previous = document.title
  document.title = filename
  window.print()
  window.setTimeout(() => {
    document.title = previous
  }, 400)
}

function pdfLines(doc: OfficialDocPayload): PdfLine[] {
  const rows: PdfLine[] = [
    { text: doc.issuerName, size: 14, bold: true },
  ]
  if (doc.issuerLegal && doc.issuerLegal !== doc.issuerName) {
    rows.push({ text: doc.issuerLegal, size: 9 })
  }
  const meta = [
    doc.issuerIce ? `ICE ${doc.issuerIce}` : '',
    doc.issuerCity,
    doc.issuerPhone,
    doc.issuerEmail,
  ]
    .filter(Boolean)
    .join('  ·  ')
  if (meta) rows.push({ text: meta, size: 9 })
  rows.push({ text: '', size: 10 })
  rows.push({ text: doc.title, size: 11, bold: true })
  rows.push({ text: doc.code, size: 16, bold: true })
  if (doc.date) rows.push({ text: doc.date, size: 9 })
  rows.push({ text: '', size: 10 })
  for (const party of doc.parties ?? []) {
    rows.push({ text: party.title, size: 8, bold: true })
    rows.push({ text: party.name, size: 11 })
    if (party.detail) rows.push({ text: party.detail, size: 9 })
    rows.push({ text: '', size: 8 })
  }
  rows.push({ text: 'Désignation                                          Qté / détail', size: 8, bold: true })
  for (const line of doc.lines) {
    const left = line.sku ? `${line.name} (${line.sku})` : line.name
    rows.push({ text: `${left}    ${line.qty}`, size: 10 })
    if (line.detail) rows.push({ text: line.detail, size: 8 })
  }
  if (doc.totalLabel) {
    rows.push({ text: '', size: 8 })
    rows.push({ text: doc.totalLabel, size: 11, bold: true })
  }
  if (doc.notes) {
    rows.push({ text: '', size: 8 })
    rows.push({ text: doc.notes, size: 9 })
  }
  if (doc.signatures?.length) {
    rows.push({ text: '', size: 10 })
    for (const item of doc.signatures) {
      rows.push({ text: `${item.label} : ${item.name || '________________'}`, size: 10 })
    }
  }
  rows.push({ text: '', size: 12 })
  rows.push({ text: 'Document BravoStock — pièce officielle.', size: 8 })
  return rows
}

export function buildOfficialPdf(doc: OfficialDocPayload) {
  return assemblePdf(pdfLines(doc))
}

export function downloadOfficialPdf(filename: string, doc = registeredDoc) {
  const name = filename.endsWith('.pdf') ? filename : `${filename}.pdf`
  if (!doc) {
    printPdf(filename)
    return null
  }
  const blob = buildOfficialPdf(doc)
  lastPdf = { blob, filename: name }
  downloadBlob(blob, name)
  return lastPdf
}

export async function shareOfficialPdf(input: { phone: string; message: string; filename: string }) {
  const prepared = lastPdf ?? downloadOfficialPdf(input.filename)
  const href = whatsappHref(input.phone, input.message)
  if (prepared && typeof navigator.canShare === 'function') {
    const file = new File([prepared.blob], prepared.filename, { type: 'application/pdf' })
    if (navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: input.filename,
        text: input.message,
      })
      return
    }
  }
  if (href) window.open(href, '_blank', 'noopener')
}

export function issuerBlock(company?: Company | null) {
  if (!company) {
    return {
      name: 'BravoStock',
      legalName: 'BravoStock',
      ice: '',
      city: '',
      email: '',
      phone: '',
    }
  }
  return {
    name: company.name,
    legalName: company.legalName,
    ice: company.ice,
    city: company.city,
    email: company.email,
    phone: company.phone,
  }
}

export function documentWhatsAppMessage(input: {
  title: string
  code: string
  issuer: string
  lines: string[]
  footer?: string
}) {
  const body = input.lines.filter(Boolean).join('\n')
  return [
    `*${input.issuer}*`,
    `${input.title} ${input.code}`,
    '',
    body,
    '',
    input.footer ?? 'Le PDF vient d’être téléchargé — joignez-le à ce message WhatsApp.',
  ].join('\n')
}
