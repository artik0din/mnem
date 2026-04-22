import type { SearchResult } from '@mnem/core'
import { loadVaultFrom } from '../vault-loader.js'

export interface SearchOptions {
  readonly query: string
  readonly topK: number
  readonly startDir: string
}

export interface SearchReport {
  readonly fullText: readonly SearchResult[]
  readonly semantic: readonly SearchResult[] | undefined
}

export async function runSearch(options: SearchOptions): Promise<SearchReport> {
  const { vault, config } = await loadVaultFrom(options.startDir)
  try {
    const fullText = await vault.searchFullText({
      query: options.query,
      topK: options.topK,
    })
    let semantic: readonly SearchResult[] | undefined
    const hasEmbeddings = config.embeddings?.type === 'openai'
    if (hasEmbeddings) {
      try {
        semantic = await vault.searchSemantic({
          query: options.query,
          topK: options.topK,
        })
      } catch {
        semantic = undefined
      }
    }
    return { fullText, semantic }
  } finally {
    await vault.close()
  }
}
