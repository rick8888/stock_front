import { computed } from 'vue'
import { apiConfig } from '@/config/api'
import { useDataStore } from '@/stores/data'
import { alertVisibleTo } from '@/services/alert.visibility'
import { useAsyncList } from './useAsyncList'
import { useCurrentUser } from './useAuth'
import { alertService, taskService } from '@/services/task.service'

/**
 * Badges sidebar : en mode API, compteurs depuis le backend (pas le seed localStorage).
 */
export function useNavCounts() {
  const store = useDataStore()
  const { currentUser } = useCurrentUser()

  const apiBoard = useAsyncList(async () => [await taskService.board()])
  const apiAlerts = useAsyncList(() => alertService.list(currentUser.value))

  const tasks = computed(() => {
    if (apiConfig.useApi) {
      return apiBoard.data.value[0]?.counts.open ?? 0
    }
    return store.db.tasks.filter(
      (task) => task.status !== 'done' && (!currentUser.value || task.assigneeId === currentUser.value.id),
    ).length
  })

  const alerts = computed(() => {
    if (apiConfig.useApi) {
      return apiAlerts.data.value.filter((alert) => !alert.read).length
    }
    return store.db.alerts.filter((alert) => {
      if (alert.read) return false
      if (!currentUser.value) return false
      return alertVisibleTo(alert, currentUser.value)
    }).length
  })

  return { tasks, alerts }
}
