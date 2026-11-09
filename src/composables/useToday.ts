import { computed, onMounted, onUnmounted, ref } from 'vue'
import { todayService, type TodayBrief } from '@/services/today.service'
import { useCurrentUser } from './useAuth'
import { onDataChanged } from '@/utils/events'

export function useToday() {
  const { currentUser } = useCurrentUser()
  const brief = ref<TodayBrief | null>(null)
  const loading = ref(true)
  const error = ref<string | null>(null)

  async function refresh(silent = false) {
    if (!currentUser.value) return
    if (!silent) loading.value = true
    try {
      brief.value = await todayService.brief(currentUser.value)
      error.value = null
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Impossible de charger la journée'
    } finally {
      loading.value = false
    }
  }

  const greeting = computed(() => {
    const user = currentUser.value
    if (!user) return 'Bonjour'
    return `Bonjour ${user.firstName}`
  })

  let stop: (() => void) | undefined
  onMounted(() => {
    void refresh()
    stop = onDataChanged(() => {
      void refresh(true)
    })
  })
  onUnmounted(() => stop?.())

  return { brief, loading, error, refresh, greeting }
}
