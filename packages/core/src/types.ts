/**
 * Public type definitions for Mnem core.
 *
 * These types form the stable contract between consumer code and Mnem adapters.
 */

export interface NoteFrontmatter {
  readonly [key: string]: unknown
}

export interface Note {
  readonly path: string
  readonly frontmatter: NoteFrontmatter
  readonly content: string
}

export interface WriteNoteInput {
  readonly path: string
  readonly content: string
  readonly frontmatter?: NoteFrontmatter
}

export interface AppendNoteInput {
  readonly path: string
  readonly content: string
}

export interface PatchNoteInput {
  readonly path: string
  readonly find: string
  readonly replace: string
}

export interface ReadNoteInput {
  readonly path: string
}

export interface DeleteNoteInput {
  readonly path: string
}

export interface SearchResult {
  readonly path: string
  readonly score: number
  readonly snippet: string
}

export interface FullTextSearchInput {
  readonly query: string
  readonly topK?: number
}

export interface SemanticSearchInput {
  readonly query: string
  readonly topK?: number
}

export interface GraphSearchInput {
  readonly startNote: string
  readonly depth?: number
}

export interface IndexedNote {
  readonly path: string
  readonly content: string
  readonly frontmatter: NoteFrontmatter
  readonly links: readonly string[]
  readonly embedding?: readonly number[]
}

/**
 * Storage adapter contract. Responsible for raw bytes persistence.
 */
export interface StorageAdapter {
  read(path: string): Promise<string>
  write(path: string, content: string): Promise<void>
  delete(path: string): Promise<void>
  exists(path: string): Promise<boolean>
  list(prefix?: string): AsyncIterable<string>
}

/**
 * Index adapter contract. Responsible for fast lookup by path, by full-text,
 * by semantic similarity, and for traversing the backlinks graph.
 */
export interface IndexAdapter {
  upsertNote(note: IndexedNote): Promise<void>
  deleteNote(path: string): Promise<void>
  searchFullText(query: string, topK: number): Promise<readonly SearchResult[]>
  searchSemantic(embedding: readonly number[], topK: number): Promise<readonly SearchResult[]>
  getBacklinks(path: string): Promise<readonly string[]>
  getOutgoingLinks(path: string): Promise<readonly string[]>
  close(): Promise<void>
}

/**
 * Embedding provider contract. Responsible for turning text into vectors.
 */
export interface EmbeddingProvider {
  readonly dimension: number
  readonly modelId: string
  embed(texts: readonly string[]): Promise<readonly (readonly number[])[]>
}

export interface VaultConfig {
  readonly storage: StorageAdapter
  readonly index?: IndexAdapter
  readonly embeddings?: EmbeddingProvider
}

export interface Vault {
  writeNote(input: WriteNoteInput): Promise<void>
  readNote(input: ReadNoteInput): Promise<Note>
  appendNote(input: AppendNoteInput): Promise<void>
  patchNote(input: PatchNoteInput): Promise<void>
  deleteNote(input: DeleteNoteInput): Promise<void>
  searchFullText(input: FullTextSearchInput): Promise<readonly SearchResult[]>
  searchSemantic(input: SemanticSearchInput): Promise<readonly SearchResult[]>
  searchGraph(input: GraphSearchInput): Promise<readonly string[]>
  getBacklinks(input: ReadNoteInput): Promise<readonly string[]>
  getOutgoingLinks(input: ReadNoteInput): Promise<readonly string[]>
  close(): Promise<void>
}
