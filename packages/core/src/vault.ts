import matter from 'gray-matter'
import type {
  AppendNoteInput,
  DeleteNoteInput,
  FullTextSearchInput,
  GraphSearchInput,
  Note,
  PatchNoteInput,
  ReadNoteInput,
  SearchResult,
  SemanticSearchInput,
  Vault,
  VaultConfig,
  WriteNoteInput,
} from './types.js'
import {
  EmbeddingsNotConfiguredError,
  IndexNotConfiguredError,
  NoteNotFoundError,
} from './errors.js'
import { MemoryIndex } from './memory-index.js'
import { validateNotePath, wikilinkTargetToPath } from './path-utils.js'
import { extractWikilinks } from './wikilinks.js'

/**
 * Create a new Vault instance from a configuration.
 *
 * The returned object is the public API surface consumers interact with.
 */
export async function createVault(config: VaultConfig): Promise<Vault> {
  return new VaultImpl(config)
}

class VaultImpl implements Vault {
  private readonly storage
  private readonly index
  private readonly embeddings

  constructor(config: VaultConfig) {
    this.storage = config.storage
    this.index = config.index ?? new MemoryIndex()
    this.embeddings = config.embeddings
  }

  async writeNote(input: WriteNoteInput): Promise<void> {
    validateNotePath(input.path)
    const serialized =
      input.frontmatter === undefined || Object.keys(input.frontmatter).length === 0
        ? input.content
        : matter.stringify(input.content, { ...input.frontmatter })
    await this.storage.write(input.path, serialized)
    await this.reindex(input.path, serialized)
  }

  async readNote(input: ReadNoteInput): Promise<Note> {
    validateNotePath(input.path)
    const raw = await this.storage.read(input.path)
    const parsed = matter(raw)
    return {
      path: input.path,
      frontmatter: parsed.data,
      content: parsed.content,
    }
  }

  async appendNote(input: AppendNoteInput): Promise<void> {
    validateNotePath(input.path)
    let existing = ''
    if (await this.storage.exists(input.path)) {
      existing = await this.storage.read(input.path)
    }
    const combined = existing.length === 0 ? input.content : `${existing}\n${input.content}`
    await this.storage.write(input.path, combined)
    await this.reindex(input.path, combined)
  }

  async patchNote(input: PatchNoteInput): Promise<void> {
    validateNotePath(input.path)
    if (!(await this.storage.exists(input.path))) {
      throw new NoteNotFoundError(input.path)
    }
    const raw = await this.storage.read(input.path)
    const patched = raw.split(input.find).join(input.replace)
    await this.storage.write(input.path, patched)
    await this.reindex(input.path, patched)
  }

  async deleteNote(input: DeleteNoteInput): Promise<void> {
    validateNotePath(input.path)
    await this.storage.delete(input.path)
    await this.index.deleteNote(input.path)
  }

  async searchFullText(input: FullTextSearchInput): Promise<readonly SearchResult[]> {
    const topK = input.topK ?? 10
    return this.index.searchFullText(input.query, topK)
  }

  async searchSemantic(input: SemanticSearchInput): Promise<readonly SearchResult[]> {
    if (this.embeddings === undefined) {
      throw new EmbeddingsNotConfiguredError('searchSemantic')
    }
    const [queryEmbedding] = await this.embeddings.embed([input.query])
    if (queryEmbedding === undefined) {
      throw new IndexNotConfiguredError('searchSemantic')
    }
    const topK = input.topK ?? 10
    return this.index.searchSemantic(queryEmbedding, topK)
  }

  async searchGraph(input: GraphSearchInput): Promise<readonly string[]> {
    const depth = input.depth ?? 1
    const visited = new Set<string>()
    const queue: { path: string; remaining: number }[] = [
      { path: input.startNote, remaining: depth },
    ]
    while (queue.length > 0) {
      const current = queue.shift()
      if (current === undefined) break
      if (visited.has(current.path)) continue
      visited.add(current.path)
      if (current.remaining <= 0) continue
      const outgoing = await this.index.getOutgoingLinks(current.path)
      for (const neighbor of outgoing) {
        queue.push({ path: neighbor, remaining: current.remaining - 1 })
      }
    }
    visited.delete(input.startNote)
    return Array.from(visited)
  }

  async getBacklinks(input: ReadNoteInput): Promise<readonly string[]> {
    return this.index.getBacklinks(input.path)
  }

  async getOutgoingLinks(input: ReadNoteInput): Promise<readonly string[]> {
    return this.index.getOutgoingLinks(input.path)
  }

  async close(): Promise<void> {
    await this.index.close()
  }

  private async reindex(path: string, serialized: string): Promise<void> {
    const parsed = matter(serialized)
    const linkTargets = extractWikilinks(parsed.content).map(wikilinkTargetToPath)
    let embedding: readonly number[] | undefined
    if (this.embeddings !== undefined) {
      const [vec] = await this.embeddings.embed([parsed.content])
      embedding = vec
    }
    await this.index.upsertNote({
      path,
      content: parsed.content,
      frontmatter: parsed.data,
      links: linkTargets,
      ...(embedding === undefined ? {} : { embedding }),
    })
  }
}
