import { describe, expect, it, vi } from 'vitest'
import { OpenAIEmbeddings } from '../src/index.js'

function makeFakeClient(
  handler: (input: {
    model: string
    input: string[]
  }) => Promise<{ data: { embedding: number[] }[] }>,
): { create: typeof handler; embeddings: { create: typeof handler } } {
  const impl = async (input: {
    model: string
    input: string[]
  }): Promise<{ data: { embedding: number[] }[] }> => handler(input)
  return {
    create: impl,
    embeddings: { create: impl },
  }
}

describe('OpenAIEmbeddings', () => {
  it('exposes model and dimension based on the model id', () => {
    const e = new OpenAIEmbeddings({ apiKey: 'x', model: 'text-embedding-3-small' })
    expect(e.modelId).toBe('text-embedding-3-small')
    expect(e.dimension).toBe(1536)
  })

  it('rejects an unknown model', () => {
    expect(() => new OpenAIEmbeddings({ apiKey: 'x', model: 'bogus' })).toThrow(
      /Unknown model/,
    )
  })

  it('returns an empty array for an empty input list without calling OpenAI', async () => {
    const fake = vi.fn()
    const e = new OpenAIEmbeddings({
      apiKey: 'x',
      // @ts-expect-error fake client
      client: { embeddings: { create: fake } },
    })
    expect(await e.embed([])).toEqual([])
    expect(fake).not.toHaveBeenCalled()
  })

  it('batches inputs and concatenates the results', async () => {
    const fake = makeFakeClient(async ({ input }) => ({
      data: input.map((t) => ({ embedding: Array<number>(3).fill(t.length) })),
    }))
    const e = new OpenAIEmbeddings({
      apiKey: 'x',
      batchSize: 2,
      // @ts-expect-error fake client has the subset of shape we need
      client: fake,
    })
    const res = await e.embed(['a', 'bb', 'ccc'])
    expect(res).toHaveLength(3)
    expect(res[0]).toEqual([1, 1, 1])
    expect(res[1]).toEqual([2, 2, 2])
    expect(res[2]).toEqual([3, 3, 3])
  })

  it('retries on 429 then succeeds', async () => {
    let calls = 0
    const handler = async (): Promise<{ data: { embedding: number[] }[] }> => {
      calls += 1
      if (calls <= 2) {
        const err = new Error('rate limited') as Error & { status: number }
        err.status = 429
        throw err
      }
      return { data: [{ embedding: [1, 2, 3] }] }
    }
    const e = new OpenAIEmbeddings({
      apiKey: 'x',
      maxRetries: 3,
      // @ts-expect-error fake client
      client: { embeddings: { create: handler } },
    })
    const res = await e.embed(['hi'])
    expect(res).toEqual([[1, 2, 3]])
    expect(calls).toBe(3)
  })

  it('gives up after maxRetries transient errors', async () => {
    const err = new Error('server oops') as Error & { status: number }
    err.status = 503
    const e = new OpenAIEmbeddings({
      apiKey: 'x',
      maxRetries: 1,
      // @ts-expect-error fake client
      client: {
        embeddings: {
          create: async () => {
            throw err
          },
        },
      },
    })
    await expect(e.embed(['hi'])).rejects.toBe(err)
  })

  it('does not retry on 4xx errors that are not 429', async () => {
    let calls = 0
    const handler = async (): Promise<{ data: { embedding: number[] }[] }> => {
      calls += 1
      const err = new Error('bad input') as Error & { status: number }
      err.status = 400
      throw err
    }
    const e = new OpenAIEmbeddings({
      apiKey: 'x',
      // @ts-expect-error fake client
      client: { embeddings: { create: handler } },
    })
    await expect(e.embed(['hi'])).rejects.toMatchObject({ status: 400 })
    expect(calls).toBe(1)
  })

  it('retries on connection errors', async () => {
    let calls = 0
    const handler = async (): Promise<{ data: { embedding: number[] }[] }> => {
      calls += 1
      if (calls === 1) {
        const err = new Error('reset') as Error & { code: string }
        err.code = 'ECONNRESET'
        throw err
      }
      return { data: [{ embedding: [0] }] }
    }
    const e = new OpenAIEmbeddings({
      apiKey: 'x',
      maxRetries: 2,
      // @ts-expect-error fake client
      client: { embeddings: { create: handler } },
    })
    expect(await e.embed(['hi'])).toEqual([[0]])
    expect(calls).toBe(2)
  })
})
