import { onMounted, onUnmounted, ref, type Ref } from 'vue'
import { onDataChanged } from '@/utils/events'

export function useAsyncList<T>(loader: () => Promise<T[]>) {
  const data = ref<T[]>([]) as Ref<T[]>
  const loading = ref(true)
  const error = ref<string | null>(null)

  async function refresh(silent = false) {
    if (!silent) loading.value = true
    error.value = null
    try {
      data.value = await loader()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Une erreur est survenue'
    } finally {
      loading.value = false
    }
  }

  let stop: (() => void) | undefined
  onMounted(() => {
    void refresh()
    stop = onDataChanged(() => {
      void refresh(true)
    })
  })
  onUnmounted(() => stop?.())

  return { data, loading, error, refresh }
}
