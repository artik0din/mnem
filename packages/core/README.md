# @mnem/core

Core API for Mnem, a markdown-based persistent memory engine for LLM agents.

Exposes the public `createVault()` factory, the `Vault` interface, the in-memory adapters used by tests, and the storage/index/embedding adapter contracts that downstream packages implement.

## Install

```bash
pnpm add @mnem/core
```

## Usage

```typescript
import { createVault, MemoryStorage } from '@mnem/core'

const vault = await createVault({ storage: new MemoryStorage() })

await vault.writeNote({ path: 'hello.md', content: 'see [[world]]' })
const note = await vault.readNote({ path: 'hello.md' })
const backlinks = await vault.getBacklinks({ path: 'world.md' })
```

For production use, pair `@mnem/core` with a real storage adapter (`@mnem/storage-local`, `@mnem/storage-s3`) and a real index adapter (`@mnem/index-sqlite`, `@mnem/index-postgres`).

## Contracts

- `StorageAdapter` — `read`, `write`, `delete`, `exists`, `list`.
- `IndexAdapter` — `upsertNote`, `deleteNote`, `searchFullText`, `searchSemantic`, `getBacklinks`, `getOutgoingLinks`, `close`.
- `EmbeddingProvider` — `dimension`, `modelId`, `embed(texts)`.

See the [root README](../../README.md) for the full product overview.

## License

MIT
