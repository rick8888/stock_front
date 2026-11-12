import type { TodayBrief } from '@/services/today.service'
import type { TodayRepository } from '@/repositories/interfaces'
import { alertVisibleTo, alertHref } from '@/services/alert.visibility'
import { buildPlanningBoard } from '@/services/planning.build'
import { buildStockOverviewBoard } from '@/services/stock.overview'
import { opsToday, rebaseDemoIso } from '@/utils/helpers'
import { db, withLatency } from './db'
import { useAuthStore } from '@/stores/auth'

/**
 * Mode mock = « backend local ». Le calcul reste ici, pas dans les pages Vue.
 */
export class MockTodayRepository implements TodayRepository {
  brief() {
    return withLatency((): TodayBrief => {
      const user = useAuthStore().currentUser
      if (!user) {
        return emptyBrief()
      }
      const warehouseIds = user.warehouseIds
      const alerts = db()
        .alerts.filter((alert) => alertVisibleTo(alert, user))
        .filter((alert) => !alert.read)
        .sort((a, b) => {
          const rank = { critical: 0, warning: 1, info: 2 }
          return rank[a.severity] - rank[b.severity] || b.createdAt.localeCompare(a.createdAt)
        })

      const queue = alerts.map((alert) => ({
        id: `alert-${alert.id}`,
        title: alert.title,
        detail: alert.message,
        tone: alert.severity,
        primaryLabel: 'Traiter' as const,
        primaryTo: alertHref(alert, user.role),
      }))

      const criticalAlerts = queue.filter((item) => item.tone === 'critical').length
      const tasks = db()
        .tasks.filter((task) => task.assigneeId === user.id && task.status !== 'done')
        .map((task) => ({
          ...task,
          dueAt: rebaseDemoIso(task.dueAt) ?? task.dueAt,
        }))
        .sort((a, b) => a.dueAt.localeCompare(b.dueAt))

      const stockBoard = buildStockOverviewBoard(db(), warehouseIds.length ? warehouseIds : undefined)
      const risks = stockBoard.rows
        .filter((row) => row.days <= 7 || row.available < row.minStock)
        .map((row) => ({
          productId: row.productId,
          warehouseId: row.warehouseId,
          productName: row.productName,
          warehouseName: row.warehouseName,
          quantity: row.available,
          days: Math.max(1, row.days),
          tone: (row.status === 'critical' ? 'critical' : 'warning') as 'critical' | 'warning' | 'info',
        }))

      const criticalStockCount = risks.filter((row) => row.tone === 'critical').length
      const displayed = queue.slice(0, 14)
      const today = opsToday()
      const agenda = buildPlanningBoard(db(), { day: today, type: 'all', role: user.role }).dayEvents

      return {
        queue: displayed,
        toHandle: displayed,
        toWatch: [],
        recommendations: [],
        tasks: tasks.slice(0, 5),
        activity: [],
        watchStock: risks.slice(0, 4),
        agenda,
        prompts: [],
        unreadAlerts: alerts.length,
        criticalAlerts,
        openTasksCount: tasks.length,
        criticalStockCount,
        actionableCount: queue.length,
        signals: [
          {
            id: 'alerts',
            label: 'Alertes non lues',
            value: alerts.length,
            trend: criticalAlerts ? `${criticalAlerts} critiques` : alerts.length ? 'à traiter' : 'à jour',
            trendUp: !alerts.length,
            tone: criticalAlerts ? 'critical' : alerts.length ? 'warning' : 'success',
          },
          {
            id: 'critical',
            label: 'Critiques',
            value: criticalAlerts,
            trend: 'dans la file ops',
            trendUp: !criticalAlerts,
            tone: criticalAlerts ? 'critical' : 'success',
          },
          {
            id: 'tasks',
            label: 'Tâches ouvertes',
            value: tasks.length,
            trend: 'assignées à vous',
            trendUp: true,
            tone: 'info',
          },
          {
            id: 'stock',
            label: 'Stock ≤ 3 j',
            value: criticalStockCount,
            trend: criticalStockCount ? 'couverture' : 'ok',
            trendUp: !criticalStockCount,
            tone: criticalStockCount ? 'critical' : 'success',
          },
        ],
      }
    })
  }
}

function emptyBrief(): TodayBrief {
  return {
    queue: [],
    toHandle: [],
    toWatch: [],
    recommendations: [],
    tasks: [],
    activity: [],
    watchStock: [],
    agenda: [],
    prompts: [],
    unreadAlerts: 0,
    criticalAlerts: 0,
    openTasksCount: 0,
    criticalStockCount: 0,
    actionableCount: 0,
    signals: [],
  }
}
