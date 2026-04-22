# @mnem/storage-local

Local filesystem storage adapter for Mnem. Reads and writes notes as plain files under a root directory. Works natively with `git`, Obsidian, and any markdown editor.

## Install

```bash
pnpm add @mnem/core @mnem/storage-local
```

## Usage

```typescript
import { createVault } from '@mnem/core'
import { LocalStorage } from '@mnem/storage-local'

const vault = await createVault({
  storage: new LocalStorage({ root: '/path/to/vault' }),
})

await vault.writeNote({ path: 'notes/hello.md', content: '# hi' })
```

Paths passed to the vault are vault-relative (`notes/hello.md`), never absolute. The adapter creates intermediate directories on write and skips hidden `.mnem/` internals when listing.

## License

MIT
