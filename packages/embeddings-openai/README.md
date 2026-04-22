# @mnem/embeddings-openai

OpenAI embeddings provider for Mnem. Wraps the official `openai` SDK with batching and automatic retries on transient errors (HTTP 429 and 5xx).

Supported models: `text-embedding-3-small`, `text-embedding-3-large`, `text-embedding-ada-002`.

## Install

```bash
pnpm add @mnem/core @mnem/embeddings-openai
```

## Usage

```typescript
import { createVault } from '@mnem/core'
import { LocalStorage } from '@mnem/storage-local'
import { SqliteIndex } from '@mnem/index-sqlite'
import { OpenAIEmbeddings } from '@mnem/embeddings-openai'

const vault = await createVault({
  storage: new LocalStorage({ root: './vault' }),
  index: new SqliteIndex({ path: './vault/.mnem/index.sqlite' }),
  embeddings: new OpenAIEmbeddings({
    apiKey: process.env.OPENAI_API_KEY!,
    model: 'text-embedding-3-small',
  }),
})

await vault.writeNote({ path: 'notes/hello.md', content: '# hello' })
const results = await vault.searchSemantic({ query: 'greeting', topK: 5 })
```

Options:

- `apiKey` — required unless `client` is provided
- `model` — defaults to `text-embedding-3-small`
- `baseURL` — optional override for compatible providers
- `batchSize` — max inputs per request (default `100`)
- `maxRetries` — retry attempts on 429/5xx (default `3`)

## License

MIT
