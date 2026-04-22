import { resolve } from 'node:path'
import { toClaudeSkill } from '@mnem/tools'
import type { ClaudeSkillArtifacts } from '@mnem/tools'
import { loadVaultFrom } from '../vault-loader.js'

export interface ExportSkillOptions {
  readonly startDir: string
  readonly outputDir: string
  readonly skillName?: string
  readonly cliCommand?: string
}

export async function runExportSkill(
  options: ExportSkillOptions,
): Promise<ClaudeSkillArtifacts> {
  const { vault } = await loadVaultFrom(options.startDir)
  try {
    return await toClaudeSkill(vault, {
      outputDir: resolve(options.outputDir),
      ...(options.skillName === undefined ? {} : { skillName: options.skillName }),
      ...(options.cliCommand === undefined ? {} : { cliCommand: options.cliCommand }),
    })
  } finally {
    await vault.close()
  }
}
