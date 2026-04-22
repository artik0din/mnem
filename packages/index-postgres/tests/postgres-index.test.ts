import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PostgresIndex } from '../src/index.js'
import type { PostgresSqlClient } from '../src/index.js'

interface CallLog {
  query: string
  params: unknown[] | undefined
}

interface FakeClient {
  sql: PostgresSqlClient
  calls: CallLog[]
  setResponse: (matcher: string | RegExp, rows: unknown[]) => void
  setRejection: (matcher: string | RegExp, error: Error) => void
  ended: boolean
}

function makeFakeClient(): FakeClient {
  const calls: CallLog[] = []
  const responses: Array<{ matcher: string | RegExp; rows?: unknown[]; error?: Error }> = []
  const matchResponse = (query: string): (typeof responses)[number] | undefined => {
    for (const r of responses) {
      if (typeof r.matcher === 'string') {
        if (query.includes(r.matcher)) return r
      } else {
        if (r.matcher.test(query)) return r
      }
    }
    return undefined
  }
  const sql = ((): PostgresSqlClient => {
    const fn = ((): unknown => {
      throw new Error('template string form is not used in this adapter')
    }) as unknown as PostgresSqlClient
    fn.unsafe = async (query: string, params?: unknown[]): Promise<unknown[]> => {
      calls.push({ query, params })
      const match = matchResponse(query)
      if (match?.error !== undefined) throw match.error
      return match?.rows ?? []
    }
    fn.end = async (): Promise<void> => {
      client.ended = true
    }
    return fn
  })()
  const client: FakeClient = {
    sql,
    calls,
    setResponse: (matcher, rows) => {
      responses.push({ matcher, rows })
    },
    setRejection: (matcher, error) => {
      responses.push({ matcher, error })
    },
    ended: false,
  }
  return client
}

let fake: FakeClient

beforeEach(() => {
  fake = makeFakeClient()
})

async function makeIndex(opts: { vectorAvailable?: boolean } = {}): Promise<PostgresIndex> {
  if (opts.vectorAvailable === false) {
    fake.setRejection(/CREATE EXTENSION IF NOT EXISTS vector/, new Error('not available'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  }
  const idx = new PostgresIndex({ sql: fake.sql })
  // Wait for initialization to settle.
  await idx.getBacklinks('bootstrap')
  return idx
}

describe('PostgresIndex', () => {
  it('runs migrations on startup', async () => {
    const idx = await makeIndex()
    const queries = fake.calls.map((c) => c.query).join('\n')
    expect(queries).toContain('CREATE EXTENSION IF NOT EXISTS vector')
    expect(queries).toContain('CREATE TABLE IF NOT EXISTS "public"."mnem_notes"')
    expect(queries).toContain('CREATE TABLE IF NOT EXISTS "public"."mnem_links"')
    expect(queries).toContain('CREATE TABLE IF NOT EXISTS "public"."mnem_embeddings"')
    expect(queries).toContain('embedding vector')
    await idx.close()
  })

  it('falls back to a raw-array embeddings table when pgvector is missing', async () => {
    const idx = await makeIndex({ vectorAvailable: false })
    const queries = fake.calls.map((c) => c.query).join('\n')
    expect(queries).toContain('embedding_raw DOUBLE PRECISION[]')
    expect(idx.hasSemanticSearch).toBe(false)
    await idx.close()
  })

  it('upserts a note with links and embedding', async () => {
    const idx = await makeIndex()
    fake.calls.length = 0
    await idx.upsertNote({
      path: 'a.md',
      content: 'hello',
      frontmatter: { tag: 'x' },
      links: ['b.md', 'c.md'],
      embedding: [0.1, 0.2, 0.3],
    })
    const queries = fake.calls.map((c) => c.query)
    expect(queries.some((q) => q.startsWith('INSERT INTO "public"."mnem_notes"'))).toBe(true)
    expect(queries.some((q) => q.startsWith('DELETE FROM "public"."mnem_links"'))).toBe(true)
    expect(
      queries.filter((q) => q.startsWith('INSERT INTO "public"."mnem_links"')),
    ).toHaveLength(2)
    expect(
      queries.some((q) => q.startsWith('INSERT INTO "public"."mnem_embeddings"')),
    ).toBe(true)
  })

  it('deletes the embedding when note upserted without one', async () => {
    const idx = await makeIndex()
    fake.calls.length = 0
    await idx.upsertNote({
      path: 'a.md',
      content: 'hello',
      frontmatter: {},
      links: [],
    })
    const queries = fake.calls.map((c) => c.query)
    expect(
      queries.some((q) => q.startsWith('DELETE FROM "public"."mnem_embeddings"')),
    ).toBe(true)
  })

  it('searchFullText returns rows with numeric score', async () => {
    const idx = await makeIndex()
    fake.setResponse('FROM "public"."mnem_notes"', [
      { path: 'a.md', score: '0.73', snippet: '…hello…' },
    ])
    const results = await idx.searchFullText('hello', 5)
    expect(results).toEqual([{ path: 'a.md', score: 0.73, snippet: '…hello…' }])
    await idx.close()
  })

  it('searchSemantic returns rows when pgvector is available', async () => {
    const idx = await makeIndex()
    fake.setResponse(
      /SELECT e\.path AS path[\s\S]*FROM "public"\."mnem_embeddings"/,
      [{ path: 'a.md', score: 0.9, snippet: 'hi' }],
    )
    const results = await idx.searchSemantic([0.1, 0.2, 0.3], 5)
    expect(results).toEqual([{ path: 'a.md', score: 0.9, snippet: 'hi' }])
    await idx.close()
  })

  it('searchSemantic returns empty when pgvector is unavailable', async () => {
    const idx = await makeIndex({ vectorAvailable: false })
    const results = await idx.searchSemantic([0.1, 0.2, 0.3], 5)
    expect(results).toEqual([])
    await idx.close()
  })

  it('getBacklinks and getOutgoingLinks return the from/to columns', async () => {
    const idx = await makeIndex()
    fake.setResponse(/WHERE to_path = \$1 ORDER BY from_path/, [
      { from_path: 'a.md' },
      { from_path: 'b.md' },
    ])
    fake.setResponse(/WHERE from_path = \$1 ORDER BY to_path/, [{ to_path: 'x.md' }])
    expect(await idx.getBacklinks('target.md')).toEqual(['a.md', 'b.md'])
    expect(await idx.getOutgoingLinks('a.md')).toEqual(['x.md'])
    await idx.close()
  })

  it('deleteNote deletes from every table', async () => {
    const idx = await makeIndex()
    fake.calls.length = 0
    await idx.deleteNote('a.md')
    const queries = fake.calls.map((c) => c.query)
    expect(queries.some((q) => q.includes('DELETE FROM "public"."mnem_notes"'))).toBe(true)
    expect(queries.some((q) => q.includes('DELETE FROM "public"."mnem_links"'))).toBe(true)
    expect(queries.some((q) => q.includes('DELETE FROM "public"."mnem_embeddings"'))).toBe(true)
  })

  it('close does not end an injected client', async () => {
    const idx = await makeIndex()
    await idx.close()
    expect(fake.ended).toBe(false)
  })

  it('throws when neither sql nor connectionString is provided', () => {
    expect(() => new PostgresIndex({})).toThrow(/connectionString/)
  })

  it('respects custom schema and tablePrefix', async () => {
    const idx = new PostgresIndex({
      sql: fake.sql,
      schema: 'myschema',
      tablePrefix: 'tenant_',
    })
    await idx.getBacklinks('x')
    const queries = fake.calls.map((c) => c.query).join('\n')
    expect(queries).toContain('"myschema"."tenant_notes"')
    expect(queries).toContain('"myschema"."tenant_links"')
    await idx.close()
  })

  it('skipMigrations avoids running the boot-time DDL', async () => {
    const idx = new PostgresIndex({ sql: fake.sql, skipMigrations: true })
    await idx.getBacklinks('x')
    const queries = fake.calls.map((c) => c.query).join('\n')
    expect(queries).not.toContain('CREATE TABLE IF NOT EXISTS')
    await idx.close()
  })
})
