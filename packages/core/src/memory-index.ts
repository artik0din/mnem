import type { IndexAdapter, IndexedNote, SearchResult } from './types.js'

/**
 * In-memory index adapter. Used by core for default behavior and by tests.
 * Not intended for production at scale.
 */
export class MemoryIndex implements IndexAdapter {
  private readonly notes = new Map<string, IndexedNote>()

  async upsertNote(note: IndexedNote): Promise<void> {
    this.notes.set(note.path, note)
  }

  async deleteNote(path: string): Promise<void> {
    this.notes.delete(path)
  }

  async searchFullText(query: string, topK: number): Promise<readonly SearchResult[]> {
    const lower = query.toLowerCase()
    const matches: SearchResult[] = []
    for (const note of this.notes.values()) {
      const haystack = note.content.toLowerCase()
      const idx = haystack.indexOf(lower)
      if (idx === -1) continue
      const start = Math.max(0, idx - 40)
      const end = Math.min(note.content.length, idx + query.length + 40)
      matches.push({
        path: note.path,
        score: 1,
        snippet: note.content.slice(start, end),
      })
    }
    return matches.slice(0, topK)
  }

  async searchSemantic(
    embedding: readonly number[],
    topK: number,
  ): Promise<readonly SearchResult[]> {
    const scored: SearchResult[] = []
    for (const note of this.notes.values()) {
      if (note.embedding === undefined) continue
      const score = cosineSimilarity(embedding, note.embedding)
      scored.push({
        path: note.path,
        score,
        snippet: note.content.slice(0, 120),
      })
    }
    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, topK)
  }

  async getBacklinks(path: string): Promise<readonly string[]> {
    const results: string[] = []
    for (const note of this.notes.values()) {
      if (note.links.includes(path)) {
        results.push(note.path)
      }
    }
    return results
  }

  async getOutgoingLinks(path: string): Promise<readonly string[]> {
    const note = this.notes.get(path)
    if (note === undefined) return []
    return note.links
  }

  async close(): Promise<void> {
    this.notes.clear()
  }
}

function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Embedding dimension mismatch: ${a.length} vs ${b.length}`)
  }
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
