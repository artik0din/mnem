import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { LocalStorage } from '@mnem/storage-local'
import { loadVaultFrom } from '../vault-loader.js'

export interface CompactOptions {
  readonly startDir: string
  /** Path prefix to archive from. Defaults to `conversations/`. */
  readonly sourcePrefix?: string
  /** Archive target prefix. Defaults to `archive/`. */
  readonly targetPrefix?: string
  /** Age threshold in days. Defaults to 30. */
  readonly olderThanDays?: number
  /** If true, do not write anything; report only. */
  readonly dryRun?: boolean
}

export interface CompactReport {
  readonly movedPaths: readonly string[]
  readonly skipped: number
}

export async function runCompact(options: CompactOptions): Promise<CompactReport> {
  const { vault, root, config } = await loadVaultFrom(options.startDir)
  const source = options.sourcePrefix ?? 'conversations/'
  const target = options.targetPrefix ?? 'archive/'
  const thresholdDays = options.olderThanDays ?? 30
  const threshold = Date.now() - thresholdDays * 24 * 60 * 60 * 1000
  const storage = new LocalStorage({
    root: config.storage.root !== undefined ? config.storage.root : root,
  })
  const movedPaths: string[] = []
  let skipped = 0
  try {
    for await (const key of storage.list(source)) {
      if (!key.endsWith('.md')) continue
      const full = join(config.storage.root !== undefined ? config.storage.root : root, key)
      const s = await stat(full)
      if (s.mtimeMs >= threshold) {
        skipped += 1
        continue
      }
      const newPath = target + key.slice(source.length)
      if (options.dryRun === true) {
        movedPaths.push(newPath)
        continue
      }
      const note = await vault.readNote({ path: key })
      await vault.writeNote({
        path: newPath,
        content: note.content,
        frontmatter: note.frontmatter,
      })
      await vault.deleteNote({ path: key })
      movedPaths.push(newPath)
    }
    return { movedPaths, skipped }
  } finally {
    await vault.close()
  }
}
