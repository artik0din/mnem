import { mkdir, readFile, rm, stat, writeFile, readdir } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import type { StorageAdapter } from '@mnem/core'
import { NoteNotFoundError } from '@mnem/core'

export interface LocalStorageOptions {
  /** Absolute path to the vault root on disk. */
  readonly root: string
}

/**
 * Local filesystem storage adapter. Notes are stored as plain files under a
 * root directory. Paths are resolved relative to the root.
 */
export class LocalStorage implements StorageAdapter {
  private readonly root: string

  constructor(options: LocalStorageOptions) {
    this.root = options.root
  }

  async read(path: string): Promise<string> {
    const full = this.resolve(path)
    try {
      return await readFile(full, 'utf8')
    } catch (err) {
      if (isNotFoundError(err)) throw new NoteNotFoundError(path)
      throw err
    }
  }

  async write(path: string, content: string): Promise<void> {
    const full = this.resolve(path)
    await mkdir(dirname(full), { recursive: true })
    await writeFile(full, content, 'utf8')
  }

  async delete(path: string): Promise<void> {
    const full = this.resolve(path)
    try {
      await rm(full)
    } catch (err) {
      if (isNotFoundError(err)) throw new NoteNotFoundError(path)
      throw err
    }
  }

  async exists(path: string): Promise<boolean> {
    const full = this.resolve(path)
    try {
      await stat(full)
      return true
    } catch (err) {
      if (isNotFoundError(err)) return false
      throw err
    }
  }

  async *list(prefix?: string): AsyncIterable<string> {
    const base = prefix === undefined ? this.root : this.resolve(prefix.replace(/\/$/, ''))
    for await (const entry of walk(base)) {
      yield relative(this.root, entry).split(/\\|\//).join('/')
    }
  }

  private resolve(path: string): string {
    return join(this.root, path)
  }
}

async function* walk(dir: string): AsyncIterable<string> {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch (err) {
    if (isNotFoundError(err)) return
    throw err
  }
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      yield* walk(full)
    } else if (entry.isFile()) {
      yield full
    }
  }
}

function isNotFoundError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === 'ENOENT'
  )
}
