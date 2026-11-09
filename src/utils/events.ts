type Handler = () => void

const listeners = new Set<Handler>()

export function onDataChanged(handler: Handler): () => void {
  listeners.add(handler)
  return () => listeners.delete(handler)
}

export function emitDataChanged(): void {
  listeners.forEach((handler) => handler())
}
