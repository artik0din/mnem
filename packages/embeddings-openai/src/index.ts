import OpenAI from 'openai'
import type { EmbeddingProvider } from '@mnem/core'

export interface OpenAIEmbeddingsOptions {
  readonly apiKey: string
  readonly model?: string
  readonly baseURL?: string
  /** Max number of inputs per API call. Defaults to 100 (OpenAI server limit). */
  readonly batchSize?: number
  /** Max retry attempts on transient errors (429/5xx). Defaults to 3. */
  readonly maxRetries?: number
  /**
   * Inject a custom OpenAI client instance. Primarily useful for tests. When
   * provided, `apiKey` and `baseURL` are ignored.
   */
  readonly client?: OpenAI
}

const MODEL_DIMENSIONS: Record<string, number> = {
  'text-embedding-3-small': 1536,
  'text-embedding-3-large': 3072,
  'text-embedding-ada-002': 1536,
}

const DEFAULT_MODEL = 'text-embedding-3-small'
const DEFAULT_BATCH = 100
const DEFAULT_RETRIES = 3

/**
 * OpenAI embeddings provider. Wraps the official OpenAI SDK with configurable
 * batching and automatic retries on transient errors (HTTP 429 and 5xx).
 */
export class OpenAIEmbeddings implements EmbeddingProvider {
  readonly dimension: number
  readonly modelId: string
  private readonly client: OpenAI
  private readonly batchSize: number
  private readonly maxRetries: number

  constructor(options: OpenAIEmbeddingsOptions) {
    this.modelId = options.model ?? DEFAULT_MODEL
    const dim = MODEL_DIMENSIONS[this.modelId]
    if (dim === undefined) {
      throw new Error(
        `[@mnem/embeddings-openai] Unknown model "${this.modelId}". ` +
          `Known models: ${Object.keys(MODEL_DIMENSIONS).join(', ')}`,
      )
    }
    this.dimension = dim
    this.batchSize = options.batchSize ?? DEFAULT_BATCH
    this.maxRetries = options.maxRetries ?? DEFAULT_RETRIES
    if (options.client !== undefined) {
      this.client = options.client
    } else {
      const clientOptions: { apiKey: string; baseURL?: string } = {
        apiKey: options.apiKey,
      }
      if (options.baseURL !== undefined) {
        clientOptions.baseURL = options.baseURL
      }
      this.client = new OpenAI(clientOptions)
    }
  }

  async embed(texts: readonly string[]): Promise<readonly (readonly number[])[]> {
    if (texts.length === 0) return []
    const out: number[][] = new Array(texts.length)
    for (let offset = 0; offset < texts.length; offset += this.batchSize) {
      const batch = texts.slice(offset, offset + this.batchSize)
      const vectors = await this.embedBatch(batch)
      for (let i = 0; i < vectors.length; i++) {
        const vec = vectors[i]
        if (vec === undefined) {
          throw new Error(
            `[@mnem/embeddings-openai] OpenAI returned ${vectors.length} vectors for ${batch.length} inputs`,
          )
        }
        out[offset + i] = vec
      }
    }
    return out
  }

  private async embedBatch(batch: readonly string[]): Promise<number[][]> {
    let lastError: unknown
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const res = await this.client.embeddings.create({
          model: this.modelId,
          input: [...batch],
        })
        return res.data.map((row) => row.embedding)
      } catch (err) {
        lastError = err
        if (!isRetryable(err) || attempt === this.maxRetries) {
          throw err
        }
        await sleep(backoffMs(attempt))
      }
    }
    // Unreachable — the loop either returns or throws — but satisfies the
    // compiler's noImplicitReturns.
    throw lastError instanceof Error ? lastError : new Error(String(lastError))
  }
}

function isRetryable(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false
  const status = (err as { status?: unknown }).status
  if (typeof status === 'number') {
    return status === 429 || (status >= 500 && status < 600)
  }
  const code = (err as { code?: unknown }).code
  if (code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'ENOTFOUND') return true
  return false
}

function backoffMs(attempt: number): number {
  return Math.min(250 * 2 ** attempt, 4000)
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve()
  return new Promise((resolve) => setTimeout(resolve, ms))
}
