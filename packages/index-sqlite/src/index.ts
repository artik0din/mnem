import type { IndexAdapter, IndexedNote, SearchResult } from '@mnem/core'

export interface SqliteIndexOptions {
  /** Path to the SQLite database file, or ':memory:' for an in-memory database. */
  readonly path: string
}

/**
 * SQLite-backed index adapter using FTS5 for full-text search and sqlite-vec
 * for semantic vector search.
 *
 * Implementation is scheduled for v0.1. The current version exposes the
 * constructor and interface so downstream packages compile against the final
 * shape.
 */
export class SqliteIndex implements IndexAdapter {
  private readonly options: SqliteIndexOptions

  constructor(options: SqliteIndexOptions) {
    this.options = options
  }

  async upsertNote(_note: IndexedNote): Promise<void> {
    throw new Error(
      `[@mnem/index-sqlite] upsertNote is not implemented yet (path=${this.options.path})`,
    )
  }

  async deleteNote(_path: string): Promise<void> {
    throw new Error(
      `[@mnem/index-sqlite] deleteNote is not implemented yet (path=${this.options.path})`,
    )
  }

  async searchFullText(_query: string, _topK: number): Promise<readonly SearchResult[]> {
    throw new Error(
      `[@mnem/index-sqlite] searchFullText is not implemented yet (path=${this.options.path})`,
    )
  }

  async searchSemantic(
    _embedding: readonly number[],
    _topK: number,
  ): Promise<readonly SearchResult[]> {
    throw new Error(
      `[@mnem/index-sqlite] searchSemantic is not implemented yet (path=${this.options.path})`,
    )
  }

  async getBacklinks(_path: string): Promise<readonly string[]> {
    throw new Error(
      `[@mnem/index-sqlite] getBacklinks is not implemented yet (path=${this.options.path})`,
    )
  }

  async getOutgoingLinks(_path: string): Promise<readonly string[]> {
    throw new Error(
      `[@mnem/index-sqlite] getOutgoingLinks is not implemented yet (path=${this.options.path})`,
    )
  }

  async close(): Promise<void> {
    throw new Error(`[@mnem/index-sqlite] close is not implemented yet (path=${this.options.path})`)
  }
}
