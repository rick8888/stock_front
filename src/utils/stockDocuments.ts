/** Entrée stock : BR. Sortie : BL, DA interne, EX ou TR. */

const INBOUND = /^(BR)[-:]/i
const OUTBOUND = /^(BL|DA|EX|TR)[-:]/i
const PIECE = /\b((?:DA|OA|BR|BL|EX|TR|PV)-[A-Z0-9-]+)/i

export function extractPieceCode(...values: Array<string | undefined>) {
  for (const value of values) {
    const match = value?.match(PIECE)
    if (match) return match[1].toUpperCase()
  }
  return ''
}

export function assertInboundDocument(reference?: string, note?: string) {
  const code = extractPieceCode(reference, note)
  if (!code || !INBOUND.test(code)) {
    throw new Error('Entrée de stock uniquement via un bon de réception (BR).')
  }
  return code
}

export function assertOutboundDocument(reference?: string, note?: string) {
  const code = extractPieceCode(reference, note)
  if (!code || !OUTBOUND.test(code)) {
    throw new Error('Sortie de stock uniquement via un BL, une tournée, une expédition ou une DA interne.')
  }
  return code
}

export function assertInventoryAdjust(reference?: string, note?: string) {
  const code = extractPieceCode(reference, note)
  if (code && /^PV-/i.test(code)) return code
  if (reference?.startsWith('inv-') || note?.toLowerCase().includes('inventaire')) {
    return reference || code || 'PV'
  }
  throw new Error('Ajustement uniquement après validation d’un inventaire.')
}
