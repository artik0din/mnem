import Database from 'better-sqlite3'
import type { Database as DatabaseType, Statement } from 'better-sqlite3'
import type { IndexAdapter, IndexedNote, NoteFrontmatter, SearchResult } from '@mnem/core'

export interface SqliteIndexOptions {
  /** Path to the SQLite database file, or ':memory:' for an in-memory database. */
  readonly path: string
  /**
   * Optional override for the vector-extension loader. Exposed primarily for
   * tests. When `null` is passed, the extension load step is skipped entirely.
   */
  readonly loadVectorExtension?: ((db: DatabaseType) => void) | null
}

/**
 * SQLite-backed index adapter using FTS5 for full-text search and `sqlite-vec`
 * (when available) for semantic vector search. When the vector extension
 * cannot be loaded — typically because prebuilt binaries are not available on
 * the host — full-text search and graph queries keep working and semantic
 * search degrades gracefully to returning an empty result set.
 */
export class SqliteIndex implements IndexAdapter {
  private readonly db: DatabaseType
  private readonly vectorEnabled: boolean
  private readonly stmts: {
    upsertNote: Statement
    deleteNote: Statement
    deleteLinks: Statement
    insertLink: Statement
    upsertEmbedding: Statement
    deleteEmbedding: Statement
    deleteFts: Statement
    insertFts: Statement
    searchFts: Statement
    searchSemantic: Statement | undefined
    allEmbeddings: Statement
    getBacklinks: Statement
    getOutgoing: Statement
  }

  constructor(options: SqliteIndexOptions) {
    this.db = new Database(options.path)
    this.db.pragma('journal_mode = WAL')
    this.vectorEnabled = tryLoadVectorExtension(this.db, options.loadVectorExtension)
    this.initializeSchema()
    this.stmts = {
      upsertNote: this.db.prepare(
        `INSERT INTO notes (path, content, frontmatter, updated_at)
         VALUES (@path, @content, @frontmatter, @updated_at)
         ON CONFLICT(path) DO UPDATE SET
           content = excluded.content,
           frontmatter = excluded.frontmatter,
           updated_at = excluded.updated_at`,
      ),
      deleteNote: this.db.prepare(`DELETE FROM notes WHERE path = ?`),
      deleteLinks: this.db.prepare(`DELETE FROM links WHERE from_path = ?`),
      insertLink: this.db.prepare(
        `INSERT INTO links (from_path, to_path) VALUES (?, ?)`,
      ),
      upsertEmbedding: this.db.prepare(
        `INSERT INTO embeddings (path, vector, dimension)
         VALUES (@path, @vector, @dimension)
         ON CONFLICT(path) DO UPDATE SET
           vector = excluded.vector,
           dimension = excluded.dimension`,
      ),
      deleteEmbedding: this.db.prepare(`DELETE FROM embeddings WHERE path = ?`),
      deleteFts: this.db.prepare(`DELETE FROM notes_fts WHERE path = ?`),
      insertFts: this.db.prepare(
        `INSERT INTO notes_fts (path, content) VALUES (?, ?)`,
      ),
      searchFts: this.db.prepare(
        `SELECT path, bm25(notes_fts) AS rank, snippet(notes_fts, 1, '', '', '…', 16) AS snippet
         FROM notes_fts
         WHERE notes_fts MATCH ?
         ORDER BY rank ASC
         LIMIT ?`,
      ),
      searchSemantic: undefined,
      allEmbeddings: this.db.prepare(
        `SELECT e.path, e.vector, e.dimension, n.content
         FROM embeddings e
         JOIN notes n ON n.path = e.path`,
      ),
      getBacklinks: this.db.prepare(
        `SELECT DISTINCT from_path FROM links WHERE to_path = ? ORDER BY from_path`,
      ),
      getOutgoing: this.db.prepare(
        `SELECT DISTINCT to_path FROM links WHERE from_path = ? ORDER BY to_path`,
      ),
    }
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS notes (
        path TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        frontmatter TEXT NOT NULL DEFAULT '{}',
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS links (
        from_path TEXT NOT NULL,
        to_path TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_links_from ON links(from_path);
      CREATE INDEX IF NOT EXISTS idx_links_to ON links(to_path);
      CREATE TABLE IF NOT EXISTS embeddings (
        path TEXT PRIMARY KEY,
        vector BLOB NOT NULL,
        dimension INTEGER NOT NULL
      );
      CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(path UNINDEXED, content);
    `)
  }

  async upsertNote(note: IndexedNote): Promise<void> {
    const now = Date.now()
    const tx = this.db.transaction(() => {
      this.stmts.upsertNote.run({
        path: note.path,
        content: note.content,
        frontmatter: JSON.stringify(note.frontmatter),
        updated_at: now,
      })
      this.stmts.deleteLinks.run(note.path)
      for (const target of note.links) {
        this.stmts.insertLink.run(note.path, target)
      }
      this.stmts.deleteFts.run(note.path)
      this.stmts.insertFts.run(note.path, note.content)
      if (note.embedding !== undefined) {
        this.stmts.upsertEmbedding.run({
          path: note.path,
          vector: encodeVector(note.embedding),
          dimension: note.embedding.length,
        })
      } else {
        this.stmts.deleteEmbedding.run(note.path)
      }
    })
    tx()
  }

  async deleteNote(path: string): Promise<void> {
    const tx = this.db.transaction(() => {
      this.stmts.deleteNote.run(path)
      this.stmts.deleteLinks.run(path)
      this.stmts.deleteEmbedding.run(path)
      this.stmts.deleteFts.run(path)
    })
    tx()
  }

  async searchFullText(query: string, topK: number): Promise<readonly SearchResult[]> {
    const safe = escapeFtsQuery(query)
    if (safe.length === 0) return []
    const rows = this.stmts.searchFts.all(safe, topK) as readonly {
      path: string
      rank: number
      snippet: string
    }[]
    return rows.map((row) => ({
      path: row.path,
      // bm25 produces smaller = better; invert so higher = better.
      score: row.rank === 0 ? 0 : 1 / (1 + Math.abs(row.rank)),
      snippet: row.snippet,
    }))
  }

  async searchSemantic(
    embedding: readonly number[],
    topK: number,
  ): Promise<readonly SearchResult[]> {
    if (!this.vectorEnabled) return []
    const rows = this.stmts.allEmbeddings.all() as readonly {
      path: string
      vector: Buffer
      dimension: number
      content: string
    }[]
    const scored: SearchResult[] = []
    for (const row of rows) {
      if (row.dimension !== embedding.length) continue
      const vec = decodeVector(row.vector, row.dimension)
      const score = cosineSimilarity(embedding, vec)
      scored.push({ path: row.path, score, snippet: row.content.slice(0, 120) })
    }
    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, topK)
  }

  async getBacklinks(path: string): Promise<readonly string[]> {
    const rows = this.stmts.getBacklinks.all(path) as readonly { from_path: string }[]
    return rows.map((r) => r.from_path)
  }

  async getOutgoingLinks(path: string): Promise<readonly string[]> {
    const rows = this.stmts.getOutgoing.all(path) as readonly { to_path: string }[]
    return rows.map((r) => r.to_path)
  }

  async close(): Promise<void> {
    this.db.close()
  }

  /** Expose whether the vector extension could be loaded. Primarily for diagnostics. */
  get hasSemanticSearch(): boolean {
    return this.vectorEnabled
  }

  /** Read the stored frontmatter for a note, for convenience. */
  getFrontmatter(path: string): NoteFrontmatter | undefined {
    const row = this.db
      .prepare(`SELECT frontmatter FROM notes WHERE path = ?`)
      .get(path) as { frontmatter: string } | undefined
    if (row === undefined) return undefined
    return JSON.parse(row.frontmatter) as NoteFrontmatter
  }
}

function tryLoadVectorExtension(
  db: DatabaseType,
  override: SqliteIndexOptions['loadVectorExtension'],
): boolean {
  if (override === null) return false
  if (override !== undefined) {
    try {
      override(db)
      return true
    } catch {
      logWarn('custom vector extension loader failed; semantic search disabled.')
      return false
    }
  }
  try {
    // Dynamic optional dependency. If not installed, fall back cleanly.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sqliteVec = require('sqlite-vec') as { load: (db: DatabaseType) => void }
    sqliteVec.load(db)
    return true
  } catch {
    logWarn('sqlite-vec is not available; semantic search will return empty results.')
    return false
  }
}

function logWarn(msg: string): void {
  // eslint-disable-next-line no-console
  console.warn(`[@mnem/index-sqlite] ${msg}`)
}

function encodeVector(vec: readonly number[]): Buffer {
  const buf = Buffer.alloc(vec.length * 4)
  for (let i = 0; i < vec.length; i++) {
    buf.writeFloatLE(vec[i] ?? 0, i * 4)
  }
  return buf
}

function decodeVector(buf: Buffer, dimension: number): number[] {
  const out = new Array<number>(dimension)
  for (let i = 0; i < dimension; i++) {
    out[i] = buf.readFloatLE(i * 4)
  }
  return out
}

function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    const ai = a[i] ?? 0
    const bi = b[i] ?? 0
    dot += ai * bi
    normA += ai * ai
    normB += bi * bi
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  if (denom === 0) return 0
  return dot / denom
}

const FTS_SPECIAL = /["()]/g

function escapeFtsQuery(query: string): string {
  return query
    .replace(FTS_SPECIAL, ' ')
    .split(/\s+/)
    .map((tok) => tok.trim())
    .filter((tok) => tok.length > 0)
    .map((tok) => `"${tok}"`)
    .join(' ')
}
