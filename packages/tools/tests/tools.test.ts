import { mkdtemp, readFile, readdir, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createVault, MemoryStorage } from '@mnem/core'
import type { Vault } from '@mnem/core'
import { describe, expect, it } from 'vitest'
import {
  executeToolCall,
  listTools,
  toAnthropicTools,
  toClaudeSkill,
  toOpenAITools,
} from '../src/index.js'

async function makeVault(): Promise<Vault> {
  return createVault({ storage: new MemoryStorage() })
}

describe('tool definitions', () => {
  it('toOpenAITools emits 10 function definitions by default', async () => {
    const vault = await makeVault()
    const tools = toOpenAITools(vault)
    expect(tools).toHaveLength(10)
    for (const tool of tools) {
      expect(tool.type).toBe('function')
      expect(typeof tool.function.name).toBe('string')
      expect(typeof tool.function.description).toBe('string')
      expect(tool.function.parameters['type']).toBe('object')
    }
  })

  it('toAnthropicTools emits the same set in Anthropic format', async () => {
    const vault = await makeVault()
    const tools = toAnthropicTools(vault)
    expect(tools).toHaveLength(10)
    for (const tool of tools) {
      expect(tool.name).toMatch(/^[a-z_]+$/)
      expect(tool.input_schema['type']).toBe('object')
    }
  })

  it('respects allowedOperations', async () => {
    const vault = await makeVault()
    const tools = toOpenAITools(vault, {
      allowedOperations: ['read_note', 'search_full_text'],
    })
    expect(tools.map((t) => t.function.name)).toEqual(['read_note', 'search_full_text'])
  })

  it('respects namePrefix', async () => {
    const vault = await makeVault()
    const tools = toOpenAITools(vault, { namePrefix: 'vault_' })
    expect(tools[0]?.function.name.startsWith('vault_')).toBe(true)
  })

  it('listTools exposes canonical descriptors', () => {
    const descriptors = listTools()
    expect(descriptors[0]?.toolName).toBe('read_note')
  })
})

describe('executeToolCall', () => {
  it('handles write_note and read_note round-trip', async () => {
    const vault = await makeVault()
    await executeToolCall(vault, {
      name: 'write_note',
      arguments: { path: 'a.md', content: 'hello' },
    })
    const out = await executeToolCall(vault, {
      name: 'read_note',
      arguments: { path: 'a.md' },
    })
    expect(out.content).toBe('hello')
    expect(out.isError).toBeUndefined()
  })

  it('append_note creates and then appends', async () => {
    const vault = await makeVault()
    await executeToolCall(vault, {
      name: 'append_note',
      arguments: { path: 'a.md', content: 'one' },
    })
    await executeToolCall(vault, {
      name: 'append_note',
      arguments: { path: 'a.md', content: 'two' },
    })
    const out = await executeToolCall(vault, {
      name: 'read_note',
      arguments: { path: 'a.md' },
    })
    expect(out.content).toContain('one')
    expect(out.content).toContain('two')
  })

  it('patch_note substitutes text', async () => {
    const vault = await makeVault()
    await executeToolCall(vault, {
      name: 'write_note',
      arguments: { path: 'a.md', content: 'the quick fox' },
    })
    await executeToolCall(vault, {
      name: 'patch_note',
      arguments: { path: 'a.md', find: 'quick', replace: 'slow' },
    })
    const out = await executeToolCall(vault, {
      name: 'read_note',
      arguments: { path: 'a.md' },
    })
    expect(out.content).toBe('the slow fox')
  })

  it('delete_note removes the note', async () => {
    const vault = await makeVault()
    await executeToolCall(vault, {
      name: 'write_note',
      arguments: { path: 'a.md', content: 'x' },
    })
    await executeToolCall(vault, {
      name: 'delete_note',
      arguments: { path: 'a.md' },
    })
    const out = await executeToolCall(vault, {
      name: 'read_note',
      arguments: { path: 'a.md' },
    })
    expect(out.isError).toBe(true)
  })

  it('search_full_text formats ranked results', async () => {
    const vault = await makeVault()
    await executeToolCall(vault, {
      name: 'write_note',
      arguments: { path: 'a.md', content: 'hello world' },
    })
    const out = await executeToolCall(vault, {
      name: 'search_full_text',
      arguments: { query: 'hello' },
    })
    expect(out.content).toContain('a.md')
  })

  it('search_full_text returns no-matches marker', async () => {
    const vault = await makeVault()
    const out = await executeToolCall(vault, {
      name: 'search_full_text',
      arguments: { query: 'nothing' },
    })
    expect(out.content).toBe('(no matches)')
  })

  it('get_backlinks and get_outgoing_links return link lists', async () => {
    const vault = await makeVault()
    await executeToolCall(vault, {
      name: 'write_note',
      arguments: { path: 'a.md', content: 'see [[b]]' },
    })
    const out = await executeToolCall(vault, {
      name: 'get_backlinks',
      arguments: { path: 'b.md' },
    })
    expect(out.content).toBe('a.md')
  })

  it('rejects write_note outside restrictToPath', async () => {
    const vault = await makeVault()
    const out = await executeToolCall(
      vault,
      { name: 'write_note', arguments: { path: 'other/a.md', content: 'x' } },
      { restrictToPath: 'allowed/' },
    )
    expect(out.isError).toBe(true)
  })

  it('rejects disallowed operations', async () => {
    const vault = await makeVault()
    const out = await executeToolCall(
      vault,
      { name: 'delete_note', arguments: { path: 'a.md' } },
      { allowedOperations: ['read_note'] },
    )
    expect(out.isError).toBe(true)
  })

  it('reports an error for unknown tool names', async () => {
    const vault = await makeVault()
    const out = await executeToolCall(vault, {
      name: 'do_something_else',
      arguments: {},
    })
    expect(out.isError).toBe(true)
  })

  it('reports an error when required arguments are missing', async () => {
    const vault = await makeVault()
    const out = await executeToolCall(vault, { name: 'read_note', arguments: {} })
    expect(out.isError).toBe(true)
  })

  it('strips namePrefix when dispatching', async () => {
    const vault = await makeVault()
    await executeToolCall(
      vault,
      { name: 'vault_write_note', arguments: { path: 'a.md', content: 'x' } },
      { namePrefix: 'vault_' },
    )
    const out = await executeToolCall(
      vault,
      { name: 'vault_read_note', arguments: { path: 'a.md' } },
      { namePrefix: 'vault_' },
    )
    expect(out.content).toBe('x')
  })

  it('search_graph traverses outgoing links', async () => {
    const vault = await makeVault()
    await executeToolCall(vault, {
      name: 'write_note',
      arguments: { path: 'a.md', content: 'see [[b]]' },
    })
    await executeToolCall(vault, {
      name: 'write_note',
      arguments: { path: 'b.md', content: 'end' },
    })
    const out = await executeToolCall(vault, {
      name: 'search_graph',
      arguments: { startNote: 'a.md', depth: 1 },
    })
    expect(out.content).toContain('b.md')
  })

  it('write_note accepts frontmatter', async () => {
    const vault = await makeVault()
    await executeToolCall(vault, {
      name: 'write_note',
      arguments: { path: 'a.md', content: 'body', frontmatter: { tag: 'x' } },
    })
    const out = await executeToolCall(vault, {
      name: 'read_note',
      arguments: { path: 'a.md' },
    })
    expect(out.content.trim()).toBe('body')
  })
})

describe('toClaudeSkill', () => {
  it('writes SKILL.md, scripts and resources/api.md', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mnem-skill-'))
    const vault = await makeVault()
    const artifacts = await toClaudeSkill(vault, { outputDir: dir })

    expect(artifacts.root).toBe(dir)
    expect(artifacts.skillMdPath.endsWith('SKILL.md')).toBe(true)
    const skill = await readFile(artifacts.skillMdPath, 'utf8')
    expect(skill.startsWith('---')).toBe(true)
    expect(skill).toContain('name: mnem-memory')
    expect(skill).toContain('description:')
    expect(skill).toContain('resources/api.md')

    const scripts = await readdir(join(dir, 'scripts'))
    expect(scripts.length).toBe(10)
    const firstScript = await readFile(join(dir, 'scripts', scripts[0] ?? ''), 'utf8')
    expect(firstScript.startsWith('#!/usr/bin/env bash')).toBe(true)
    const firstScriptStat = await stat(join(dir, 'scripts', scripts[0] ?? ''))
    // Files should be executable (exact bits depend on umask).
    expect(firstScriptStat.mode & 0o100).not.toBe(0)

    const api = await readFile(join(dir, 'resources', 'api.md'), 'utf8')
    expect(api).toContain('read_note')
    expect(api).toContain('search_full_text')
  })

  it('respects custom skill name and description', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mnem-skill-'))
    const vault = await makeVault()
    await toClaudeSkill(vault, {
      outputDir: dir,
      skillName: 'my-memory',
      description: 'Custom description',
      cliCommand: 'npx @mnem/cli',
    })
    const skill = await readFile(join(dir, 'SKILL.md'), 'utf8')
    expect(skill).toContain('name: my-memory')
    expect(skill).toContain('Custom description')
    const scripts = await readdir(join(dir, 'scripts'))
    const body = await readFile(join(dir, 'scripts', scripts[0] ?? ''), 'utf8')
    expect(body).toContain('npx @mnem/cli')
  })
})
