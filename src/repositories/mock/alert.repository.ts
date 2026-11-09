import type { AlertRepository, PlanningRepository } from '@/repositories/interfaces'
import { db, mutate, withLatency } from './db'
import { buildPlanningEvents } from '@/services/planning.build'

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

export class MockPlanningRepository implements PlanningRepository {
  list() {
    return withLatency(() => buildPlanningEvents(db()))
  }
}
