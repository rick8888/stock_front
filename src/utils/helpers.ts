export function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export function delay(ms = 220): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function clone<T>(value: T): T {
  return structuredClone(value)
}

export function todayIso(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function dateKey(date: Date): string {
  return todayIso(date)
}

export function startOfWeek(date = new Date()): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0)
  const weekday = start.getDay() || 7
  start.setDate(start.getDate() - (weekday - 1))
  return start
}

/** Jour opérationnel (date système). */
export function opsToday(): string {
  return todayIso()
}

/** Jour figé des seeds mock — ne pas utiliser pour la logique ops runtime. */
export const DEMO_TODAY = '2026-08-26'

export function dayKey(iso: string) {
  return iso.slice(0, 10)
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function isoAt(date: Date, hours: number, minutes = 0): string {
  const next = new Date(date)
  next.setHours(hours, minutes, 0, 0)
  return next.toISOString()
}

export function daysUntil(isoDate: string): number {
  const target = new Date(isoDate)
  const now = new Date()
  const a = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  const b = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate())
  return Math.round((b - a) / 86_400_000)
}

export function parseQuantity(text: string): number | null {
  const match = text.match(/(\d+(?:[.,]\d+)?)/)
  if (!match) return null
  return Number(match[1].replace(',', '.'))
}
