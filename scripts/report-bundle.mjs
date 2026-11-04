import { readFileSync, statSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..', 'dist')
const manifest = JSON.parse(readFileSync(resolve(root, '.vite/manifest.json'), 'utf8'))
const entry = Object.keys(manifest).find((key) => manifest[key].isEntry)
if (!entry) throw new Error('未找到构建入口，请先运行 npm run build。')
const visited = new Set()
function visit(key) { if (visited.has(key)) return; visited.add(key); for (const dependency of manifest[key].imports ?? []) visit(dependency) }
visit(entry)
const files = [...new Set([...visited].map((key) => manifest[key].file))].filter((file) => file.endsWith('.js'))
const bytes = files.reduce((sum, file) => sum + statSync(resolve(root, file)).size, 0)
const gzip = files.reduce((sum, file) => sum + gzipSync(readFileSync(resolve(root, file))).length, 0)
console.log(JSON.stringify({ initialJavaScriptKB: +(bytes / 1000).toFixed(2), estimatedGzipKB: +(gzip / 1000).toFixed(2), initialChunks: files.length, deferredEntries: Object.values(manifest).filter((value) => value.isDynamicEntry).length }, null, 2))
