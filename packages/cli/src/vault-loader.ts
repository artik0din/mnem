import { join } from 'node:path'
import { createVault } from '@mnem/core'
import type { EmbeddingProvider, Vault } from '@mnem/core'
import { LocalStorage } from '@mnem/storage-local'
import { SqliteIndex } from '@mnem/index-sqlite'
import type * as EmbeddingsModule from '@mnem/embeddings-openai'
import { findVaultRoot, readConfig } from './config.js'
import type { VaultConfig } from './config.js'

export interface LoadedVault {
  readonly vault: Vault
  readonly root: string
  readonly config: VaultConfig
}

export async function loadVaultFrom(startDir: string): Promise<LoadedVault> {
  const root = findVaultRoot(startDir)
  if (root === undefined) {
    throw new Error(
      'no vault found (no `.mnem/` in this directory or any parent). run `mnem init` first.',
    )
  }
  const config = await readConfig(root)
  const storage = new LocalStorage({
    root: config.storage.root !== undefined ? config.storage.root : root,
  })
  const index = new SqliteIndex({ path: join(root, config.index.path) })
  let embeddings: EmbeddingProvider | undefined
  if (config.embeddings !== undefined && config.embeddings.type === 'openai') {
    const apiKey = process.env['OPENAI_API_KEY']
    if (apiKey !== undefined && apiKey.length > 0) {
      // Lazy require so the CLI runs without the optional peer dep when
      // embeddings are not configured.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('@mnem/embeddings-openai') as typeof EmbeddingsModule
      embeddings = new mod.OpenAIEmbeddings({
        apiKey,
        ...(config.embeddings.model === undefined ? {} : { model: config.embeddings.model }),
      })
    }
  }
  const vault = await createVault({
    storage,
    index,
    ...(embeddings === undefined ? {} : { embeddings }),
  })
  return { vault, root, config }
}
