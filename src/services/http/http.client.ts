import { apiConfig } from '@/config/api'
import { beginAction, endAction } from '@/composables/useActionBusy'

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

      return payload as T
    } finally {
      if (isMutation) endAction()
    }
  },
}
