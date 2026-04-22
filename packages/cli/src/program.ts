import { Command } from 'commander'

export function buildProgram(): Command {
  const program = new Command()
  program.name('mnem').description('Inspect and maintain a Mnem vault.').version('0.0.0')

  program
    .command('init')
    .description('Initialize a new vault in the current directory.')
    .action(() => {
      process.stderr.write('[mnem] init is not implemented yet\n')
      process.exit(1)
    })

  program
    .command('stats')
    .description('Display statistics about the current vault.')
    .action(() => {
      process.stderr.write('[mnem] stats is not implemented yet\n')
      process.exit(1)
    })

  program
    .command('search <query>')
    .description('Full-text search across the vault.')
    .action(() => {
      process.stderr.write('[mnem] search is not implemented yet\n')
      process.exit(1)
    })

  program
    .command('compact')
    .description('Compact old notes using an LLM summarization strategy.')
    .action(() => {
      process.stderr.write('[mnem] compact is not implemented yet\n')
      process.exit(1)
    })

  return program
}
