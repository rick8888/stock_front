import type { MockDatabase } from '@/types'
import { useDataStore } from '@/stores/data'
import { delay } from '@/utils/helpers'
import { beginAction, endAction } from '@/composables/useActionBusy'

export function db(): MockDatabase {
  return useDataStore().db
}

export function persist(): void {
  useDataStore().persist()
}

export async function withLatency<T>(fn: () => T, ms = 200): Promise<T> {
  await delay(ms)
  return fn()
}

export async function mutate<T>(fn: () => T): Promise<T> {
  beginAction()
  try {
    await delay(180)
    const result = fn()
    persist()
    return result
  } finally {
    endAction()
  }
}
