import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'

/**
 * On-disk configuration for a vault. Stored at `.mnem/config.yml` at the
 * vault root. A tiny YAML subset is sufficient for the v0.1 shape.
 */
export interface VaultConfig {
  readonly storage: { readonly type: 'local'; readonly root?: string }
  readonly index: { readonly type: 'sqlite'; readonly path: string }
  readonly embeddings?:
    | { readonly type: 'openai'; readonly model?: string }
    | { readonly type: 'none' }
}

export const DEFAULT_CONFIG: VaultConfig = {
  storage: { type: 'local' },
  index: { type: 'sqlite', path: '.mnem/index.sqlite' },
  embeddings: { type: 'none' },
}

export function findVaultRoot(startDir: string): string | undefined {
  let current = resolve(startDir)
  for (let depth = 0; depth < 64; depth++) {
    if (hasMnemDir(current)) return current
    const parent = dirname(current)
    if (parent === current) return undefined
    current = parent
  }
  return undefined
}

function hasMnemDir(dir: string): boolean {
  return existsSync(join(dir, '.mnem'))
}

export async function readConfig(vaultRoot: string): Promise<VaultConfig> {
  const path = join(vaultRoot, '.mnem', 'config.yml')
  try {
    const raw = await readFile(path, 'utf8')
    return parseConfig(raw)
  } catch {
    return DEFAULT_CONFIG
  }
}

export async function writeConfig(vaultRoot: string, config: VaultConfig): Promise<void> {
  const path = join(vaultRoot, '.mnem', 'config.yml')
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, serializeConfig(config), 'utf8')
}

export function serializeConfig(config: VaultConfig): string {
  const lines: string[] = []
  lines.push('# Mnem vault configuration')
  lines.push(`storage:`)
  lines.push(`  type: ${config.storage.type}`)
  if (config.storage.root !== undefined) {
    lines.push(`  root: ${config.storage.root}`)
  }
  lines.push(`index:`)
  lines.push(`  type: ${config.index.type}`)
  lines.push(`  path: ${config.index.path}`)
  if (config.embeddings !== undefined) {
    lines.push(`embeddings:`)
    lines.push(`  type: ${config.embeddings.type}`)
    if (config.embeddings.type === 'openai' && config.embeddings.model !== undefined) {
      lines.push(`  model: ${config.embeddings.model}`)
    }
  }
  return lines.join('\n') + '\n'
}

/**
 * Minimal YAML-subset parser tailored to the config shape written above.
 * Only supports two-space nested key/value pairs.
 */
export function parseConfig(raw: string): VaultConfig {
  const sections: Record<string, Record<string, string>> = {}
  let currentSection: string | undefined
  for (const rawLine of raw.split('\n')) {
    const line = rawLine.replace(/\r$/, '')
    if (line.length === 0 || line.trimStart().startsWith('#')) continue
    if (!line.startsWith(' ')) {
      const key = line.replace(/:\s*$/, '').trim()
      if (key.length === 0) continue
      currentSection = key
      if (sections[currentSection] === undefined) sections[currentSection] = {}
    } else if (currentSection !== undefined) {
      const trimmed = line.trim()
      const colon = trimmed.indexOf(':')
      if (colon === -1) continue
      const key = trimmed.slice(0, colon).trim()
      const value = trimmed.slice(colon + 1).trim()
      const bucket = sections[currentSection]
      if (bucket !== undefined) bucket[key] = value
    }
  }

  const storageRaw = sections['storage'] ?? {}
  const indexRaw = sections['index'] ?? {}
  const embRaw = sections['embeddings']

  const storage: VaultConfig['storage'] =
    storageRaw['root'] === undefined
      ? { type: 'local' }
      : { type: 'local', root: storageRaw['root'] }
  const index: VaultConfig['index'] = {
    type: 'sqlite',
    path: indexRaw['path'] ?? DEFAULT_CONFIG.index.path,
  }
  let embeddings: VaultConfig['embeddings']
  if (embRaw === undefined) {
    embeddings = DEFAULT_CONFIG.embeddings
  } else if (embRaw['type'] === 'openai') {
    embeddings =
      embRaw['model'] === undefined
        ? { type: 'openai' }
        : { type: 'openai', model: embRaw['model'] }
  } else {
    embeddings = { type: 'none' }
  }
  return { storage, index, ...(embeddings === undefined ? {} : { embeddings }) }
}
