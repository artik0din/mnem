import type { IndexAdapter, IndexedNote, SearchResult } from '@mnem/core'

export interface PostgresIndexOptions {
  /** Postgres connection string, e.g. postgres://user:pass@host:5432/db */
  readonly connectionString: string
  /** Optional schema prefix (default: public). */
  readonly schema?: string
  /** Optional table prefix (default: mnem_). */
  readonly tablePrefix?: string
}

/**
 * PostgreSQL-backed index adapter. Uses `pgvector` for semantic search and
 * `tsvector` for full-text search. Designed for multi-tenant deployments
 * that already run a shared Postgres instance.
 *
 * Implementation is scheduled for v0.1.
 */
export class PostgresIndex implements IndexAdapter {
  private readonly options: PostgresIndexOptions

  constructor(options: PostgresIndexOptions) {
    this.options = options
  }

  async upsertNote(_note: IndexedNote): Promise<void> {
    throw new Error(
      `[@mnem/index-postgres] upsertNote is not implemented yet (schema=${this.options.schema ?? 'public'})`,
    )
  }

  async deleteNote(_path: string): Promise<void> {
    throw new Error(
      `[@mnem/index-postgres] deleteNote is not implemented yet (schema=${this.options.schema ?? 'public'})`,
    )
  }

  async searchFullText(_query: string, _topK: number): Promise<readonly SearchResult[]> {
    throw new Error(
      `[@mnem/index-postgres] searchFullText is not implemented yet (schema=${this.options.schema ?? 'public'})`,
    )
  }

  async searchSemantic(
    _embedding: readonly number[],
    _topK: number,
  ): Promise<readonly SearchResult[]> {
    throw new Error(
      `[@mnem/index-postgres] searchSemantic is not implemented yet (schema=${this.options.schema ?? 'public'})`,
    )
  }

  async getBacklinks(_path: string): Promise<readonly string[]> {
    throw new Error(
      `[@mnem/index-postgres] getBacklinks is not implemented yet (schema=${this.options.schema ?? 'public'})`,
    )
  }

  async getOutgoingLinks(_path: string): Promise<readonly string[]> {
    throw new Error(
      `[@mnem/index-postgres] getOutgoingLinks is not implemented yet (schema=${this.options.schema ?? 'public'})`,
    )
  }

  async close(): Promise<void> {
    throw new Error(
      `[@mnem/index-postgres] close is not implemented yet (schema=${this.options.schema ?? 'public'})`,
    )
  }
}
