import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const project = fileURLToPath(new URL('../', import.meta.url))
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'english-ai-rules-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  await mkdir(join(root, 'scripts'), { recursive: true })
  await mkdir(join(root, 'src/shared/components'), { recursive: true })
  await cp(join(project, 'AGENTS.md'), join(root, 'AGENTS.md'))
  await cp(join(project, 'scripts/ai-rules.mjs'), join(root, 'scripts/ai-rules.mjs'))
  await cp(join(project, 'src/shared/components/HoverDropdown.tsx'), join(root, 'src/shared/components/HoverDropdown.tsx'))
  const run = (mode) => spawnSync(process.execPath, [join(root, 'scripts/ai-rules.mjs'), mode], { encoding: 'utf8' })
  assert.equal(run('--sync').status, 0)
  return { root, run }
}

test('sync produces native entries and check detects drift without overwriting it', async (t) => {
  const { root, run } = await fixture(t)
  assert.equal(run('--check').status, 0)
  assert.match(await readFile(join(root, 'CLAUDE.md'), 'utf8'), /^@AGENTS\.md$/m)
  assert.match(await readFile(join(root, 'GEMINI.md'), 'utf8'), /^@\.\/AGENTS\.md$/m)
  const generated = join(root, '.github/copilot-instructions.md')
  const changed = (await readFile(generated, 'utf8')) + '\nLocal divergent instruction\n'
  await writeFile(generated, changed)
  assert.equal(run('--check').status, 1)
  assert.equal(await readFile(generated, 'utf8'), changed)
  assert.equal(run('--sync').status, 0)
  assert.equal(run('--check').status, 0)
  assert.doesNotMatch(run('--sync').stdout, /已同步/)
})

test('updating the shared source invalidates entries until they are synced', async (t) => {
  const { root, run } = await fixture(t)
  const path = join(root, 'AGENTS.md')
  await writeFile(path, (await readFile(path, 'utf8')).replace('桌面端下拉控件', '所有桌面端下拉控件'))
  assert.equal(run('--check').status, 1)
  assert.equal(run('--sync').status, 0)
  assert.equal(run('--check').status, 0)
  for (const entry of ['.cursor/rules/dropdown-hover.mdc', '.github/copilot-instructions.md', '.windsurf/rules/project.md', '.devin/rules/project.md']) {
    assert.match(await readFile(join(root, entry), 'utf8'), /所有桌面端下拉控件/)
  }
})

test('menu guard rejects named, aliased, namespace and direct Ant Design Dropdown imports', async (t) => {
  const { root, run } = await fixture(t)
  const path = join(root, 'src/BadMenu.tsx')
  for (const code of [
    "import { Dropdown } from 'antd'",
    "import { Dropdown as Menu } from 'antd'",
    "import * as Ant from 'antd'; const Menu = Ant.Dropdown",
    "import Menu from 'antd/es/dropdown'",
  ]) {
    await writeFile(path, code)
    const result = run('--check')
    assert.equal(result.status, 1, code)
    assert.match(result.stderr, /src\/BadMenu\.tsx/)
  }
  await writeFile(path, "import { HoverDropdown } from './shared/components/HoverDropdown.tsx'")
  assert.equal(run('--check').status, 0)
})

test('menu guard rejects adding desktop click to the shared trigger', async (t) => {
  const { root, run } = await fixture(t)
  const path = join(root, 'src/shared/components/HoverDropdown.tsx')
  await writeFile(path, (await readFile(path, 'utf8')).replace("trigger={['hover']}", "trigger={['hover', 'click']}"))
  const result = run('--check')
  assert.equal(result.status, 1)
  assert.match(result.stderr, /trigger/)
})
