import type { EmbeddingProvider } from '@mnem/core'

export interface OpenAIEmbeddingsOptions {
  readonly apiKey: string
  readonly model?: string
  readonly baseURL?: string
}

const MODEL_DIMENSIONS: Record<string, number> = {
  'text-embedding-3-small': 1536,
  'text-embedding-3-large': 3072,
  'text-embedding-ada-002': 1536,
}

const DEFAULT_MODEL = 'text-embedding-3-small'

/**
 * OpenAI embeddings provider. Uses the official OpenAI SDK under the hood.
 *
 * Implementation is scheduled for v0.1.
 */
export class OpenAIEmbeddings implements EmbeddingProvider {
  readonly dimension: number
  readonly modelId: string
  private readonly options: OpenAIEmbeddingsOptions

  constructor(options: OpenAIEmbeddingsOptions) {
    this.options = options
    this.modelId = options.model ?? DEFAULT_MODEL
    const dim = MODEL_DIMENSIONS[this.modelId]
    if (dim === undefined) {
      throw new Error(
        `[@mnem/embeddings-openai] Unknown model "${this.modelId}". ` +
          `Known models: ${Object.keys(MODEL_DIMENSIONS).join(', ')}`,
      )
    }
    this.dimension = dim
  }

  async embed(_texts: readonly string[]): Promise<readonly (readonly number[])[]> {
    throw new Error(
      `[@mnem/embeddings-openai] embed is not implemented yet (model=${this.modelId})`,
    )
  }
}
