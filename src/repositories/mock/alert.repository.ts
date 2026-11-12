import type {
  AlertRepository,
  NotificationRepository,
  PlanningBoardQuery,
  PlanningRepository,
} from '@/repositories/interfaces'
import { db, mutate, withLatency } from './db'
import { buildPlanningBoard, buildPlanningEvents } from '@/services/planning.build'
import { useAuthStore } from '@/stores/auth'

export class MockAlertRepository implements AlertRepository {
  list() {
    return withLatency(() => db().alerts)
  }

  markRead(id: string) {
    return mutate(() => {
      const alert = db().alerts.find((item) => item.id === id)
      if (alert) alert.read = true
    })
  }
}

export class MockNotificationRepository implements NotificationRepository {
  list() {
    return withLatency(() => {
      const userId = useAuthStore().currentUser?.id
      return db().notifications.filter((item) => !item.userId || item.userId === userId)
    })
  }

  markRead(id: string) {
    return mutate(() => {
      const row = db().notifications.find((item) => item.id === id)
      if (row) row.read = true
    })
  }

  markAllRead() {
    return mutate(() => {
      const userId = useAuthStore().currentUser?.id
      let marked = 0
      db().notifications.forEach((item) => {
        if ((!item.userId || item.userId === userId) && !item.read) {
          item.read = true
          marked += 1
        }
      })
      return { marked }
    })
  }
}

export class MockPlanningRepository implements PlanningRepository {
  list() {
    return withLatency(() => buildPlanningEvents(db(), useAuthStore().currentUser?.role))
  }

  board(query: PlanningBoardQuery = {}) {
    return withLatency(() =>
      buildPlanningBoard(db(), {
        ...query,
        role: useAuthStore().currentUser?.role,
      }),
    )
  }
}
