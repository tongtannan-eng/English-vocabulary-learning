export interface StorageWrite {
  storage: Storage
  key: string
  value: string
}
export function writeTransaction(
  writes: StorageWrite[],
): { ok: true } | { error: 'read' | 'write' | 'rollback' } {
  let snapshot: (StorageWrite & { before: string | null })[]
  try {
    snapshot = writes.map((item) => ({ ...item, before: item.storage.getItem(item.key) }))
  } catch {
    return { error: 'read' }
  }
  const written: typeof snapshot = []
  try {
    for (const item of snapshot) {
      item.storage.setItem(item.key, item.value)
      written.push(item)
    }
  } catch {
    let failed = false
    for (const item of written.reverse()) {
      try {
        if (item.before === null) item.storage.removeItem(item.key)
        else item.storage.setItem(item.key, item.before)
      } catch {
        failed = true
      }
    }
    return { error: failed ? 'rollback' : 'write' }
  }
  return { ok: true }
}
