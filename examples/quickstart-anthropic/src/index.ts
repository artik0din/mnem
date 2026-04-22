import { createVault } from '@mnem/core'
import { LocalStorage } from '@mnem/storage-local'

async function main(): Promise<void> {
  const vault = await createVault({
    storage: new LocalStorage({ root: process.env['VAULT_ROOT'] ?? './vault' }),
  })

  await vault.writeNote({
    path: 'notes/intro.md',
    content: '# Intro\n\nPoints to [[notes/next]].',
  })

  process.stdout.write('Vault ready for tool adapter wiring\n')
  await vault.close()
}

main().catch((err: unknown) => {
  process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
