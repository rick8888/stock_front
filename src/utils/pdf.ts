/** Générateur PDF 1.4 (A4, Helvetica, Latin-1) — aucun backend. */

const LATIN: Record<string, number> = {
  À: 0xc0, Á: 0xc1, Â: 0xc2, Ä: 0xc4, Ç: 0xc7, È: 0xc8, É: 0xc9, Ê: 0xca, Ë: 0xcb,
  Î: 0xce, Ï: 0xcf, Ô: 0xd4, Ö: 0xd6, Ù: 0xd9, Û: 0xdb, Ü: 0xdc,
  à: 0xe0, á: 0xe1, â: 0xe2, ä: 0xe4, ç: 0xe7, è: 0xe8, é: 0xe9, ê: 0xea, ë: 0xeb,
  î: 0xee, ï: 0xef, ô: 0xf4, ö: 0xf6, ù: 0xf9, û: 0xfb, ü: 0xfc, ÿ: 0xff,
  '°': 0xb0, '«': 0xab, '»': 0xbb, '–': 0x96, '—': 0x97, '’': 0x92, '‘': 0x91,
  '“': 0x93, '”': 0x94, '€': 0x80, '×': 0xd7, '·': 0xb7, Œ: 0x8c, œ: 0x9c,
}

function latin1(value: string) {
  const bytes: number[] = []
  for (const char of value.replace(/œ/g, 'oe').replace(/Œ/g, 'OE')) {
    const code = char.codePointAt(0) ?? 32
    if (code < 128) bytes.push(code)
    else bytes.push(LATIN[char] ?? 63)
  }
  return bytes
}

function pdfString(value: string) {
  const escaped = latin1(value).map((byte) => {
    if (byte === 0x5c) return '\\\\'
    if (byte === 0x28) return '\\('
    if (byte === 0x29) return '\\)'
    if (byte >= 32 && byte < 127) return String.fromCharCode(byte)
    return `\\${byte.toString(8).padStart(3, '0')}`
  })
  return `(${escaped.join('')})`
}

function wrap(text: string, width: number) {
  const words = text.split(/\s+/).filter(Boolean)
  const rows: string[] = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length > width) {
      if (current) rows.push(current)
      current = word
    } else current = next
  }
  if (current) rows.push(current)
  return rows.length ? rows : ['']
}

export type PdfLine = { text: string; size: number; bold?: boolean; x?: number }

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`
  link.click()
  URL.revokeObjectURL(url)
}

export function buildTextPdf(title: string, blocks: string[]): Blob {
  const lines: PdfLine[] = [{ text: title, size: 16, bold: true }]
  blocks.forEach((block) => {
    lines.push({ text: '', size: 10 })
    wrap(block, 92).forEach((row) => lines.push({ text: row, size: 10 }))
  })
  return assemblePdf(lines)
}

export function assemblePdf(content: PdfLine[]): Blob {
  const pageWidth = 595
  const pageHeight = 842
  const margin = 48
  const pages: PdfLine[][] = []
  let bucket: PdfLine[] = []
  let y = pageHeight - margin
  for (const line of content) {
    const step = line.size + 6
    if (y - step < margin) {
      pages.push(bucket)
      bucket = []
      y = pageHeight - margin
    }
    bucket.push(line)
    y -= line.text ? step : 8
  }
  if (bucket.length) pages.push(bucket)
  if (!pages.length) pages.push([{ text: ' ', size: 10 }])

  const objects: string[] = []
  const pageIds: number[] = []
  const fontRegular = 3
  const fontBold = 4
  objects.push('<< /Type /Catalog /Pages 2 0 R >>')
  objects.push('<< /Type /Pages /Kids [] /Count 0 >>')
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>')

  pages.forEach((page) => {
    let cursor = pageHeight - margin
    const ops = ['BT']
    page.forEach((line) => {
      const step = line.text ? line.size + 6 : 8
      const x = line.x ?? margin
      ops.push(`/F${line.bold ? 'B' : 'R'} ${line.size} Tf`)
      ops.push(`1 0 0 1 ${x.toFixed(1)} ${cursor.toFixed(1)} Tm`)
      ops.push(`${pdfString(line.text || ' ')} Tj`)
      cursor -= step
    })
    ops.push('ET')
    const raw = ops.join('\n')
    objects.push(`<< /Length ${raw.length} >>\nstream\n${raw}\nendstream`)
    const contentId = objects.length
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents ${contentId} 0 R /Resources << /Font << /FR ${fontRegular} 0 R /FB ${fontBold} 0 R >> >> >>`,
    )
    pageIds.push(objects.length)
  })

  objects[1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`

  let body = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object, index) => {
    offsets.push(body.length)
    body += `${index + 1} 0 obj\n${object}\nendobj\n`
  })
  const xrefAt = body.length
  const xrefLines = [
    'xref',
    `0 ${objects.length + 1}`,
    '0000000000 65535 f ',
    ...offsets.slice(1).map((off) => `${String(off).padStart(10, '0')} 00000 n `),
  ]
  body += `${xrefLines.join('\n')}\n`
  body += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\n`
  body += `startxref\n${xrefAt}\n%%EOF`
  return new Blob([body], { type: 'application/pdf' })
}
