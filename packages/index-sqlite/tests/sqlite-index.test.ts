import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { SqliteIndex } from '../src/index.js'

function makeIndex(opts: { withVector?: boolean } = {}): SqliteIndex {
  return new SqliteIndex({
    path: ':memory:',
    loadVectorExtension: opts.withVector === true ? () => {} : null,
  })
}

describe('SqliteIndex', () => {
  let index: SqliteIndex

  beforeEach(() => {
    index = makeIndex()
  })

  afterEach(async () => {
    await index.close()
  })

  it('round-trips a note with links', async () => {
    await index.upsertNote({
      path: 'a.md',
      content: 'hello world',
      frontmatter: { tag: 'x' },
      links: ['b.md', 'c.md'],
    })
    expect(await index.getOutgoingLinks('a.md')).toEqual(['b.md', 'c.md'])
    expect(await index.getBacklinks('b.md')).toEqual(['a.md'])
    expect(index.getFrontmatter('a.md')).toEqual({ tag: 'x' })
  })

  it('upsert replaces the link set on re-index', async () => {
    await index.upsertNote({
      path: 'a.md',
      content: 'v1',
      frontmatter: {},
      links: ['b.md'],
    })
    await index.upsertNote({
      path: 'a.md',
      content: 'v2',
      frontmatter: {},
      links: ['c.md'],
    })
    expect(await index.getOutgoingLinks('a.md')).toEqual(['c.md'])
    expect(await index.getBacklinks('b.md')).toEqual([])
  })

  it('full-text search finds matching notes', async () => {
    await index.upsertNote({
      path: 'a.md',
      content: 'the quick brown fox',
      frontmatter: {},
      links: [],
    })
    await index.upsertNote({
      path: 'b.md',
      content: 'lorem ipsum',
      frontmatter: {},
      links: [],
    })
    const results = await index.searchFullText('fox', 10)
    expect(results).toHaveLength(1)
    expect(results[0]?.path).toBe('a.md')
    expect(results[0]?.score).toBeGreaterThan(0)
  })

  it('full-text search returns empty for blank query', async () => {
    await index.upsertNote({
      path: 'a.md',
      content: 'content',
      frontmatter: {},
      links: [],
    })
    expect(await index.searchFullText('  ', 10)).toEqual([])
  })

  it('full-text search escapes special FTS characters', async () => {
    await index.upsertNote({
      path: 'a.md',
      content: 'the cat sat',
      frontmatter: {},
      links: [],
    })
    const results = await index.searchFullText('"cat"', 10)
    expect(results).toHaveLength(1)
  })

  it('semantic search returns empty when the vector extension is disabled', async () => {
    await index.upsertNote({
      path: 'a.md',
      content: 'x',
      frontmatter: {},
      links: [],
      embedding: [1, 0, 0],
    })
    expect(await index.searchSemantic([1, 0, 0], 10)).toEqual([])
    expect(index.hasSemanticSearch).toBe(false)
  })

  it('semantic search ranks by cosine similarity when enabled', async () => {
    const idx = makeIndex({ withVector: true })
    try {
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
      expect(results).toHaveLength(2)
    } finally {
      await idx.close()
    }
  })

  it('semantic search skips embeddings with a different dimension', async () => {
    const idx = makeIndex({ withVector: true })
    try {
      await idx.upsertNote({
        path: 'a.md',
        content: 'x',
        frontmatter: {},
        links: [],
        embedding: [1, 2, 3, 4],
      })
      expect(await idx.searchSemantic([1, 0, 0], 10)).toEqual([])
    } finally {
      await idx.close()
    }
  })

  it('upsert removes a previous embedding when none is provided', async () => {
    const idx = makeIndex({ withVector: true })
    try {
      await idx.upsertNote({
        path: 'a.md',
        content: 'x',
        frontmatter: {},
        links: [],
        embedding: [1, 0, 0],
      })
      await idx.upsertNote({
        path: 'a.md',
        content: 'x',
        frontmatter: {},
        links: [],
      })
      expect(await idx.searchSemantic([1, 0, 0], 10)).toEqual([])
    } finally {
      await idx.close()
    }
  })

  it('deleteNote removes notes, links, embeddings and FTS entry', async () => {
    await index.upsertNote({
      path: 'a.md',
      content: 'alpha',
      frontmatter: {},
      links: ['b.md'],
    })
    await index.deleteNote('a.md')
    expect(await index.getOutgoingLinks('a.md')).toEqual([])
    expect(await index.getBacklinks('b.md')).toEqual([])
    expect(await index.searchFullText('alpha', 10)).toEqual([])
    expect(index.getFrontmatter('a.md')).toBeUndefined()
  })

  it('falls back to empty semantic search when the loader throws', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const idx = new SqliteIndex({
      path: ':memory:',
      loadVectorExtension: () => {
        throw new Error('boom')
      },
    })
    try {
      expect(idx.hasSemanticSearch).toBe(false)
      expect(await idx.searchSemantic([1, 0, 0], 10)).toEqual([])
      expect(warn).toHaveBeenCalled()
    } finally {
      await idx.close()
      warn.mockRestore()
    }
  })
})
