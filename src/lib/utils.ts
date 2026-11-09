import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat('fr-MA').format(value)
}

export function formatMoney(value: number) {
  return `${formatNumber(value)} MAD`
}

export function formatCompactMoney(value: number) {
  if (Math.abs(value) >= 1_000_000) {
    const millions = value / 1_000_000
    return `${new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: millions >= 10 ? 1 : 2,
      maximumFractionDigits: 2,
    }).format(millions)} M MAD`
  }
  return formatMoney(value)
}

export function warehouseCode(id: string) {
  const slug = id.replace(/^wh-/, '')
  const codes: Record<string, string> = {
    casa: 'CASA',
    rabat: 'RBA',
    marrakech: 'MRK',
    tanger: 'TNG',
  }
  return codes[slug] ?? slug.slice(0, 4).toUpperCase()
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

export function formatTime(value: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function requestCode(id: string, code?: string) {
  if (code) return code
  const digits = id.replace(/\D/g, '') || '0'
  return `DA-2026-${digits.slice(-5).padStart(5, '0')}`
}

export function orderCode(id: string, code?: string) {
  if (code) return code
  const digits = id.replace(/\D/g, '') || '0'
  return `OA-2026-${digits.slice(-5).padStart(5, '0')}`
}

export function receiptCode(id: string, code?: string) {
  if (code) return code
  const digits = id.replace(/\D/g, '') || '0'
  return `BR-2026-${digits.slice(-5).padStart(5, '0')}`
}

export function consultationCode(id: string, code?: string) {
  if (code) return code
  const digits = id.replace(/\D/g, '') || '0'
  return `CS-2026-${digits.slice(-5).padStart(5, '0')}`
}

export function deliveryCode(id: string, code?: string) {
  if (code) return code
  const digits = id.replace(/\D/g, '') || '0'
  return `BL-2026-${digits.slice(-5).padStart(5, '0')}`
}

export function shipmentCode(id: string, code?: string) {
  if (code) return code
  const digits = id.replace(/\D/g, '') || '0'
  return `EX-2026-${digits.slice(-5).padStart(5, '0')}`
}

export function routeCode(id: string, code?: string) {
  if (code) return code
  const digits = id.replace(/\D/g, '') || '0'
  return `TR-2026-${digits.slice(-5).padStart(5, '0')}`
}

export function initials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}
