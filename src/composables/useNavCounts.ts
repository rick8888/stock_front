import { computed } from 'vue'
import { useDataStore } from '@/stores/data'
import { alertVisibleTo } from '@/services/alert.visibility'
import { useCurrentUser } from './useAuth'

export function useNavCounts() {
  const store = useDataStore()
  const { currentUser } = useCurrentUser()

  const tasks = computed(
    () =>
      store.db.tasks.filter(
        (task) => task.status !== 'done' && (!currentUser.value || task.assigneeId === currentUser.value.id),
      ).length,
  )

  const alerts = computed(() =>
    store.db.alerts.filter((alert) => {
      if (alert.read) return false
      if (!currentUser.value) return false
      return alertVisibleTo(alert, currentUser.value)
    }).length,
  )

  return { tasks, alerts }
}
