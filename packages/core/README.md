# @mnem/core

Core API for Mnem, a markdown-based persistent memory engine for LLM agents.

This package exposes the public `createVault()` factory and the `Vault` interface along with the storage, index, and embedding adapter contracts.

## Install

```bash
pnpm add @mnem/core
```

## Usage

```typescript
import { createVault, MemoryStorage } from '@mnem/core'

const vault = await createVault({ storage: new MemoryStorage() })

await vault.writeNote({ path: 'hello.md', content: 'see [[world]]' })
const backlinks = await vault.getBacklinks({ path: 'world.md' })
```

See the [root README](../../README.md) for a full introduction.

## License

MIT
