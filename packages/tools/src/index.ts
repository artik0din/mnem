import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Vault } from '@mnem/core'

export type ToolOperation =
  | 'read_note'
  | 'write_note'
  | 'append_note'
  | 'patch_note'
  | 'delete_note'
  | 'search_full_text'
  | 'search_semantic'
  | 'search_graph'
  | 'get_backlinks'
  | 'get_outgoing_links'

export interface ToolAdapterOptions {
  /** Restrict which operations are exposed. Defaults to all. */
  readonly allowedOperations?: readonly ToolOperation[]
  /** Restrict note paths to those starting with this prefix. */
  readonly restrictToPath?: string
  /** Optional name prefix applied to every tool name. */
  readonly namePrefix?: string
}

export interface OpenAIToolDefinition {
  readonly type: 'function'
  readonly function: {
    readonly name: string
    readonly description: string
    readonly parameters: Record<string, unknown>
  }
}

export interface AnthropicToolDefinition {
  readonly name: string
  readonly description: string
  readonly input_schema: Record<string, unknown>
}

export interface ToolCallInput {
  readonly name: string
  readonly arguments: Record<string, unknown>
}

export interface ToolCallResult {
  readonly content: string
  readonly isError?: boolean
}

export interface ToolDescriptor {
  readonly operation: ToolOperation
  readonly toolName: string
  readonly description: string
  readonly parameters: Record<string, unknown>
}

interface ToolSpec {
  readonly operation: ToolOperation
  readonly description: string
  readonly parameters: Record<string, unknown>
}

const TOOL_SPECS: readonly ToolSpec[] = [
  {
    operation: 'read_note',
    description: 'Read a note by path from the vault and return its raw markdown content.',
    parameters: objectSchema(
      {
        path: {
          type: 'string',
          description: 'Vault-relative path to the note, including the .md suffix.',
        },
      },
      ['path'],
    ),
  },
  {
    operation: 'write_note',
    description: 'Create or overwrite a note at the given path.',
    parameters: objectSchema(
      {
        path: { type: 'string', description: 'Vault-relative path ending in .md.' },
        content: { type: 'string', description: 'The full markdown body.' },
        frontmatter: {
          type: 'object',
          description: 'Optional YAML frontmatter object.',
          additionalProperties: true,
        },
      },
      ['path', 'content'],
    ),
  },
  {
    operation: 'append_note',
    description: 'Append content to an existing note, or create it if it does not exist.',
    parameters: objectSchema(
      {
        path: { type: 'string' },
        content: { type: 'string' },
      },
      ['path', 'content'],
    ),
  },
  {
    operation: 'patch_note',
    description: 'Find and replace a substring in a note.',
    parameters: objectSchema(
      {
        path: { type: 'string' },
        find: { type: 'string' },
        replace: { type: 'string' },
      },
      ['path', 'find', 'replace'],
    ),
  },
  {
    operation: 'delete_note',
    description: 'Delete a note by path.',
    parameters: objectSchema({ path: { type: 'string' } }, ['path']),
  },
  {
    operation: 'search_full_text',
    description:
      'Full-text search across the vault. Returns up to topK ranked snippets with their paths.',
    parameters: objectSchema(
      {
        query: { type: 'string', description: 'Search terms.' },
        topK: { type: 'integer', description: 'Max results (default 10).', minimum: 1 },
      },
      ['query'],
    ),
  },
  {
    operation: 'search_semantic',
    description:
      'Semantic similarity search over the vault. Requires an embedding provider.',
    parameters: objectSchema(
      {
        query: { type: 'string' },
        topK: { type: 'integer', minimum: 1 },
      },
      ['query'],
    ),
  },
  {
    operation: 'search_graph',
    description: 'Traverse outgoing wikilinks starting from a note.',
    parameters: objectSchema(
      {
        startNote: { type: 'string' },
        depth: { type: 'integer', minimum: 1 },
      },
      ['startNote'],
    ),
  },
  {
    operation: 'get_backlinks',
    description: 'Return the list of notes that link to the given note.',
    parameters: objectSchema({ path: { type: 'string' } }, ['path']),
  },
  {
    operation: 'get_outgoing_links',
    description: 'Return the list of notes the given note links to.',
    parameters: objectSchema({ path: { type: 'string' } }, ['path']),
  },
]

function objectSchema(
  properties: Record<string, Record<string, unknown>>,
  required: readonly string[],
): Record<string, unknown> {
  return {
    type: 'object',
    properties,
    required: [...required],
    additionalProperties: false,
  }
}

function selectedSpecs(options: ToolAdapterOptions): readonly ToolSpec[] {
  if (options.allowedOperations === undefined) return TOOL_SPECS
  const allowed = new Set(options.allowedOperations)
  return TOOL_SPECS.filter((s) => allowed.has(s.operation))
}

function toolNameFor(operation: ToolOperation, options: ToolAdapterOptions): string {
  const prefix = options.namePrefix ?? ''
  return prefix + operation
}

/**
 * Return the complete set of tool descriptors that would be generated for a
 * vault given the supplied options. Useful when both OpenAI and Anthropic
 * formats are needed or when building custom adapters.
 */
export function listTools(options: ToolAdapterOptions = {}): readonly ToolDescriptor[] {
  return selectedSpecs(options).map((spec) => ({
    operation: spec.operation,
    toolName: toolNameFor(spec.operation, options),
    description: spec.description,
    parameters: spec.parameters,
  }))
}

/**
 * Generate OpenAI function-calling tool definitions from a vault.
 */
export function toOpenAITools(
  _vault: Vault,
  options: ToolAdapterOptions = {},
): readonly OpenAIToolDefinition[] {
  return selectedSpecs(options).map((spec) => ({
    type: 'function' as const,
    function: {
      name: toolNameFor(spec.operation, options),
      description: spec.description,
      parameters: spec.parameters,
    },
  }))
}

/**
 * Generate Anthropic tool-use tool definitions from a vault.
 */
export function toAnthropicTools(
  _vault: Vault,
  options: ToolAdapterOptions = {},
): readonly AnthropicToolDefinition[] {
  return selectedSpecs(options).map((spec) => ({
    name: toolNameFor(spec.operation, options),
    description: spec.description,
    input_schema: spec.parameters,
  }))
}

/**
 * Runtime dispatcher: execute a tool call emitted by an agent against the
 * vault. Returns the tool output as a markdown string that can be fed back to
 * the LLM.
 */
export async function executeToolCall(
  vault: Vault,
  call: ToolCallInput,
  options: ToolAdapterOptions = {},
): Promise<ToolCallResult> {
  const prefix = options.namePrefix ?? ''
  const rawName = call.name.startsWith(prefix) ? call.name.slice(prefix.length) : call.name
  const operation = rawName as ToolOperation
  const allowed = options.allowedOperations
  if (allowed !== undefined && !allowed.includes(operation)) {
    return errorResult(`Operation "${operation}" is not allowed for this agent.`)
  }
  const args = call.arguments
  try {
    switch (operation) {
      case 'read_note': {
        const path = requireString(args, 'path')
        assertPathAllowed(path, options)
        const note = await vault.readNote({ path })
        return { content: note.content }
      }
      case 'write_note': {
        const path = requireString(args, 'path')
        const content = requireString(args, 'content')
        assertPathAllowed(path, options)
        const frontmatter = optionalFrontmatter(args.frontmatter)
        await vault.writeNote(
          frontmatter === undefined
            ? { path, content }
            : { path, content, frontmatter },
        )
        return { content: `ok: wrote ${path}` }
      }
      case 'append_note': {
        const path = requireString(args, 'path')
        const content = requireString(args, 'content')
        assertPathAllowed(path, options)
        await vault.appendNote({ path, content })
        return { content: `ok: appended ${path}` }
      }
      case 'patch_note': {
        const path = requireString(args, 'path')
        const find = requireString(args, 'find')
        const replace = requireString(args, 'replace')
        assertPathAllowed(path, options)
        await vault.patchNote({ path, find, replace })
        return { content: `ok: patched ${path}` }
      }
      case 'delete_note': {
        const path = requireString(args, 'path')
        assertPathAllowed(path, options)
        await vault.deleteNote({ path })
        return { content: `ok: deleted ${path}` }
      }
      case 'search_full_text': {
        const query = requireString(args, 'query')
        const topK = optionalPositiveInt(args.topK) ?? 10
        const results = await vault.searchFullText({ query, topK })
        return { content: formatSearchResults(results) }
      }
      case 'search_semantic': {
        const query = requireString(args, 'query')
        const topK = optionalPositiveInt(args.topK) ?? 10
        const results = await vault.searchSemantic({ query, topK })
        return { content: formatSearchResults(results) }
      }
      case 'search_graph': {
        const startNote = requireString(args, 'startNote')
        const depth = optionalPositiveInt(args.depth) ?? 1
        assertPathAllowed(startNote, options)
        const reached = await vault.searchGraph({ startNote, depth })
        return { content: reached.length === 0 ? '(no reachable notes)' : reached.join('\n') }
      }
      case 'get_backlinks': {
        const path = requireString(args, 'path')
        const links = await vault.getBacklinks({ path })
        return { content: links.length === 0 ? '(no backlinks)' : links.join('\n') }
      }
      case 'get_outgoing_links': {
        const path = requireString(args, 'path')
        const links = await vault.getOutgoingLinks({ path })
        return { content: links.length === 0 ? '(no outgoing links)' : links.join('\n') }
      }
      default:
        return errorResult(`Unknown tool "${call.name}".`)
    }
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err))
  }
}

function formatSearchResults(
  results: readonly { path: string; score: number; snippet: string }[],
): string {
  if (results.length === 0) return '(no matches)'
  return results
    .map((r, i) => `${i + 1}. ${r.path} (score ${r.score.toFixed(3)})\n   ${r.snippet}`)
    .join('\n')
}

function requireString(args: Record<string, unknown>, key: string): string {
  const value = args[key]
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Missing required string argument "${key}"`)
  }
  return value
}

function optionalPositiveInt(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(`Argument must be a positive integer`)
  }
  return Math.floor(value)
}

function optionalFrontmatter(value: unknown): Record<string, unknown> | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Frontmatter must be an object`)
  }
  return value as Record<string, unknown>
}

function assertPathAllowed(path: string, options: ToolAdapterOptions): void {
  if (options.restrictToPath === undefined) return
  if (!path.startsWith(options.restrictToPath)) {
    throw new Error(
      `Path "${path}" is outside the allowed scope "${options.restrictToPath}"`,
    )
  }
}

function errorResult(message: string): ToolCallResult {
  return { content: `error: ${message}`, isError: true }
}

/* -------------------------------------------------------------------------- */
/* Claude Skill adapter                                                       */
/* -------------------------------------------------------------------------- */

export interface ClaudeSkillOptions extends ToolAdapterOptions {
  /** Absolute path to the directory the Skill should be generated into. */
  readonly outputDir: string
  /** Optional skill name. Defaults to `mnem-memory`. */
  readonly skillName?: string
  /** Optional one-line description used in the Skill frontmatter. */
  readonly description?: string
  /**
   * Command the generated scripts use to invoke the Mnem CLI. Defaults to
   * `mnem`. Override with `npx @mnem/cli` or a vendored binary path as needed.
   */
  readonly cliCommand?: string
}

export interface ClaudeSkillArtifacts {
  readonly root: string
  readonly skillMdPath: string
  readonly scriptPaths: readonly string[]
  readonly resourcePaths: readonly string[]
}

/**
 * Generate a Claude Skill (SKILL.md + scripts + resources) that exposes a Mnem
 * vault to Claude through progressive disclosure.
 *
 * The generated directory contains:
 *   - SKILL.md — YAML frontmatter + short corpus pointing at resources/api.md
 *   - scripts/*.sh — thin wrappers around the Mnem CLI
 *   - resources/api.md — full tool reference loaded on demand
 */
export async function toClaudeSkill(
  _vault: Vault,
  options: ClaudeSkillOptions,
): Promise<ClaudeSkillArtifacts> {
  const skillName = options.skillName ?? 'mnem-memory'
  const description =
    options.description ??
    'Persistent agent memory stored as a markdown vault. Read, write, search and traverse notes.'
  const cli = options.cliCommand ?? 'mnem'
  const tools = listTools(options)

  await mkdir(options.outputDir, { recursive: true })
  await mkdir(join(options.outputDir, 'scripts'), { recursive: true })
  await mkdir(join(options.outputDir, 'resources'), { recursive: true })

  const skillMd = renderSkillMd(skillName, description, tools)
  const skillMdPath = join(options.outputDir, 'SKILL.md')
  await writeFile(skillMdPath, skillMd, 'utf8')

  const scriptPaths: string[] = []
  for (const tool of tools) {
    const path = join(options.outputDir, 'scripts', `${tool.operation.replace(/_/g, '-')}.sh`)
    await writeFile(path, renderScript(tool, cli), { encoding: 'utf8', mode: 0o755 })
    scriptPaths.push(path)
  }

  const resourcePath = join(options.outputDir, 'resources', 'api.md')
  await writeFile(resourcePath, renderApiReference(tools), 'utf8')

  return {
    root: options.outputDir,
    skillMdPath,
    scriptPaths,
    resourcePaths: [resourcePath],
  }
}

function renderSkillMd(
  name: string,
  description: string,
  tools: readonly ToolDescriptor[],
): string {
  const lines: string[] = []
  lines.push('---')
  lines.push(`name: ${name}`)
  lines.push(`description: ${JSON.stringify(description)}`)
  lines.push('---')
  lines.push('')
  lines.push(`# ${name}`)
  lines.push('')
  lines.push(
    'Use this skill to persist memory for the current user across conversations. The memory lives as a folder of markdown notes (a "vault") that can be read, written, searched and traversed.',
  )
  lines.push('')
  lines.push('## When to use')
  lines.push('')
  lines.push(
    '- Recall facts you learned about the user or an ongoing project in an earlier session.',
  )
  lines.push(
    '- Save important facts, decisions, or summaries so they survive conversation compaction.',
  )
  lines.push('- Browse the graph of linked notes (`[[wikilinks]]`) around a topic.')
  lines.push('')
  lines.push('## Available scripts')
  lines.push('')
  for (const tool of tools) {
    lines.push(`- \`scripts/${tool.operation.replace(/_/g, '-')}.sh\` — ${tool.description}`)
  }
  lines.push('')
  lines.push('## Learn more')
  lines.push('')
  lines.push(
    'For the full argument schema of each tool, load `resources/api.md`. Only load it when you need the exact parameters — the metadata above is enough for most tasks (progressive disclosure).',
  )
  lines.push('')
  return lines.join('\n')
}

function renderScript(tool: ToolDescriptor, cli: string): string {
  const op = tool.operation.replace(/_/g, '-')
  return [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    '',
    `# ${tool.description}`,
    `# Arguments: see resources/api.md for the full JSON schema.`,
    '',
    `exec ${cli} tool "${op}" "$@"`,
    '',
  ].join('\n')
}

function renderApiReference(tools: readonly ToolDescriptor[]): string {
  const lines: string[] = []
  lines.push('# Mnem vault tools — full reference')
  lines.push('')
  lines.push(
    'Each tool below is exposed as a shell script under `scripts/` that shells out to the `mnem` CLI. Inputs are JSON arguments conforming to the schema shown.',
  )
  lines.push('')
  for (const tool of tools) {
    lines.push(`## ${tool.toolName}`)
    lines.push('')
    lines.push(tool.description)
    lines.push('')
    lines.push('```json')
    lines.push(JSON.stringify(tool.parameters, null, 2))
    lines.push('```')
    lines.push('')
  }
  return lines.join('\n')
}
