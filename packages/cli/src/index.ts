export { buildProgram } from './program.js'
export type { ProgramIo } from './program.js'
export { runInit } from './commands/init.js'
export type { InitOptions, InitResult } from './commands/init.js'
export { runStats } from './commands/stats.js'
export type { Stats } from './commands/stats.js'
export { runSearch } from './commands/search.js'
export type { SearchOptions, SearchReport } from './commands/search.js'
export { runCompact } from './commands/compact.js'
export type { CompactOptions, CompactReport } from './commands/compact.js'
export { runExportSkill } from './commands/export-skill.js'
export type { ExportSkillOptions } from './commands/export-skill.js'
export { runTool } from './commands/tool.js'
export type { ToolOptions } from './commands/tool.js'
export type { VaultConfig } from './config.js'
export {
  DEFAULT_CONFIG,
  findVaultRoot,
  parseConfig,
  readConfig,
  serializeConfig,
  writeConfig,
} from './config.js'
