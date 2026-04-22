import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { DEFAULT_CONFIG, writeConfig } from '../config.js'

export interface InitOptions {
  readonly targetDir: string
}

export interface InitResult {
  readonly root: string
  readonly created: boolean
}

export async function runInit(options: InitOptions): Promise<InitResult> {
  const root = resolve(options.targetDir)
  const mnemDir = join(root, '.mnem')
  if (existsSync(mnemDir)) {
    return { root, created: false }
  }
  await mkdir(mnemDir, { recursive: true })
  await writeConfig(root, DEFAULT_CONFIG)
  await writeFile(
    join(mnemDir, '.gitignore'),
    ['index.sqlite', 'index.sqlite-wal', 'index.sqlite-shm', ''].join('\n'),
    'utf8',
  )
  return { root, created: true }
}
