import postgres from 'postgres'
import type { IndexAdapter, IndexedNote, SearchResult } from '@mnem/core'

/**
 * Minimal tagged-template postgres driver interface used by PostgresIndex.
 * Matches the surface exposed by the `postgres` package.
 */
export interface PostgresSqlClient {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]> & {
    // postgres lib returns a tagged result shape; we only read array-style rows.
  }
  unsafe: (query: string, params?: unknown[]) => Promise<unknown[]>
  end: () => Promise<void>
}

export interface PostgresIndexOptions {
  /** Postgres connection string, e.g. postgres://user:pass@host:5432/db */
  readonly connectionString?: string
  /** Optional schema prefix (default: public). */
  readonly schema?: string
  /** Optional table prefix (default: mnem_). */
  readonly tablePrefix?: string
  /**
   * Inject a pre-built sql client. When omitted, a new `postgres` client is
   * created from `connectionString`. Primarily useful for tests.
   */
  readonly sql?: PostgresSqlClient
  /**
   * When true, skip boot-time migrations. Useful when the schema is managed
   * externally (migrations tool, SaaS owner). Defaults to false.
   */
  readonly skipMigrations?: boolean
}

/**
 * PostgreSQL-backed index adapter. Uses `pgvector` for semantic search when
 * the extension is available, falling back to an empty result set otherwise.
 * Full-text search uses `tsvector` and `tsquery`. Designed for multi-tenant
 * deployments that already run a shared Postgres instance.
 */
export class PostgresIndex implements IndexAdapter {
  private readonly sql: PostgresSqlClient
  private readonly ownsClient: boolean
  private readonly schema: string
  private readonly tablePrefix: string
  private initializePromise: Promise<void> | undefined
  private vectorEnabled = false

  constructor(options: PostgresIndexOptions) {
    this.schema = options.schema ?? 'public'
    this.tablePrefix = options.tablePrefix ?? 'mnem_'
    if (options.sql !== undefined) {
      this.sql = options.sql
      this.ownsClient = false
    } else if (options.connectionString !== undefined) {
      this.sql = postgres(options.connectionString) as unknown as PostgresSqlClient
      this.ownsClient = true
    } else {
      throw new Error(
        '[@mnem/index-postgres] either `connectionString` or `sql` must be provided',
      )
    }
    if (options.skipMigrations !== true) {
      this.initializePromise = this.initialize()
    } else {
      this.initializePromise = Promise.resolve()
    }
  }

  private get notesTable(): string {
    return `"${this.schema}"."${this.tablePrefix}notes"`
  }

  private get linksTable(): string {
    return `"${this.schema}"."${this.tablePrefix}links"`
  }

  private get embeddingsTable(): string {
    return `"${this.schema}"."${this.tablePrefix}embeddings"`
  }

  private async initialize(): Promise<void> {
    try {
      await this.sql.unsafe(`CREATE EXTENSION IF NOT EXISTS vector`)
      this.vectorEnabled = true
    } catch {
      logWarn(
        'pgvector extension is not available; semantic search will return empty results.',
      )
      this.vectorEnabled = false
    }
    await this.sql.unsafe(`CREATE SCHEMA IF NOT EXISTS "${this.schema}"`)
    await this.sql.unsafe(
      `CREATE TABLE IF NOT EXISTS ${this.notesTable} (
         path TEXT PRIMARY KEY,
         content TEXT NOT NULL,
         frontmatter JSONB NOT NULL DEFAULT '{}'::jsonb,
         tsv tsvector,
         updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
       )`,
    )
    await this.sql.unsafe(
      `CREATE INDEX IF NOT EXISTS ${this.tablePrefix}notes_tsv
         ON ${this.notesTable} USING GIN (tsv)`,
    )
    await this.sql.unsafe(
      `CREATE TABLE IF NOT EXISTS ${this.linksTable} (
         from_path TEXT NOT NULL,
         to_path TEXT NOT NULL
       )`,
    )
    await this.sql.unsafe(
      `CREATE INDEX IF NOT EXISTS ${this.tablePrefix}links_from
         ON ${this.linksTable} (from_path)`,
    )
    await this.sql.unsafe(
      `CREATE INDEX IF NOT EXISTS ${this.tablePrefix}links_to
         ON ${this.linksTable} (to_path)`,
    )
    if (this.vectorEnabled) {
      await this.sql.unsafe(
        `CREATE TABLE IF NOT EXISTS ${this.embeddingsTable} (
           path TEXT PRIMARY KEY,
           embedding vector,
           dimension INTEGER NOT NULL
         )`,
      )
    } else {
      await this.sql.unsafe(
        `CREATE TABLE IF NOT EXISTS ${this.embeddingsTable} (
           path TEXT PRIMARY KEY,
           embedding_raw DOUBLE PRECISION[] NOT NULL,
           dimension INTEGER NOT NULL
         )`,
      )
    }
  }

  private async ensureReady(): Promise<void> {
    if (this.initializePromise !== undefined) {
      await this.initializePromise
    }
  }

  async upsertNote(note: IndexedNote): Promise<void> {
    await this.ensureReady()
    const frontmatter = JSON.stringify(note.frontmatter)
    await this.sql.unsafe(
      `INSERT INTO ${this.notesTable} (path, content, frontmatter, tsv, updated_at)
       VALUES ($1, $2, $3::jsonb, to_tsvector('english', $2), now())
       ON CONFLICT (path) DO UPDATE SET
         content = EXCLUDED.content,
         frontmatter = EXCLUDED.frontmatter,
         tsv = EXCLUDED.tsv,
         updated_at = now()`,
      [note.path, note.content, frontmatter],
    )
    await this.sql.unsafe(`DELETE FROM ${this.linksTable} WHERE from_path = $1`, [note.path])
    for (const target of note.links) {
      await this.sql.unsafe(
        `INSERT INTO ${this.linksTable} (from_path, to_path) VALUES ($1, $2)`,
        [note.path, target],
      )
    }
    if (note.embedding !== undefined) {
      if (this.vectorEnabled) {
        const vectorLit = '[' + note.embedding.map((n) => String(n)).join(',') + ']'
        await this.sql.unsafe(
          `INSERT INTO ${this.embeddingsTable} (path, embedding, dimension)
           VALUES ($1, $2::vector, $3)
           ON CONFLICT (path) DO UPDATE SET
             embedding = EXCLUDED.embedding,
             dimension = EXCLUDED.dimension`,
          [note.path, vectorLit, note.embedding.length],
        )
      } else {
        await this.sql.unsafe(
          `INSERT INTO ${this.embeddingsTable} (path, embedding_raw, dimension)
           VALUES ($1, $2, $3)
           ON CONFLICT (path) DO UPDATE SET
             embedding_raw = EXCLUDED.embedding_raw,
             dimension = EXCLUDED.dimension`,
          [note.path, Array.from(note.embedding), note.embedding.length],
        )
      }
    } else {
      await this.sql.unsafe(`DELETE FROM ${this.embeddingsTable} WHERE path = $1`, [note.path])
    }
  }

  async deleteNote(path: string): Promise<void> {
    await this.ensureReady()
    await this.sql.unsafe(`DELETE FROM ${this.notesTable} WHERE path = $1`, [path])
    await this.sql.unsafe(`DELETE FROM ${this.linksTable} WHERE from_path = $1`, [path])
    await this.sql.unsafe(`DELETE FROM ${this.embeddingsTable} WHERE path = $1`, [path])
  }

  async searchFullText(query: string, topK: number): Promise<readonly SearchResult[]> {
    await this.ensureReady()
    const rows = (await this.sql.unsafe(
      `SELECT path,
              ts_rank_cd(tsv, plainto_tsquery('english', $1)) AS score,
              ts_headline('english', content, plainto_tsquery('english', $1),
                          'ShortWord=2,MaxFragments=1,MaxWords=16,MinWords=4') AS snippet
       FROM ${this.notesTable}
       WHERE tsv @@ plainto_tsquery('english', $1)
       ORDER BY score DESC
       LIMIT $2`,
      [query, topK],
    )) as readonly { path: string; score: number | string; snippet: string }[]
    return rows.map((r) => ({
      path: r.path,
      score: typeof r.score === 'string' ? Number(r.score) : r.score,
      snippet: r.snippet,
    }))
  }

  async searchSemantic(
    embedding: readonly number[],
    topK: number,
  ): Promise<readonly SearchResult[]> {
    await this.ensureReady()
    if (!this.vectorEnabled) return []
    const vectorLit = '[' + embedding.map((n) => String(n)).join(',') + ']'
    const rows = (await this.sql.unsafe(
      `SELECT e.path AS path,
              (1 - (e.embedding <=> $1::vector)) AS score,
              LEFT(n.content, 120) AS snippet
       FROM ${this.embeddingsTable} e
       JOIN ${this.notesTable} n ON n.path = e.path
       WHERE e.dimension = $2
       ORDER BY e.embedding <=> $1::vector ASC
       LIMIT $3`,
      [vectorLit, embedding.length, topK],
    )) as readonly { path: string; score: number | string; snippet: string }[]
    return rows.map((r) => ({
      path: r.path,
      score: typeof r.score === 'string' ? Number(r.score) : r.score,
      snippet: r.snippet,
    }))
  }

  async getBacklinks(path: string): Promise<readonly string[]> {
    await this.ensureReady()
    const rows = (await this.sql.unsafe(
      `SELECT DISTINCT from_path FROM ${this.linksTable}
       WHERE to_path = $1 ORDER BY from_path`,
      [path],
    )) as readonly { from_path: string }[]
    return rows.map((r) => r.from_path)
  }

  async getOutgoingLinks(path: string): Promise<readonly string[]> {
    await this.ensureReady()
    const rows = (await this.sql.unsafe(
      `SELECT DISTINCT to_path FROM ${this.linksTable}
       WHERE from_path = $1 ORDER BY to_path`,
      [path],
    )) as readonly { to_path: string }[]
    return rows.map((r) => r.to_path)
  }

  async close(): Promise<void> {
    await this.ensureReady()
    if (this.ownsClient) {
      await this.sql.end()
    }
  }

  /** Expose whether pgvector is available, primarily for diagnostics. */
  get hasSemanticSearch(): boolean {
    return this.vectorEnabled
  }
}

function logWarn(msg: string): void {
  // eslint-disable-next-line no-console
  console.warn(`[@mnem/index-postgres] ${msg}`)
}
