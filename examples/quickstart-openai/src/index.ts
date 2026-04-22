import { createVault } from '@mnem/core'
import { LocalStorage } from '@mnem/storage-local'

async function main(): Promise<void> {
  const vault = await createVault({
    storage: new LocalStorage({ root: process.env['VAULT_ROOT'] ?? './vault' }),
  })

  await vault.writeNote({
    path: 'hello.md',
    content: '# Hello\n\nThis links to [[world]].',
  })

  const backlinks = await vault.getBacklinks({ path: 'world.md' })
  process.stdout.write(`world.md has ${backlinks.length} backlink(s)\n`)

  await vault.close()
}

main().catch((err: unknown) => {
  process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
