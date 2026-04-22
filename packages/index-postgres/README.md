# @mnem/index-postgres

PostgreSQL-backed index adapter for Mnem. Uses `pgvector` for semantic similarity search and `tsvector`/`tsquery` for full-text search.

Designed for multi-tenant deployments that already run a shared Postgres instance.

## Install

```bash
pnpm add @mnem/core @mnem/index-postgres
```

## Usage

```typescript
import { createVault } from '@mnem/core'
import { S3Storage } from '@mnem/storage-s3'
import { PostgresIndex } from '@mnem/index-postgres'

const vault = await createVault({
  storage: new S3Storage({ bucket: 'my-vault' }),
  index: new PostgresIndex({
    connectionString: process.env.DATABASE_URL,
    schema: 'public',
    tablePrefix: 'mnem_',
  }),
})
```

On first boot the adapter creates `${prefix}notes`, `${prefix}links`, and `${prefix}embeddings` tables if they do not exist, and attempts to enable the `vector` extension. If `pgvector` is not installed the tables fall back to a raw `DOUBLE PRECISION[]` column and `searchSemantic` returns an empty array; full-text search still works.

Pass `skipMigrations: true` to run Mnem against an externally-managed schema.

## License

MIT
