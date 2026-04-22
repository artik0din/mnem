import type { StorageAdapter } from './types.js'
import { NoteNotFoundError } from './errors.js'

/**
 * In-memory storage adapter. Useful for tests and short-lived vaults.
 * Not intended for production persistence.
 */
export class MemoryStorage implements StorageAdapter {
  private readonly store = new Map<string, string>()

  async read(path: string): Promise<string> {
    const value = this.store.get(path)
    if (value === undefined) {
      throw new NoteNotFoundError(path)
    }
    return value
  }

  async write(path: string, content: string): Promise<void> {
    this.store.set(path, content)
  }

  async delete(path: string): Promise<void> {
    if (!this.store.has(path)) {
      throw new NoteNotFoundError(path)
    }
    this.store.delete(path)
  }

  async exists(path: string): Promise<boolean> {
    return this.store.has(path)
  }

  async *list(prefix?: string): AsyncIterable<string> {
    for (const key of this.store.keys()) {
      if (prefix === undefined || key.startsWith(prefix)) {
        yield key
      }
    }
  }
}
