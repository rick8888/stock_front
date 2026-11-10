import { onMounted, onUnmounted, ref } from 'vue'
import { trackingService } from '@/services/tracking.service'
import type { LiveRouteTracking, RouteTrackingSnapshot } from '@/types'

/** Polling des positions des tournées actives pour le dispatch. */
export function useLiveTracking(intervalMs = 20_000) {
  const live = ref<LiveRouteTracking[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  let timer: ReturnType<typeof setInterval> | null = null

  async function refresh() {
    loading.value = true
    try {
      live.value = await trackingService.live()
      error.value = null
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Suivi indisponible'
    } finally {
      loading.value = false
    }
  }

  function start() {
    void refresh()
    if (timer) clearInterval(timer)
    timer = setInterval(() => {
      void refresh()
    }, intervalMs)
  }

  function stop() {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  onMounted(start)
  onUnmounted(stop)

  return { live, loading, error, refresh, start, stop }
}

/** Instantané d'une tournée, avec rechargement périodique tant que la fiche est ouverte. */
export function useRouteTracking(routeId: () => string | null, intervalMs = 15_000) {
  const snapshot = ref<RouteTrackingSnapshot | null>(null)
  const loading = ref(false)
  let timer: ReturnType<typeof setInterval> | null = null

  async function refresh() {
    const id = routeId()
    if (!id) {
      snapshot.value = null
      return
    }
    loading.value = true
    try {
      snapshot.value = await trackingService.route(id)
    } catch {
      // La fiche reste sur les données déjà chargées si le poll échoue.
    } finally {
      loading.value = false
    }
  }

  function start() {
    void refresh()
    if (timer) clearInterval(timer)
    timer = setInterval(() => {
      void refresh()
    }, intervalMs)
  }

  function stop() {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  return { snapshot, loading, refresh, start, stop }
}
