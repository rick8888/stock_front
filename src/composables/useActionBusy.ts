import { computed, provide, ref } from 'vue'

export const ACTION_BUSY_KEY = 'actionBusy'

const pending = ref(0)
const locked = ref(false)
const target = ref<string | null>(null)
const busy = computed(() => pending.value > 0 || locked.value)

export function beginAction(id?: string) {
  pending.value += 1
  if (id) target.value = id
}

export function endAction() {
  pending.value = Math.max(0, pending.value - 1)
  if (pending.value === 0 && !locked.value) target.value = null
}

export function useGlobalBusy() {
  return { busy, target, pending }
}

export function useActionBusy() {
  provide(ACTION_BUSY_KEY, busy)

  async function run<T>(action: () => Promise<T>, id?: string): Promise<T | undefined> {
    if (locked.value || pending.value > 0) return
    locked.value = true
    if (id) target.value = id
    try {
      return await action()
    } finally {
      locked.value = false
      if (pending.value === 0) target.value = null
    }
  }

  function isBusy(id: string) {
    return busy.value && target.value === id
  }

  return { busy, target, run, isBusy }
}
