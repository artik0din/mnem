# @mnem/storage-local

Local filesystem storage adapter for Mnem. Reads and writes notes as plain files under a root directory.

```typescript
import { createVault } from '@mnem/core'
import { LocalStorage } from '@mnem/storage-local'

const vault = await createVault({
  storage: new LocalStorage({ root: '/path/to/vault' }),
})
```

## License

MIT
