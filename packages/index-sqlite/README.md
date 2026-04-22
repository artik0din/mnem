# @mnem/index-sqlite

Embedded SQLite index adapter for Mnem. Uses FTS5 for full-text search and `sqlite-vec` (when available) for semantic vector search.

Best suited for single-process or CLI use cases. For multi-tenant servers, prefer `@mnem/index-postgres`.

## Install

```bash
pnpm add @mnem/core @mnem/index-sqlite
# optional: enable semantic search
pnpm add sqlite-vec
```

## Usage

```typescript
import { createVault } from '@mnem/core'
import { LocalStorage } from '@mnem/storage-local'
import { SqliteIndex } from '@mnem/index-sqlite'

const vault = await createVault({
  storage: new LocalStorage({ root: './vault' }),
  index: new SqliteIndex({ path: './vault/.mnem/index.sqlite' }),
})
```

Tables:

- `notes(path PK, content, frontmatter JSON, updated_at)`
- `links(from_path, to_path)` with indexes on both columns
- `embeddings(path PK, vector BLOB, dimension)`
- `notes_fts(path, content)` virtual FTS5 table

If `sqlite-vec` is not installed, `searchSemantic` returns an empty array and the package logs a warning at construction time; full-text search and the backlinks graph keep working.

## License

MIT
