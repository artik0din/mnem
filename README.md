<div align="center">

# Mnem

**A markdown-based persistent memory engine for LLM agents.**

Store your agents' memory in a folder of linked markdown files. Inspectable, editable, portable.

[![CI](https://github.com/artik0din/mnem/actions/workflows/ci.yml/badge.svg)](https://github.com/artik0din/mnem/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![pnpm](https://img.shields.io/badge/pnpm-9.15-F69220?logo=pnpm&logoColor=white)](https://pnpm.io)
[![Turborepo](https://img.shields.io/badge/Turborepo-2.3-EF4444?logo=turborepo&logoColor=white)](https://turbo.build)

[Install](#install) · [Quick start](#quick-start) · [Packages](#packages) · [Architecture](#architecture) · [Roadmap](#roadmap)

</div>

---

## Overview

Mnem gives LLM agents a persistent memory that lives as **plain markdown files** rather than inside an opaque vector database.

- Store notes on disk, in S3, or in git.
- Link notes together with standard wikilinks `[[like this]]`.
- Index them for full-text, semantic, and graph search.
- Expose them to any LLM as first-class tools.
- Open the same folder in any markdown editor. Your agent's memory is just files.

## Why file-based memory

Most existing memory tools for agents store data in proprietary vector databases. That optimizes retrieval but gives up inspectability, portability, and auditability. When the vendor goes down, when a client asks to see what you remember about them, or when a human needs to correct a false memory, the files-on-disk model wins.

Mnem keeps the retrieval quality (full-text + semantic + graph search) while keeping the data in a format anyone can read.

| Dimension              | Vector-DB services | Mnem                                  |
| ---------------------- | ------------------ | ------------------------------------- |
| Storage format         | Proprietary blobs  | Plain markdown files with frontmatter |
| Inspectable by a human | No                 | Yes                                   |
| Edit memory by hand    | No                 | Yes (any text editor)                 |
| Version control        | Snapshot only      | Works natively with git               |
| Self-host              | Usually complex    | `pnpm add @mnem/core` and go          |
| Vendor lock-in         | Strong             | None                                  |

## Install

```bash
pnpm add @mnem/core @mnem/storage-local
```

## Quick start

```typescript
import { createVault } from '@mnem/core'
import { LocalStorage } from '@mnem/storage-local'

const vault = await createVault({
  storage: new LocalStorage({ root: './my-vault' }),
})

await vault.writeNote({
  path: 'notes/hello.md',
  content: '# Hello\n\nLinked to [[notes/world]].',
})

const matches = await vault.searchFullText({ query: 'hello' })
const backlinks = await vault.getBacklinks({ path: 'notes/world.md' })
```

## Packages

| Package                   | Purpose                                                         | Status |
| ------------------------- | --------------------------------------------------------------- | ------ |
| `@mnem/core`              | Vault API, contracts, in-memory adapters                        | v0.0   |
| `@mnem/storage-local`     | Filesystem storage adapter                                      | v0.0   |
| `@mnem/storage-s3`        | S3-compatible storage adapter (AWS, R2, Scaleway, Minio, …)     | stub   |
| `@mnem/index-sqlite`      | Embedded SQLite index with FTS5 + `sqlite-vec`                  | stub   |
| `@mnem/index-postgres`    | PostgreSQL index with `tsvector` and `pgvector`                 | stub   |
| `@mnem/embeddings-openai` | OpenAI embeddings provider                                      | stub   |
| `@mnem/tools`             | Tool format adapters (OpenAI function calling, Anthropic tools) | stub   |
| `@mnem/cli`               | `mnem` command-line tool                                        | stub   |

All packages are published under the MIT license.

## Architecture

```
┌──────────────┐
│   Agent /    │
│  LLM client  │
└──────┬───────┘
       │
       ▼
┌──────────────┐      ┌──────────────┐
│    Vault     │────▶│    Index     │  (in-memory | SQLite | Postgres)
│  (public API)│      └──────────────┘
└──────┬───────┘
       │
       ▼
┌──────────────┐      ┌──────────────┐
│   Storage    │      │  Embeddings  │  (optional; OpenAI, …)
│   adapter    │      │   provider   │
└──────┬───────┘      └──────────────┘
       │
       ▼
  fs | S3 | git
```

The `Vault` is the stable public API. Storage, indexing, and embeddings are each abstracted behind a small interface so consumers can plug in adapters that match their infrastructure.

## Vault layout on disk

A Mnem vault is a directory of markdown files. Wikilinks resolve relative to the vault root. Optional YAML frontmatter carries metadata.

```
my-vault/
├── clients/
│   └── alice/
│       ├── profile.md
│       ├── facts.md
│       └── conversations/
│           └── 2026-04-22.md
├── knowledge/
│   ├── programs.md
│   └── principles.md
└── index.md
```

```markdown
---
id: 01HK9X7Y3Z
created: 2026-04-22T10:00:00Z
tags: [client, intro]
---

# Alice

First diagnosis notes. References [[knowledge/programs]] and [[knowledge/principles]].
```

## Requirements

- Node.js 20 or later
- pnpm 9 or later (monorepo)

## Development

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

Every pull request must pass typecheck, lint, prettier, test, and build before merging.

## Roadmap

| Version | Focus                                                                 | Target timeframe |
| ------- | --------------------------------------------------------------------- | ---------------- |
| v0.1    | Full implementations of all v0 adapter stubs, compaction strategies   | 4–5 weeks        |
| v0.2    | MCP server adapter, git storage, additional embedding providers       | +4 weeks         |
| v1.0    | Framework adapters, filesystem watch mode, canvas support, benchmarks | +2 months        |

See [`docs/`](./docs) for the detailed PRD and design documents (coming soon).

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md) for the git workflow, commit conventions, and quality gates. All contributions are accepted under the MIT license.

For security issues, please see [SECURITY.md](./SECURITY.md) instead of opening a public issue.

## License

Released under the [MIT License](./LICENSE). Copyright © Kevin Valfin.
