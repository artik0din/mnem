<div align="center">

# Mnem

**A markdown-based persistent memory engine for LLM agents.**

Store your agents' memory in a folder of linked markdown files. Inspectable, editable, portable.

[![CI](https://github.com/artik0din/mnem/actions/workflows/ci.yml/badge.svg)](https://github.com/artik0din/mnem/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org)

[Install](#install) · [Quick start](#quick-start) · [Packages](#packages) · [Agent adapters](#agent-adapters) · [Architecture](#architecture)

</div>

---

## Overview

Mnem gives LLM agents a persistent memory that lives as **plain markdown files** rather than inside an opaque vector database.

- Store notes on disk or in S3-compatible object storage.
- Link notes together with standard wikilinks `[[like this]]`.
- Index them for full-text, semantic, and graph search.
- Expose them to any LLM: OpenAI function calling, Anthropic tool use, or as a Claude Skill.
- Open the same folder in Obsidian, VS Code, or any markdown editor. Your agent's memory is just files.

## Why file-based memory

Most memory tools for agents store data in proprietary vector databases. That optimizes retrieval but gives up inspectability, portability and auditability. When the vendor goes down, when a client asks to see what you remember about them, or when a human needs to correct a false memory, the files-on-disk model wins.

Mnem keeps the retrieval quality (full-text + semantic + graph search) while keeping the data in a format anyone can read.

| Dimension               | Vector-DB services | Mnem                                  |
| ----------------------- | ------------------ | ------------------------------------- |
| Storage format          | Proprietary blobs  | Plain markdown files with frontmatter |
| Inspectable by a human  | No                 | Yes                                   |
| Edit memory by hand     | No                 | Yes (any text editor)                 |
| Version control         | Snapshot only      | Works natively with git               |
| Self-host               | Usually complex    | `pnpm add @mnem/core` and go          |
| Obsidian/VS Code compat | No                 | Yes                                   |
| Vendor lock-in          | Strong             | None                                  |

## Install

```bash
pnpm add @mnem/core @mnem/storage-local @mnem/index-sqlite
```

## Quick start

```typescript
import { createVault } from '@mnem/core'
import { LocalStorage } from '@mnem/storage-local'
import { SqliteIndex } from '@mnem/index-sqlite'

const vault = await createVault({
  storage: new LocalStorage({ root: './my-vault' }),
  index: new SqliteIndex({ path: './my-vault/.mnem/index.sqlite' }),
})

await vault.writeNote({
  path: 'notes/hello.md',
  content: '# Hello\n\nLinked to [[notes/world]].',
})

const matches = await vault.searchFullText({ query: 'hello' })
const backlinks = await vault.getBacklinks({ path: 'notes/world.md' })
```

## Packages

| Package                   | Purpose                                                         | Status     |
| ------------------------- | --------------------------------------------------------------- | ---------- |
| `@mnem/core`              | Vault API, contracts, in-memory adapters                        | v0.1 ready |
| `@mnem/storage-local`     | Filesystem storage adapter                                      | v0.1 ready |
| `@mnem/storage-s3`        | S3-compatible storage (AWS, R2, Scaleway, Minio, Backblaze)     | v0.1 ready |
| `@mnem/index-sqlite`      | Embedded SQLite index with FTS5 and optional `sqlite-vec`       | v0.1 ready |
| `@mnem/index-postgres`    | PostgreSQL index with `tsvector` and `pgvector`                 | v0.1 ready |
| `@mnem/embeddings-openai` | OpenAI embeddings provider with batching and retries            | v0.1 ready |
| `@mnem/tools`             | OpenAI / Anthropic / Claude Skill adapters + runtime dispatcher | v0.1 ready |
| `@mnem/cli`               | `mnem` command-line tool                                        | v0.1 ready |

All packages are published under the MIT license.

## Agent adapters

`@mnem/tools` exposes a Mnem vault to an agent in three formats:

### OpenAI function calling

```typescript
import { executeToolCall, toOpenAITools } from '@mnem/tools'

const tools = toOpenAITools(vault, { restrictToPath: 'clients/alice/' })
const res = await openai.chat.completions.create({ model: 'gpt-4o', tools, messages })
for (const call of res.choices[0].message.tool_calls ?? []) {
  const out = await executeToolCall(vault, {
    name: call.function.name,
    arguments: JSON.parse(call.function.arguments),
  })
}
```

### Anthropic tool use

```typescript
import { toAnthropicTools } from '@mnem/tools'

const tools = toAnthropicTools(vault)
const res = await anthropic.messages.create({ model: 'claude-sonnet-4-5', tools, messages })
```

### Claude Skill (for Claude Code, Claude.ai, Agent SDK)

```typescript
import { toClaudeSkill } from '@mnem/tools'

await toClaudeSkill(vault, {
  outputDir: '/Users/me/.claude/skills/mnem-memory',
  skillName: 'mnem-memory',
})
```

Or from the CLI:

```bash
mnem init
mnem export-skill ~/.claude/skills/mnem-memory
```

The generated directory follows Anthropic's Skill format: `SKILL.md` with YAML frontmatter and a short body, `scripts/*.sh` that shell out to the `mnem` CLI, and `resources/api.md` with the full JSON schema for each tool. Claude loads metadata at session start, reads `SKILL.md` when the skill is triggered, and only opens `resources/api.md` when it needs the exact parameters — this is the progressive-disclosure pattern Anthropic recommends.

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
  fs | S3
```

The `Vault` is the stable public API. Storage, indexing, and embeddings are each abstracted behind a small interface so consumers can plug in adapters that match their infrastructure.

## Vault layout on disk

A Mnem vault is a directory of markdown files. Wikilinks resolve relative to the vault root. Optional YAML frontmatter carries metadata.

```
my-vault/
├── .mnem/
│   ├── config.yml
│   └── index.sqlite
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
- pnpm 9 or later (for the monorepo)

## Development

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

Every pull request must pass typecheck, lint, prettier, test, and build before merging.

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md) for the git workflow, commit conventions, and quality gates. All contributions are accepted under the MIT license.

For security issues, please see [SECURITY.md](./SECURITY.md) instead of opening a public issue.

## License

Released under the [MIT License](./LICENSE). Copyright © Kevin Valfin.
