import type { PlanningEvent } from '@/types'
import { addDays, dateKey, DEMO_TODAY, todayIso } from '@/utils/helpers'
import type { MockDatabase } from '@/types'

const DEMO_FROM = '2026-08-20'
const DEMO_TO = '2026-08-31'

function rebaseDemoDate(iso: string): string {
  const key = iso.slice(0, 10)
  if (key < DEMO_FROM || key > DEMO_TO) return iso
  const demo = new Date(`${DEMO_TODAY}T12:00:00`)
  const today = new Date(`${todayIso()}T12:00:00`)
  const days = Math.round((today.getTime() - demo.getTime()) / 86_400_000)
  const hasTime = iso.includes('T')
  const event = new Date(hasTime ? iso : `${iso}T12:00:00`)
  const shifted = addDays(event, days)
  if (!hasTime) return dateKey(shifted)
  const hours = String(shifted.getHours()).padStart(2, '0')
  const minutes = String(shifted.getMinutes()).padStart(2, '0')
  const seconds = String(shifted.getSeconds()).padStart(2, '0')
  return `${dateKey(shifted)}T${hours}:${minutes}:${seconds}`
}

function withTime(date: string, time: string) {
  return date.length > 10 ? date : `${date || todayIso()}T${time}`
}

export function buildPlanningEvents(db: MockDatabase): PlanningEvent[] {
  const stored: PlanningEvent[] = db.planning.map((event) => ({
    ...event,
    date: rebaseDemoDate(event.date),
  }))

  const generated: PlanningEvent[] = [
    ...db.routes.map((route) => ({
      id: `pl-route-${route.id}`,
      title: route.name,
      date: withTime(route.date, '08:00:00'),
      type: 'delivery' as const,
      relatedId: route.id,
    })),
    ...db.deliveries.map((delivery) => ({
      id: `pl-dlv-${delivery.id}`,
      title: delivery.client,
      date: delivery.scheduledAt,
      type: 'delivery' as const,
      relatedId: delivery.id,
    })),
    ...db.receipts
      .filter((receipt) => receipt.status !== 'validated')
      .map((receipt) => ({
        id: `pl-rcp-${receipt.id}`,
        title: receipt.code ?? 'Réception',
        date: receipt.date,
        type: 'receipt' as const,
        relatedId: receipt.id,
      })),
    ...db.inventories
      .filter((session) => session.status !== 'completed')
      .map((session) => {
        const warehouse = db.warehouses.find((item) => item.id === session.warehouseId)?.name ?? 'entrepôt'
        return {
          id: `pl-inv-${session.id}`,
          title: `Inventaire ${warehouse}`,
          date: session.startedAt,
          type: 'inventory' as const,
          relatedId: session.id,
        }
      }),
    ...db.tasks
      .filter((task) => task.status !== 'done')
      .map((task) => ({
        id: `pl-tsk-${task.id}`,
        title: task.title,
        date: task.dueAt,
        type: 'task' as const,
        relatedId: task.id,
      })),
  ]

  const seen = new Set<string>()
  const merged: PlanningEvent[] = []
  for (const event of [...stored, ...generated]) {
    const key = `${event.type}|${event.relatedId ?? event.id}`
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(event)
  }
  return merged.sort((a, b) => a.date.localeCompare(b.date))
}
