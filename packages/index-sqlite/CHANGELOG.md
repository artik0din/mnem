# @mnem/index-sqlite

## 0.1.0

### Minor Changes

- 4852413: Mnem v0.1 — first shippable release.

  ### Features
  - `@mnem/storage-s3`: real AWS SDK v3 adapter supporting AWS S3, Cloudflare R2, Scaleway, Backblaze B2 and Minio, with paginated listing, markdown content-type and `NoteNotFoundError` on missing keys.
  - `@mnem/index-sqlite`: SQLite FTS5 index with links graph and an optional `sqlite-vec` semantic-search path that degrades gracefully to an empty result when the native extension is unavailable.
  - `@mnem/index-postgres`: Postgres adapter using `tsvector` for full-text and `pgvector` for semantic search. Boots schema, indexes and links tables, falls back to a raw `DOUBLE PRECISION[]` column when `pgvector` is not installed.
  - `@mnem/embeddings-openai`: batched embeddings (default 100 per call) with exponential-backoff retry on 429/5xx and connection errors.
  - `@mnem/tools`: three agent adapters — OpenAI function calling, Anthropic tool use, and Claude Skill (`SKILL.md` + `scripts/` + `resources/api.md`) — plus a runtime `executeToolCall` dispatcher with path/operation allowlists.
  - `@mnem/cli`: real `mnem init`, `mnem stats`, `mnem search`, `mnem compact` (archive strategy), `mnem export-skill`, and `mnem tool <op>` subcommands, driven by `.mnem/config.yml`.

  ### Breaking changes
  - None. v0.0.0 packages threw on every non-core call; the surface itself has not changed.

  ### Notes
  - The previously sketched Model Context Protocol adapter has been replaced by a Claude Skill generator, aligned with Anthropic's late-2025 open Skills format.

### Patch Changes

- Updated dependencies [4852413]
  - @mnem/core@0.1.0
