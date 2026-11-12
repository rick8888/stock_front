import type { MockDatabase, PlanningEvent, RoleKey } from '@/types'
import { addDays, dateKey, opsToday, rebaseDemoIso, startOfWeek, todayIso } from '@/utils/helpers'
import type { PlanningBoard } from '@/repositories/interfaces'

function withTime(date: string, time: string) {
  return date.length > 10 ? date : `${date || todayIso()}T${time}`
}

function visibleToRole(event: PlanningEvent, role?: RoleKey | string | null) {
  if (!role) return true
  if (role === 'DRIVER') return event.type === 'delivery'
  if (role === 'FINANCE') return event.type === 'meeting' || event.type === 'receipt'
  if (role === 'DISPATCHER') return event.type === 'delivery' || event.type === 'task'
  if (role === 'PROCUREMENT') return event.type !== 'inventory'
  return true
}

export function buildPlanningEvents(db: MockDatabase, role?: RoleKey | string | null): PlanningEvent[] {
  const stored: PlanningEvent[] = db.planning.map((event) => ({
    ...event,
    date: rebaseDemoIso(event.date) ?? event.date,
  }))

  const generated: PlanningEvent[] = [
    ...db.routes.map((route) => ({
      id: `pl-route-${route.id}`,
      title: route.name,
      date: withTime(rebaseDemoIso(route.date) ?? route.date, '08:00:00'),
      type: 'delivery' as const,
      relatedId: route.id,
    })),
    ...db.deliveries.map((delivery) => ({
      id: `pl-dlv-${delivery.id}`,
      title: delivery.client,
      date: rebaseDemoIso(delivery.scheduledAt) ?? delivery.scheduledAt,
      type: 'delivery' as const,
      relatedId: delivery.id,
    })),
    ...db.receipts
      .filter((receipt) => receipt.status !== 'validated')
      .map((receipt) => ({
        id: `pl-rcp-${receipt.id}`,
        title: receipt.code ?? 'Réception',
        date: rebaseDemoIso(receipt.date) ?? receipt.date,
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
          date: rebaseDemoIso(session.startedAt) ?? session.startedAt,
          type: 'inventory' as const,
          relatedId: session.id,
        }
      }),
    ...db.tasks
      .filter((task) => task.status !== 'done')
      .map((task) => ({
        id: `pl-tsk-${task.id}`,
        title: task.title,
        date: rebaseDemoIso(task.dueAt) ?? task.dueAt,
        type: 'task' as const,
        relatedId: task.id,
      })),
  ]

  const seen = new Set<string>()
  const merged: PlanningEvent[] = []
  for (const event of [...stored, ...generated]) {
    const key = `${event.type}|${event.relatedId ?? event.id}`
    if (seen.has(key)) continue
    if (!visibleToRole(event, role)) continue
    seen.add(key)
    merged.push(event)
  }
  return merged.sort((a, b) => a.date.localeCompare(b.date))
}

export function buildPlanningBoard(
  db: MockDatabase,
  options: { weekOffset?: number; day?: string | null; type?: string | null; role?: RoleKey | string | null } = {},
): PlanningBoard {
  const today = opsToday()
  const weekOffset = options.weekOffset ?? 0
  const type = options.type && options.type !== '' ? options.type : 'all'
  const events = buildPlanningEvents(db, options.role)

  const monday = addDays(startOfWeek(new Date()), weekOffset * 7)
  const weekKeys = Array.from({ length: 7 }, (_, index) => dateKey(addDays(monday, index)))

  const selectedDay =
    options.day && weekKeys.includes(options.day)
      ? options.day
      : weekKeys.includes(today)
        ? today
        : (weekKeys[0] ?? today)

  const byDay: Record<string, number> = Object.fromEntries(weekKeys.map((key) => [key, 0]))
  const typeCounts: Record<string, number> = {}
  let todayCount = 0
  let nextCount = 0

  for (const event of events) {
    const key = event.date.slice(0, 10)
    typeCounts[event.type] = (typeCounts[event.type] ?? 0) + 1
    if (key === today) todayCount += 1
    if (key > today) nextCount += 1
    if (key in byDay) byDay[key] += 1
  }

  const weekDays = weekKeys.map((key) => ({
    key,
    count: byDay[key] ?? 0,
    isToday: key === today,
  }))

  const types: PlanningBoard['types'] = [{ id: 'all', count: events.length }]
  for (const id of ['delivery', 'receipt', 'inventory', 'meeting', 'task'] as const) {
    if ((typeCounts[id] ?? 0) > 0) types.push({ id, count: typeCounts[id] })
  }

  const filtered = events.filter((event) => type === 'all' || event.type === type)
  const dayEvents = filtered.filter((event) => event.date.slice(0, 10) === selectedDay)
  const upcoming = filtered.filter((event) => event.date.slice(0, 10) >= today).slice(0, 6)

  return {
    today,
    selectedDay,
    weekOffset,
    type,
    counts: {
      today: todayCount,
      week: weekKeys.reduce((sum, key) => sum + (byDay[key] ?? 0), 0),
      next: nextCount,
    },
    weekDays,
    types,
    dayEvents,
    upcoming,
    events,
  }
}
