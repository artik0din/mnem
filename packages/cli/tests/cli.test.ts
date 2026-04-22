import { mkdtemp, readFile, writeFile, mkdir, utimes } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildProgram } from '../src/program.js'
import { runInit } from '../src/commands/init.js'
import { runStats } from '../src/commands/stats.js'
import { runSearch } from '../src/commands/search.js'
import { runCompact } from '../src/commands/compact.js'
import { runExportSkill } from '../src/commands/export-skill.js'
import { runTool } from '../src/commands/tool.js'
import { DEFAULT_CONFIG, parseConfig, serializeConfig } from '../src/config.js'

async function makeTempVault(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'mnem-cli-'))
  return dir
}

async function initVault(dir: string): Promise<void> {
  await runInit({ targetDir: dir })
}

describe('runInit', () => {
  it('creates .mnem/ with config and gitignore', async () => {
    const dir = await makeTempVault()
    const res = await runInit({ targetDir: dir })
    expect(res.created).toBe(true)
    expect(existsSync(join(dir, '.mnem', 'config.yml'))).toBe(true)
    expect(existsSync(join(dir, '.mnem', '.gitignore'))).toBe(true)
    const again = await runInit({ targetDir: dir })
    expect(again.created).toBe(false)
  })
})

describe('runStats', () => {
  let dir: string
  beforeEach(async () => {
    dir = await makeTempVault()
    await initVault(dir)
  })

  it('counts markdown notes and their sizes', async () => {
    await writeFile(join(dir, 'a.md'), 'hello', 'utf8')
    await writeFile(join(dir, 'b.md'), 'world!', 'utf8')
    const stats = await runStats(dir)
    expect(stats.noteCount).toBe(2)
    expect(stats.totalBytes).toBe(11)
    expect(stats.root).toBe(dir)
    expect(stats.latestUpdatedAt).toBeTypeOf('number')
  })

  it('ignores internal .mnem/ files', async () => {
    await writeFile(join(dir, 'a.md'), 'hi', 'utf8')
    await writeFile(join(dir, '.mnem', 'scratch.md'), 'ignored', 'utf8')
    const stats = await runStats(dir)
    expect(stats.noteCount).toBe(1)
  })

  it('throws when no vault is found', async () => {
    const dir2 = await makeTempVault()
    await expect(runStats(dir2)).rejects.toThrow(/no vault found/)
  })
})

describe('runSearch', () => {
  it('returns full-text matches', async () => {
    const dir = await makeTempVault()
    await initVault(dir)
    await writeFile(join(dir, 'a.md'), 'the quick brown fox', 'utf8')
    await writeFile(join(dir, 'b.md'), 'lorem ipsum', 'utf8')
    // Seed the index by writing through the vault.
    const { runTool } = await import('../src/commands/tool.js')
    await runTool({
      startDir: dir,
      toolName: 'write-note',
      jsonArgs: JSON.stringify({ path: 'a.md', content: 'the quick brown fox' }),
    })
    await runTool({
      startDir: dir,
      toolName: 'write-note',
      jsonArgs: JSON.stringify({ path: 'b.md', content: 'lorem ipsum' }),
    })
    const report = await runSearch({ query: 'fox', topK: 5, startDir: dir })
    expect(report.fullText[0]?.path).toBe('a.md')
    expect(report.semantic).toBeUndefined()
  })
})

describe('runCompact', () => {
  it('archives conversations older than the threshold (dry-run)', async () => {
    const dir = await makeTempVault()
    await initVault(dir)
    await mkdir(join(dir, 'conversations'), { recursive: true })
    await writeFile(join(dir, 'conversations', 'old.md'), 'stale', 'utf8')
    const old = Date.now() / 1000 - 60 * 60 * 24 * 60
    await utimes(join(dir, 'conversations', 'old.md'), old, old)
    await writeFile(join(dir, 'conversations', 'fresh.md'), 'new', 'utf8')
    const report = await runCompact({ startDir: dir, dryRun: true, olderThanDays: 30 })
    expect(report.movedPaths).toContain('archive/old.md')
    expect(report.skipped).toBe(1)
  })
})

describe('runTool and runExportSkill', () => {
  it('exports a Claude Skill into a target directory', async () => {
    const dir = await makeTempVault()
    await initVault(dir)
    const outDir = join(dir, 'skill')
    const artifacts = await runExportSkill({
      startDir: dir,
      outputDir: outDir,
      skillName: 'mnem-memory',
    })
    expect(artifacts.root).toBe(outDir)
    const skill = await readFile(artifacts.skillMdPath, 'utf8')
    expect(skill).toContain('name: mnem-memory')
  })

  it('runTool writes then reads a note via the CLI entry point', async () => {
    const dir = await makeTempVault()
    await initVault(dir)
    await runTool({
      startDir: dir,
      toolName: 'write-note',
      jsonArgs: JSON.stringify({ path: 'hello.md', content: 'hi there' }),
    })
    const content = await runTool({
      startDir: dir,
      toolName: 'read-note',
      jsonArgs: JSON.stringify({ path: 'hello.md' }),
    })
    expect(content).toBe('hi there')
  })
})

describe('config serialization', () => {
  it('round-trips the default config', () => {
    const serialized = serializeConfig(DEFAULT_CONFIG)
    const parsed = parseConfig(serialized)
    expect(parsed).toEqual(DEFAULT_CONFIG)
  })

  it('parses a config with openai embeddings', () => {
    const raw = `
storage:
  type: local
index:
  type: sqlite
  path: .mnem/index.sqlite
embeddings:
  type: openai
  model: text-embedding-3-small
`
    const parsed = parseConfig(raw)
    expect(parsed.embeddings).toEqual({
      type: 'openai',
      model: 'text-embedding-3-small',
    })
  })
})

describe('buildProgram', () => {
  it('exposes expected subcommands', () => {
    const program = buildProgram({
      stdout: () => {},
      stderr: () => {},
      cwd: () => process.cwd(),
    })
    const names = program.commands.map((c) => c.name())
    expect(names).toContain('init')
    expect(names).toContain('stats')
    expect(names).toContain('search')
    expect(names).toContain('compact')
    expect(names).toContain('export-skill')
    expect(names).toContain('tool')
  })

  it('init subcommand writes a vault under a user-chosen path', async () => {
    const dir = await makeTempVault()
    const output: string[] = []
    const program = buildProgram({
      stdout: (m) => output.push(m),
      stderr: () => {},
      cwd: () => dir,
    })
    await program.parseAsync(['node', 'mnem', 'init'])
    expect(output.join('')).toContain('Initialized vault')
    expect(existsSync(join(dir, '.mnem', 'config.yml'))).toBe(true)
  })
})

afterEach(() => {
  // Nothing to clean up — OS tmpdir is fine; tests create unique directories.
})
