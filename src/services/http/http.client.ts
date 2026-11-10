import { apiConfig } from '@/config/api'
import { beginAction, endAction } from '@/composables/useActionBusy'
import {
  cacheGet,
  cacheSet,
  canQueueMutation,
  canServeFromCache,
  enqueueOutbox,
  isOnline,
  mutationLabel,
  optimisticDeliveryFromBody,
  optimisticInventoryFromBody,
  patchCachedList,
} from '@/offline/outbox'

const TOKEN_KEY = 'bravo-stock-access-token'

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setAccessToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export function tokenFromPayload(payload: { access_token?: string; accessToken?: string } | null | undefined): string | null {
  return payload?.access_token || payload?.accessToken || null
}

function pathOnly(path: string) {
  return path.startsWith('http') ? new URL(path).pathname.replace(/^\/api/, '') : path
}

function applyOptimisticLocalCache(path: string, optimistic: unknown) {
  if (!optimistic || typeof optimistic !== 'object' || !('id' in optimistic)) return
  const id = String((optimistic as { id: string }).id)
  if (/^\/deliveries\//.test(path)) {
    patchCachedList('/deliveries', id, optimistic as Record<string, unknown>)
  }
  if (/^\/stock\/inventories\//.test(path)) {
    patchCachedList('/stock/inventories', id, optimistic as Record<string, unknown>)
  }
}

function buildOptimistic(path: string, body?: string) {
  return optimisticDeliveryFromBody(path, body) ?? optimisticInventoryFromBody(path, body)
}

export const httpClient = {
  async request<T>(path: string, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers)
    headers.set('Accept', 'application/json')
    if (init?.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }
    const token = getAccessToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)

    const method = (init?.method ?? 'GET').toUpperCase()
    const isMutation = method !== 'GET' && method !== 'HEAD'
    const cleanPath = pathOnly(path)
    const bodyText = typeof init?.body === 'string' ? init.body : undefined

    if (isMutation && !isOnline() && canQueueMutation(method, cleanPath)) {
      const optimistic = buildOptimistic(cleanPath, bodyText)
      const entry = enqueueOutbox({
        path: cleanPath,
        method,
        body: bodyText,
        label: mutationLabel(method, cleanPath, bodyText),
        optimistic,
      })
      applyOptimisticLocalCache(cleanPath, entry.optimistic)
      return (entry.optimistic ?? { queued: true, id: entry.id }) as T
    }

    if (isMutation) beginAction()
    try {
      const response = await fetch(`${apiConfig.baseUrl}${path}`, { ...init, headers })

      if (response.status === 204) return undefined as T

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        const message =
          typeof payload.message === 'string' && payload.message
            ? payload.message
            : `Erreur ${response.status}`
        throw new ApiError(message, response.status)
      }

      if (!isMutation && canServeFromCache(method, cleanPath)) {
        cacheSet(cleanPath, payload)
      }

      return payload as T
    } catch (err) {
      if (err instanceof ApiError) throw err

      if (isMutation && canQueueMutation(method, cleanPath)) {
        const optimistic = buildOptimistic(cleanPath, bodyText)
        const entry = enqueueOutbox({
          path: cleanPath,
          method,
          body: bodyText,
          label: mutationLabel(method, cleanPath, bodyText),
          optimistic,
        })
        applyOptimisticLocalCache(cleanPath, entry.optimistic)
        return (entry.optimistic ?? { queued: true, id: entry.id }) as T
      }

      if (!isMutation && canServeFromCache(method, cleanPath)) {
        const cached = cacheGet<T>(cleanPath)
        if (cached !== null) return cached
      }

      throw new ApiError(isOnline() ? 'Réseau indisponible' : 'Hors ligne', 0)
    } finally {
      if (isMutation) endAction()
    }
  },
}
