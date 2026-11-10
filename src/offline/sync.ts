import { apiConfig } from '@/config/api'
import { getAccessToken } from '@/services/http/http.client'
import { listOutbox, removeOutbox, isOnline } from '@/offline/outbox'
import { emitDataChanged } from '@/utils/events'

let syncing = false

export function isSyncing() {
  return syncing
}

export async function flushOutbox() {
  if (!apiConfig.useApi || !isOnline() || syncing) return { sent: 0, failed: 0 }
  syncing = true
  let sent = 0
  let failed = 0
  try {
    const entries = listOutbox()
    for (const entry of entries) {
      try {
        const headers = new Headers({ Accept: 'application/json' })
        if (entry.body) headers.set('Content-Type', 'application/json')
        const token = getAccessToken()
        if (token) headers.set('Authorization', `Bearer ${token}`)
        const response = await fetch(`${apiConfig.baseUrl}${entry.path}`, {
          method: entry.method,
          headers,
          body: entry.body,
        })
        if (!response.ok && response.status !== 204) {
          failed += 1
          continue
        }
        removeOutbox(entry.id)
        sent += 1
      } catch {
        failed += 1
        break
      }
    }
    if (sent) emitDataChanged()
    return { sent, failed }
  } finally {
    syncing = false
  }
}

export function startOfflineSyncWatch() {
  if (typeof window === 'undefined') return () => undefined
  const onOnline = () => {
    void flushOutbox()
  }
  window.addEventListener('online', onOnline)
  window.addEventListener('focus', onOnline)
  return () => {
    window.removeEventListener('online', onOnline)
    window.removeEventListener('focus', onOnline)
  }
}
