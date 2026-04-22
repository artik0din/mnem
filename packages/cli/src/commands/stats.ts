import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { LocalStorage } from '@mnem/storage-local'
import { findVaultRoot, readConfig } from '../config.js'

export interface Stats {
  readonly root: string
  readonly noteCount: number
  readonly totalBytes: number
  readonly latestUpdatedAt: number | undefined
}

export async function runStats(startDir: string): Promise<Stats> {
  const root = findVaultRoot(startDir)
  if (root === undefined) {
    throw new Error('no vault found (no `.mnem/` in this directory or any parent).')
  }
  const config = await readConfig(root)
  const storageRoot = config.storage.root !== undefined ? config.storage.root : root
  const storage = new LocalStorage({ root: storageRoot })
  let noteCount = 0
  let totalBytes = 0
  let latestUpdatedAt: number | undefined
  for await (const key of storage.list()) {
    if (!key.endsWith('.md')) continue
    if (key.startsWith('.mnem/')) continue
    const full = join(storageRoot, key)
    const s = await stat(full)
    noteCount += 1
    totalBytes += s.size
    const mtime = s.mtimeMs
    if (latestUpdatedAt === undefined || mtime > latestUpdatedAt) {
      latestUpdatedAt = mtime
    }
  }
  return { root, noteCount, totalBytes, latestUpdatedAt }
}
