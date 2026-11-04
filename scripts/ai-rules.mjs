import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const args = process.argv.slice(2)
if (args.length !== 1 || !['--sync', '--check'].includes(args[0])) {
  console.error('用法：node scripts/ai-rules.mjs --sync|--check')
  process.exit(1)
}
const check = args[0] === '--check'
const source = (await readFile(join(root, 'AGENTS.md'), 'utf8')).trimEnd() + '\n'
const dropdown = source.match(/^## 下拉交互\n[\s\S]*?(?=^## |$(?![\s\S]))/m)?.[0]
if (!dropdown) throw new Error('AGENTS.md 缺少「下拉交互」章节，无法生成规则。')
const notice = '<!-- GENERATED from AGENTS.md. 编辑共享源后运行 npm run rules:sync。 -->\n\n'
const cursorHeader = (description) => `---\ndescription: ${description}\nalwaysApply: true\n---\n\n`
const cascadeHeader = '---\ntrigger: always_on\n---\n\n'
const outputs = {
  '.cursor/rules/project.mdc': cursorHeader('每日单词项目开发、主题、数据保护及验证约定') + notice + source.replace(dropdown, ''),
  '.cursor/rules/dropdown-hover.mdc': cursorHeader('中文释义候选点击展开，其他下拉控件使用桌面 hover 交互') + notice + dropdown.trimEnd() + '\n',
  'CLAUDE.md': notice + '# Claude Code 项目指令\n\n@AGENTS.md\n',
  'GEMINI.md': notice + '# Gemini CLI 项目指令\n\n@./AGENTS.md\n',
  '.github/copilot-instructions.md': notice + source,
  '.windsurf/rules/project.md': cascadeHeader + notice + source,
  '.devin/rules/project.md': cascadeHeader + notice + source,
}
let failed = false
for (const [path, expected] of Object.entries(outputs)) {
  const absolute = join(root, path)
  let actual
  try { actual = await readFile(absolute, 'utf8') }
  catch (error) { if (error.code !== 'ENOENT') throw error }
  if (actual === expected) continue
  if (check) {
    console.error(`规则入口缺失或未同步：${path}`)
    failed = true
  } else {
    await mkdir(dirname(absolute), { recursive: true })
    await writeFile(absolute, expected)
    console.log(`已同步 ${path}`)
  }
}

// Deliberately narrow static guard: enforce the shared Ant Design menu entry point.
// Runtime hover, focus and touch behavior still require browser verification.
async function checkMenus(directory) {
  for (const entry of await readdir(join(root, directory), { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`
    if (entry.isDirectory()) { await checkMenus(path); continue }
    if (!/\.[jt]sx?$/.test(path) || /\.test\.[jt]sx?$/.test(path)) continue
    const content = await readFile(join(root, path), 'utf8')
    const imports = [...content.matchAll(/import\s+(?:type\s+)?\{([^}]+)\}\s+from\s*['"]antd['"]/g)]
    const namedDropdown = imports.some((match) => /\bDropdown\b/.test(match[1]))
    const directDropdown = /(?:from\s*|import\s*\()\s*['"]antd\/(?:es|lib)\/dropdown(?:\/[^'"]*)?['"]/.test(content)
    const namespaceDropdown = [...content.matchAll(/import\s+\*\s+as\s+(\w+)\s+from\s*['"]antd['"]/g)]
      .some((match) => new RegExp(`\\b${match[1]}\\.Dropdown\\b`).test(content))
    if (path !== 'src/shared/components/HoverDropdown.tsx' && (namedDropdown || directDropdown || namespaceDropdown)) {
      console.error(`下拉规则违反：${path} 请复用 HoverDropdown，不要直接引入 Ant Design Dropdown。`)
      failed = true
    }
    if (path === 'src/shared/components/HoverDropdown.tsx' && !/trigger=\{\[\s*['"]hover['"]\s*\]\}/.test(content)) {
      console.error('下拉规则违反：HoverDropdown 的 trigger 必须固定为仅 hover。')
      failed = true
    }
  }
}
if (check) await checkMenus('src')
if (failed) {
  console.error('请修正交互规则违规；规则内容不同步时，运行 npm run rules:sync。')
  process.exitCode = 1
} else console.log(check ? 'AI 规则入口一致，下拉组件静态检查通过。' : 'AI 规则同步完成。')
