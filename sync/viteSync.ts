import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'

// Only this file is exposed; no browser-supplied path is ever used.
const SYNC_FILE = resolve(process.cwd(), 'sync/english-sync.json')
const MAX_BYTES = 20 * 1024 * 1024
const digest = (text: string) => createHash('sha256').update(text).digest('hex')
let writing = false

export function localSync(): Plugin {
  return {
    name: 'local-git-sync',
    configureServer(server) {
      server.middlewares.use(handler)
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler)
    },
  }
}

async function handler(req: IncomingMessage, res: ServerResponse, next: () => void) {
  if (req.url?.split('?')[0] === '/sync/english-sync.json') {
    res.writeHead(404).end()
    return
  }
  if (req.url !== '/__local_sync') return next()
  const host = req.headers.host ?? ''
  const origin = req.headers.origin
  const remote = req.socket.remoteAddress
  if (
    !/^(localhost|127\.0\.0\.1|\[::1\]):\d+$/.test(host) ||
    !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote ?? '') ||
    (origin && origin !== `http://${host}` && origin !== `https://${host}`) ||
    (req.headers['sec-fetch-site'] && req.headers['sec-fetch-site'] !== 'same-origin')
  ) {
    res.writeHead(403).end()
    return
  }
  res.setHeader('Cache-Control', 'no-store')
  try {
    let current: string | null
    try {
      current = await readFile(SYNC_FILE, 'utf8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      current = null
    }
    if (req.method === 'GET') {
      if (current === null) {
        res.writeHead(404).end()
        return
      }
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader('X-Sync-Revision', digest(current))
      res.end(current)
      return
    }
    if (req.method !== 'PUT' || !origin || req.headers['content-type'] !== 'application/json') {
      res.writeHead(405).end()
      return
    }
    const chunks: Buffer[] = []
    let size = 0
    for await (const chunk of req) {
      const data = Buffer.from(chunk)
      size += data.length
      if (size > MAX_BYTES) {
        res.writeHead(413).end()
        return
      }
      chunks.push(data)
    }
    const text = Buffer.concat(chunks).toString('utf8')
    const parsed: unknown = JSON.parse(text)
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      (parsed as { kind?: unknown }).kind !== 'english-daily-decks'
    ) {
      res.writeHead(400).end()
      return
    }
    const expected = req.headers['x-sync-revision']
    if (writing) {
      res.writeHead(409).end()
      return
    }
    writing = true
    try {
      // Re-read immediately before replacement, including changes made while receiving data.
      try {
        current = await readFile(SYNC_FILE, 'utf8')
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        current = null
      }
      if ((current ? digest(current) : 'missing') !== expected) {
        res.writeHead(409).end()
        return
      }
      await mkdir(dirname(SYNC_FILE), { recursive: true })
      const temp = `${SYNC_FILE}.${randomUUID()}.tmp`
      try {
        await writeFile(temp, text, { flag: 'wx' })
        await rename(temp, SYNC_FILE)
      } finally {
        await unlink(temp).catch(() => {})
      }
      res.setHeader('X-Sync-Revision', digest(text))
      res.writeHead(204).end()
    } finally {
      writing = false
    }
  } catch {
    res.writeHead(500).end()
  }
}
