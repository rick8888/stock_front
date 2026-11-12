import { emitDataChanged } from '@/utils/events'

const OUTBOX_KEY = 'bravo-stock-offline-outbox'
const CACHE_KEY = 'bravo-stock-offline-cache'

export type OutboxEntry = {
  id: string
  path: string
  method: string
  body?: string
  createdAt: string
  label: string
  optimistic?: unknown
}

type CacheBucket = Record<string, { at: string; payload: unknown }>

function readOutbox(): OutboxEntry[] {
  try {
    const raw = localStorage.getItem(OUTBOX_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as OutboxEntry[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeOutbox(entries: OutboxEntry[]) {
  localStorage.setItem(OUTBOX_KEY, JSON.stringify(entries))
  emitDataChanged()
}

function readCache(): CacheBucket {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as CacheBucket
  } catch {
    return {}
  }
}

function writeCache(bucket: CacheBucket) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(bucket))
}

export function isOnline() {
  return typeof navigator === 'undefined' ? true : navigator.onLine
}

export function listOutbox() {
  return readOutbox()
}

export function outboxCount() {
  return readOutbox().length
}

export function enqueueOutbox(input: Omit<OutboxEntry, 'id' | 'createdAt'>) {
  const entries = readOutbox()
  const entry: OutboxEntry = {
    ...input,
    id: `obx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
  }
  entries.push(entry)
  writeOutbox(entries)
  return entry
}

export function removeOutbox(id: string) {
  writeOutbox(readOutbox().filter((item) => item.id !== id))
}

export function clearOutbox() {
  writeOutbox([])
}

export function cacheGet<T>(path: string): T | null {
  const hit = readCache()[path]
  return (hit?.payload as T) ?? null
}

export function cacheSet(path: string, payload: unknown) {
  const bucket = readCache()
  bucket[path] = { at: new Date().toISOString(), payload }
  // keep cache bounded
  const keys = Object.keys(bucket)
  if (keys.length > 80) {
    keys
      .sort((a, b) => (bucket[a].at < bucket[b].at ? -1 : 1))
      .slice(0, keys.length - 80)
      .forEach((key) => delete bucket[key])
  }
  writeCache(bucket)
}

/** Mutations that can be deferred while offline. */
export function canQueueMutation(method: string, path: string) {
  if (method === 'GET' || method === 'HEAD') return false
  if (/^\/deliveries\/[^/]+\/status$/.test(path)) return true
  if (/^\/stock\/inventories\/[^/]+$/.test(path) && method === 'PATCH') return true
  if (/^\/tasks\/[^/]+$/.test(path) && method === 'PATCH') return true
  return false
}

/** GETs worth serving from cache when offline. */
export function canServeFromCache(method: string, path: string) {
  if (method !== 'GET') return false
  const base = path.split('?')[0]
  return [
    '/deliveries',
    '/routes',
    '/shipments',
    '/shipping-notes',
    '/stock',
    '/stock/overview',
    '/procurement/board',
    '/procurement/sourcing',
    '/logistics/board',
    '/stock/lots',
    '/stock/placements',
    '/stock/movements',
    '/stock/inventories',
    '/tasks',
    '/alerts',
    '/notifications',
    '/products',
    '/warehouses',
    '/auth/me',
  ].some((prefix) => base === prefix || base.startsWith(`${prefix}/`))
}

export function mutationLabel(method: string, path: string, body?: string) {
  if (/\/deliveries\/[^/]+\/status$/.test(path)) {
    try {
      const payload = body ? (JSON.parse(body) as { status?: string }) : {}
      if (payload.status === 'delivered') return 'Preuve de livraison'
      if (payload.status === 'failed') return 'Échec de livraison'
      return 'Statut livraison'
    } catch {
      return 'Statut livraison'
    }
  }
  if (/\/stock\/inventories\//.test(path)) return 'Sauvegarde inventaire'
  if (/\/tasks\//.test(path)) return 'Mise à jour tâche'
  return `${method} ${path}`
}

export function optimisticDeliveryFromBody(path: string, body?: string) {
  const match = path.match(/^\/deliveries\/([^/]+)\/status$/)
  if (!match || !body) return undefined
  try {
    const payload = JSON.parse(body) as {
      status?: string
      note?: string
      signedBy?: string
      signatureDataUrl?: string
      lat?: number
      lng?: number
      signedAt?: string
    }
    return {
      id: match[1],
      status: payload.status,
      note: payload.note,
      signedBy: payload.signedBy,
      signatureDataUrl: payload.signatureDataUrl,
      signedAt: payload.signedAt ?? new Date().toISOString(),
      proofLat: payload.lat,
      proofLng: payload.lng,
      _offlineQueued: true,
    }
  } catch {
    return { id: match[1], _offlineQueued: true }
  }
}

export function optimisticInventoryFromBody(path: string, body?: string) {
  const match = path.match(/^\/stock\/inventories\/([^/]+)$/)
  if (!match) return undefined
  const cached = cacheGet<Array<{ id: string } & Record<string, unknown>>>('/stock/inventories')
  const current = Array.isArray(cached) ? cached.find((row) => row.id === match[1]) : null
  let lines: unknown[] | undefined
  try {
    const payload = body ? (JSON.parse(body) as { lines?: unknown[] }) : {}
    lines = payload.lines
  } catch {
    lines = undefined
  }
  return {
    ...(current ?? { id: match[1], warehouseId: '', status: 'in_progress', counted: 0, expected: 0, startedAt: new Date().toISOString(), lines: [] }),
    id: match[1],
    lines: lines ?? (current as { lines?: unknown[] } | null)?.lines ?? [],
    counted: Array.isArray(lines)
      ? lines.reduce<number>((sum, line) => {
          const counted =
            line && typeof line === 'object' && 'counted' in line
              ? Number((line as { counted: number }).counted) || 0
              : 0
          return sum + counted
        }, 0)
      : (current as { counted?: number } | null)?.counted ?? 0,
    _offlineQueued: true,
  }
}

export function patchCachedList(path: string, id: string, patch: Record<string, unknown>) {
  const cached = cacheGet<unknown>(path)
  if (!Array.isArray(cached)) return
  const next = cached.map((row) => {
    if (!row || typeof row !== 'object' || !('id' in row)) return row
    if ((row as { id: string }).id !== id) return row
    return { ...row, ...patch }
  })
  cacheSet(path, next)
}
