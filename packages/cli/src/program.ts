import { Command } from 'commander'
import { runInit } from './commands/init.js'
import { runStats } from './commands/stats.js'
import { runSearch } from './commands/search.js'
import { runCompact } from './commands/compact.js'
import { runExportSkill } from './commands/export-skill.js'
import { runTool } from './commands/tool.js'

export interface ProgramIo {
  readonly stdout: (msg: string) => void
  readonly stderr: (msg: string) => void
  readonly cwd: () => string
}

const defaultIo: ProgramIo = {
  stdout: (msg) => process.stdout.write(msg),
  stderr: (msg) => process.stderr.write(msg),
  cwd: () => process.cwd(),
}

export function buildProgram(io: ProgramIo = defaultIo): Command {
  const program = new Command()
  program
    .name('mnem')
    .description('Inspect and maintain a Mnem vault.')
    .version('0.1.0')
    .exitOverride()

  program
    .command('init [path]')
    .description('Initialize a new vault in the given directory (defaults to cwd).')
    .action(async (path: string | undefined) => {
      const result = await runInit({ targetDir: path ?? io.cwd() })
      if (result.created) {
        io.stdout(`Initialized vault at ${result.root}\n`)
      } else {
        io.stdout(`Vault already exists at ${result.root}\n`)
      }
    })

  program
    .command('stats')
    .description('Display statistics about the current vault.')
    .action(async () => {
      const stats = await runStats(io.cwd())
      const lines: string[] = []
      lines.push(`root: ${stats.root}`)
      lines.push(`notes: ${stats.noteCount}`)
      lines.push(`total size: ${stats.totalBytes} bytes`)
      lines.push(
        `latest update: ${
          stats.latestUpdatedAt === undefined
            ? '(none)'
            : new Date(stats.latestUpdatedAt).toISOString()
        }`,
      )
      io.stdout(lines.join('\n') + '\n')
    })

  program
    .command('search <query>')
    .description('Full-text (and optional semantic) search across the vault.')
    .option('-k, --top-k <n>', 'max results to return', (v: string) => Number.parseInt(v, 10), 10)
    .action(async (query: string, opts: { topK: number }) => {
      const report = await runSearch({
        query,
        topK: opts.topK,
        startDir: io.cwd(),
      })
      io.stdout('== Full-text ==\n')
      if (report.fullText.length === 0) {
        io.stdout('(no matches)\n')
      } else {
        for (const r of report.fullText) {
          io.stdout(`- ${r.path} (score ${r.score.toFixed(3)})\n`)
          io.stdout(`  ${r.snippet}\n`)
        }
      }
      if (report.semantic !== undefined) {
        io.stdout('\n== Semantic ==\n')
        if (report.semantic.length === 0) {
          io.stdout('(no matches)\n')
        } else {
          for (const r of report.semantic) {
            io.stdout(`- ${r.path} (score ${r.score.toFixed(3)})\n`)
          }
        }
      }
    })

  program
    .command('compact')
    .description('Archive notes older than a threshold into an archive/ folder (archive strategy).')
    .option('--source <prefix>', 'source prefix to archive from', 'conversations/')
    .option('--target <prefix>', 'archive destination prefix', 'archive/')
    .option(
      '--older-than-days <n>',
      'age threshold in days',
      (v: string) => Number.parseInt(v, 10),
      30,
    )
    .option('--dry-run', 'report what would change without writing', false)
    .action(
      async (opts: { source: string; target: string; olderThanDays: number; dryRun: boolean }) => {
        const report = await runCompact({
          startDir: io.cwd(),
          sourcePrefix: opts.source,
          targetPrefix: opts.target,
          olderThanDays: opts.olderThanDays,
          dryRun: opts.dryRun,
        })
        io.stdout(`${report.movedPaths.length} note(s) archived, ${report.skipped} skipped\n`)
        for (const p of report.movedPaths) io.stdout(`- ${p}\n`)
      },
    )

  program
    .command('export-skill <outputDir>')
    .description('Export the vault as a Claude Skill (SKILL.md + scripts + resources).')
    .option('--name <name>', 'skill name', 'mnem-memory')
    .option('--cli <command>', 'command used by generated scripts', 'mnem')
    .action(async (outputDir: string, opts: { name: string; cli: string }) => {
      const artifacts = await runExportSkill({
        startDir: io.cwd(),
        outputDir,
        skillName: opts.name,
        cliCommand: opts.cli,
      })
      io.stdout(`Exported Claude Skill to ${artifacts.root}\n`)
      io.stdout(` - SKILL.md\n`)
      io.stdout(` - ${artifacts.scriptPaths.length} script(s)\n`)
      io.stdout(` - resources/api.md\n`)
    })

  program
    .command('tool <toolName> [jsonArgs]')
    .description(
      'Run a single tool operation (used by Claude Skill scripts). Tool name uses dashes, e.g. `read-note`.',
    )
    .action(async (toolName: string, jsonArgs: string | undefined) => {
      const out = await runTool({
        startDir: io.cwd(),
        toolName,
        ...(jsonArgs === undefined ? {} : { jsonArgs }),
      })
      io.stdout(out + '\n')
    })

  return program
}
