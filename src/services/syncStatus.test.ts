import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createBackup } from './backup.ts'
import {
  checkSyncFile,
  loadSyncActivity,
  recordSyncActivity,
  SYNC_REVISION_KEY,
} from './syncStatus.ts'

const values = new Map<string, string>()
beforeEach(() => {
  values.clear()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  })
  vi.stubGlobal('sessionStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} })
  vi.stubGlobal('window', new EventTarget())
})
afterEach(() => vi.unstubAllGlobals())

describe('local sync status', () => {
  it('distinguishes missing, inaccessible, invalid and unrecognized files', async () => {
    const local = createBackup()
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response(null, { status: 404 }))
        .mockResolvedValueOnce(new Response(null, { status: 500 }))
        .mockResolvedValueOnce(new Response('broken', { headers: { 'X-Sync-Revision': 'rev' } }))
        .mockResolvedValueOnce(
          new Response(JSON.stringify(local), { headers: { 'X-Sync-Revision': 'rev' } }),
        ),
    )
    expect(await checkSyncFile(local)).toEqual({ kind: 'missing' })
    expect(await checkSyncFile(local)).toEqual({ kind: 'unavailable' })
    expect(await checkSyncFile(local)).toEqual({ kind: 'invalid' })
    expect(await checkSyncFile(local)).toEqual({
      kind: 'ready',
      fileChanged: true,
      contentDiffers: false,
    })
  })
  it('compares the actual file revision and contents, in both directions', async () => {
    const file = createBackup()
    values.set(SYNC_REVISION_KEY, 'rev')
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation(
          async () => new Response(JSON.stringify(file), { headers: { 'X-Sync-Revision': 'rev' } }),
        ),
    )
    expect(await checkSyncFile(file)).toEqual({
      kind: 'ready',
      fileChanged: false,
      contentDiffers: false,
    })
    const changed = {
      ...file,
      sentences: [{ id: 's', english: 'hello', chinese: '你好', createdAt: 1, updatedAt: 1 }],
    }
    expect(await checkSyncFile(changed)).toEqual({
      kind: 'ready',
      fileChanged: false,
      contentDiffers: true,
    })
    values.set(SYNC_REVISION_KEY, 'old')
    expect(await checkSyncFile(changed)).toEqual({
      kind: 'ready',
      fileChanged: true,
      contentDiffers: true,
    })
  })
  it('records independent local import and export times and tolerates malformed metadata', () => {
    values.set('english-daily-sync-activity', '{')
    expect(loadSyncActivity()).toEqual({})
    expect(recordSyncActivity('importedAt', 100)).toBe(true)
    expect(recordSyncActivity('exportedAt', 200)).toBe(true)
    expect(loadSyncActivity()).toEqual({ importedAt: 100, exportedAt: 200 })
  })
})
