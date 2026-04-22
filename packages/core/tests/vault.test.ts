import { describe, expect, it } from 'vitest'
import {
  createVault,
  MemoryStorage,
  MemoryIndex,
  MnemError,
  NoteNotFoundError,
  InvalidNotePathError,
  EmbeddingsNotConfiguredError,
  IndexNotConfiguredError,
  extractWikilinks,
  validateNotePath,
  wikilinkTargetToPath,
} from '../src/index.js'
import type { EmbeddingProvider } from '../src/index.js'

class EmptyEmbeddings implements EmbeddingProvider {
  readonly dimension = 3
  readonly modelId = 'empty-model'
  async embed(): Promise<readonly (readonly number[])[]> {
    return []
  }
}

class FakeEmbeddings implements EmbeddingProvider {
  readonly dimension = 3
  readonly modelId = 'fake-model'
  async embed(texts: readonly string[]): Promise<readonly (readonly number[])[]> {
    return texts.map((text) => {
      const sum = text.length
      return [sum, sum / 2, sum / 3]
    })
  }
}

describe('extractWikilinks', () => {
  it('extracts plain wikilinks', () => {
    expect(extractWikilinks('see [[foo]] and [[bar]]')).toEqual(['foo', 'bar'])
  })

  it('handles aliases and heading anchors', () => {
    expect(extractWikilinks('see [[foo#heading|alias]] and [[bar]]')).toEqual(['foo', 'bar'])
  })

  it('deduplicates', () => {
    expect(extractWikilinks('[[a]] [[a]] [[b]]')).toEqual(['a', 'b'])
  })

  it('ignores empty targets', () => {
    expect(extractWikilinks('[[]] text')).toEqual([])
  })
})

describe('validateNotePath', () => {
  it('accepts valid paths', () => {
    expect(() => validateNotePath('notes/a.md')).not.toThrow()
    expect(() => validateNotePath('a.md')).not.toThrow()
  })

  it('rejects empty path', () => {
    expect(() => validateNotePath('')).toThrow(InvalidNotePathError)
  })

  it('rejects absolute paths', () => {
    expect(() => validateNotePath('/a.md')).toThrow(InvalidNotePathError)
  })

  it('rejects path traversal', () => {
    expect(() => validateNotePath('../a.md')).toThrow(InvalidNotePathError)
    expect(() => validateNotePath('foo/../a.md')).toThrow(InvalidNotePathError)
  })

  it('rejects null bytes', () => {
    expect(() => validateNotePath('a\0.md')).toThrow(InvalidNotePathError)
  })

  it('rejects non-md extension', () => {
    expect(() => validateNotePath('a.txt')).toThrow(InvalidNotePathError)
  })
})

describe('wikilinkTargetToPath', () => {
  it('adds .md extension when missing', () => {
    expect(wikilinkTargetToPath('foo')).toBe('foo.md')
  })

  it('preserves .md extension when present', () => {
    expect(wikilinkTargetToPath('foo.md')).toBe('foo.md')
  })

  it('trims whitespace', () => {
    expect(wikilinkTargetToPath('  foo  ')).toBe('foo.md')
  })
})

describe('MemoryStorage', () => {
  it('reads back what it writes', async () => {
    const s = new MemoryStorage()
    await s.write('a.md', 'hi')
    expect(await s.read('a.md')).toBe('hi')
    expect(await s.exists('a.md')).toBe(true)
  })

  it('throws when reading missing note', async () => {
    const s = new MemoryStorage()
    await expect(s.read('missing.md')).rejects.toBeInstanceOf(NoteNotFoundError)
  })

  it('throws when deleting missing note', async () => {
    const s = new MemoryStorage()
    await expect(s.delete('missing.md')).rejects.toBeInstanceOf(NoteNotFoundError)
  })

  it('lists with prefix', async () => {
    const s = new MemoryStorage()
    await s.write('a/one.md', '1')
    await s.write('a/two.md', '2')
    await s.write('b/three.md', '3')
    const all: string[] = []
    for await (const key of s.list('a/')) all.push(key)
    expect(all.sort()).toEqual(['a/one.md', 'a/two.md'])
  })

  it('lists without prefix', async () => {
    const s = new MemoryStorage()
    await s.write('a.md', '1')
    await s.write('b.md', '2')
    const all: string[] = []
    for await (const key of s.list()) all.push(key)
    expect(all.sort()).toEqual(['a.md', 'b.md'])
  })
})

describe('MemoryIndex', () => {
  it('round-trips notes', async () => {
    const idx = new MemoryIndex()
    await idx.upsertNote({
      path: 'a.md',
      content: 'hello world',
      frontmatter: {},
      links: ['b.md'],
    })
    expect(await idx.getOutgoingLinks('a.md')).toEqual(['b.md'])
    expect(await idx.getBacklinks('b.md')).toEqual(['a.md'])
  })

  it('returns empty outgoing for unknown note', async () => {
    const idx = new MemoryIndex()
    expect(await idx.getOutgoingLinks('missing.md')).toEqual([])
  })

  it('full-text search matches content', async () => {
    const idx = new MemoryIndex()
    await idx.upsertNote({
      path: 'a.md',
      content: 'Hello World',
      frontmatter: {},
      links: [],
    })
    const results = await idx.searchFullText('hello', 10)
    expect(results).toHaveLength(1)
    expect(results[0]?.path).toBe('a.md')
  })

  it('full-text search returns nothing when no match', async () => {
    const idx = new MemoryIndex()
    await idx.upsertNote({
      path: 'a.md',
      content: 'xyz',
      frontmatter: {},
      links: [],
    })
    expect(await idx.searchFullText('hello', 10)).toHaveLength(0)
  })

  it('semantic search ranks by similarity', async () => {
    const idx = new MemoryIndex()
    await idx.upsertNote({
      path: 'a.md',
      content: 'alpha',
      frontmatter: {},
      links: [],
      embedding: [1, 0, 0],
    })
    await idx.upsertNote({
      path: 'b.md',
      content: 'beta',
      frontmatter: {},
      links: [],
      embedding: [0, 1, 0],
    })
    const results = await idx.searchSemantic([1, 0, 0], 10)
    expect(results[0]?.path).toBe('a.md')
  })

  it('semantic search skips notes without embeddings', async () => {
    const idx = new MemoryIndex()
    await idx.upsertNote({ path: 'a.md', content: '', frontmatter: {}, links: [] })
    expect(await idx.searchSemantic([1, 0, 0], 10)).toHaveLength(0)
  })

  it('semantic search handles zero-magnitude vectors', async () => {
    const idx = new MemoryIndex()
    await idx.upsertNote({
      path: 'a.md',
      content: 'x',
      frontmatter: {},
      links: [],
      embedding: [0, 0, 0],
    })
    const results = await idx.searchSemantic([0, 0, 0], 10)
    expect(results[0]?.score).toBe(0)
  })

  it('rejects semantic search with dimension mismatch', async () => {
    const idx = new MemoryIndex()
    await idx.upsertNote({
      path: 'a.md',
      content: 'x',
      frontmatter: {},
      links: [],
      embedding: [1, 2, 3],
    })
    await expect(idx.searchSemantic([1, 2], 10)).rejects.toThrow(/dimension mismatch/)
  })

  it('delete removes the note from index', async () => {
    const idx = new MemoryIndex()
    await idx.upsertNote({ path: 'a.md', content: 'x', frontmatter: {}, links: [] })
    await idx.deleteNote('a.md')
    expect(await idx.getOutgoingLinks('a.md')).toEqual([])
  })

  it('close clears all notes', async () => {
    const idx = new MemoryIndex()
    await idx.upsertNote({ path: 'a.md', content: 'x', frontmatter: {}, links: [] })
    await idx.close()
    expect(await idx.getOutgoingLinks('a.md')).toEqual([])
  })
})

describe('Vault', () => {
  it('writes and reads a note', async () => {
    const vault = await createVault({ storage: new MemoryStorage() })
    await vault.writeNote({ path: 'a.md', content: 'hello' })
    const note = await vault.readNote({ path: 'a.md' })
    expect(note.content).toBe('hello')
    expect(note.frontmatter).toEqual({})
  })

  it('writes with frontmatter', async () => {
    const vault = await createVault({ storage: new MemoryStorage() })
    await vault.writeNote({
      path: 'a.md',
      content: 'body',
      frontmatter: { tag: 'x' },
    })
    const note = await vault.readNote({ path: 'a.md' })
    expect(note.frontmatter).toEqual({ tag: 'x' })
    expect(note.content.trim()).toBe('body')
  })

  it('indexes wikilinks on write', async () => {
    const vault = await createVault({ storage: new MemoryStorage() })
    await vault.writeNote({ path: 'a.md', content: 'see [[b]]' })
    expect(await vault.getOutgoingLinks({ path: 'a.md' })).toEqual(['b.md'])
    expect(await vault.getBacklinks({ path: 'b.md' })).toEqual(['a.md'])
  })

  it('appends content to an existing note', async () => {
    const vault = await createVault({ storage: new MemoryStorage() })
    await vault.writeNote({ path: 'a.md', content: 'first' })
    await vault.appendNote({ path: 'a.md', content: 'second' })
    const note = await vault.readNote({ path: 'a.md' })
    expect(note.content).toContain('first')
    expect(note.content).toContain('second')
  })

  it('appends to a non-existing note creates it', async () => {
    const vault = await createVault({ storage: new MemoryStorage() })
    await vault.appendNote({ path: 'a.md', content: 'created' })
    const note = await vault.readNote({ path: 'a.md' })
    expect(note.content).toBe('created')
  })

  it('patches a note by find/replace', async () => {
    const vault = await createVault({ storage: new MemoryStorage() })
    await vault.writeNote({ path: 'a.md', content: 'the quick fox' })
    await vault.patchNote({ path: 'a.md', find: 'quick', replace: 'slow' })
    const note = await vault.readNote({ path: 'a.md' })
    expect(note.content).toBe('the slow fox')
  })

  it('patch throws when note is missing', async () => {
    const vault = await createVault({ storage: new MemoryStorage() })
    await expect(
      vault.patchNote({ path: 'missing.md', find: 'a', replace: 'b' }),
    ).rejects.toBeInstanceOf(NoteNotFoundError)
  })

  it('deletes a note', async () => {
    const vault = await createVault({ storage: new MemoryStorage() })
    await vault.writeNote({ path: 'a.md', content: 'x' })
    await vault.deleteNote({ path: 'a.md' })
    await expect(vault.readNote({ path: 'a.md' })).rejects.toBeInstanceOf(NoteNotFoundError)
  })

  it('full-text search returns matches', async () => {
    const vault = await createVault({ storage: new MemoryStorage() })
    await vault.writeNote({ path: 'a.md', content: 'hello world' })
    const results = await vault.searchFullText({ query: 'hello' })
    expect(results).toHaveLength(1)
  })

  it('full-text search respects topK', async () => {
    const vault = await createVault({ storage: new MemoryStorage() })
    await vault.writeNote({ path: 'a.md', content: 'hello' })
    await vault.writeNote({ path: 'b.md', content: 'hello' })
    const results = await vault.searchFullText({ query: 'hello', topK: 1 })
    expect(results).toHaveLength(1)
  })

  it('semantic search throws when embeddings are not configured', async () => {
    const vault = await createVault({ storage: new MemoryStorage() })
    await expect(vault.searchSemantic({ query: 'anything' })).rejects.toBeInstanceOf(
      EmbeddingsNotConfiguredError,
    )
  })

  it('semantic search works when embeddings are configured', async () => {
    const vault = await createVault({
      storage: new MemoryStorage(),
      embeddings: new FakeEmbeddings(),
    })
    await vault.writeNote({ path: 'a.md', content: 'hello' })
    const results = await vault.searchSemantic({ query: 'hello' })
    expect(results.length).toBeGreaterThan(0)
  })

  it('graph search traverses outgoing links', async () => {
    const vault = await createVault({ storage: new MemoryStorage() })
    await vault.writeNote({ path: 'a.md', content: 'see [[b]]' })
    await vault.writeNote({ path: 'b.md', content: 'see [[c]]' })
    await vault.writeNote({ path: 'c.md', content: 'end' })
    const reached = await vault.searchGraph({ startNote: 'a.md', depth: 2 })
    expect(reached.sort()).toEqual(['b.md', 'c.md'])
  })

  it('graph search with depth 0 returns empty', async () => {
    const vault = await createVault({ storage: new MemoryStorage() })
    await vault.writeNote({ path: 'a.md', content: 'see [[b]]' })
    expect(await vault.searchGraph({ startNote: 'a.md', depth: 0 })).toEqual([])
  })

  it('graph search default depth is 1', async () => {
    const vault = await createVault({ storage: new MemoryStorage() })
    await vault.writeNote({ path: 'a.md', content: 'see [[b]]' })
    await vault.writeNote({ path: 'b.md', content: 'see [[c]]' })
    const reached = await vault.searchGraph({ startNote: 'a.md' })
    expect(reached).toEqual(['b.md'])
  })

  it('close shuts down the index', async () => {
    const vault = await createVault({ storage: new MemoryStorage() })
    await vault.writeNote({ path: 'a.md', content: 'x' })
    await vault.close()
    expect(await vault.searchFullText({ query: 'x' })).toHaveLength(0)
  })

  it('rejects invalid paths', async () => {
    const vault = await createVault({ storage: new MemoryStorage() })
    await expect(vault.writeNote({ path: '/abs.md', content: 'x' })).rejects.toBeInstanceOf(
      InvalidNotePathError,
    )
  })

  it('semantic search throws when embedding provider returns empty result', async () => {
    const vault = await createVault({
      storage: new MemoryStorage(),
      embeddings: new EmptyEmbeddings(),
    })
    await expect(vault.searchSemantic({ query: 'x' })).rejects.toBeInstanceOf(
      IndexNotConfiguredError,
    )
  })
})

describe('Error classes', () => {
  it('exposes IndexNotConfiguredError with operation name in message', () => {
    const err = new IndexNotConfiguredError('searchSemantic')
    expect(err).toBeInstanceOf(MnemError)
    expect(err.name).toBe('IndexNotConfiguredError')
    expect(err.message).toContain('searchSemantic')
  })

  it('exposes EmbeddingsNotConfiguredError with operation name in message', () => {
    const err = new EmbeddingsNotConfiguredError('searchSemantic')
    expect(err).toBeInstanceOf(MnemError)
    expect(err.name).toBe('EmbeddingsNotConfiguredError')
    expect(err.message).toContain('searchSemantic')
  })

  it('MnemError is the base class', () => {
    const err = new MnemError('test')
    expect(err.name).toBe('MnemError')
    expect(err.message).toBe('test')
  })
})
