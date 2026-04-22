# @mnem/storage-s3

S3-compatible storage adapter for Mnem. Works with AWS S3, Cloudflare R2, Scaleway Object Storage, Backblaze B2, and Minio.

## Install

```bash
pnpm add @mnem/core @mnem/storage-s3
```

## Usage

```typescript
import { createVault } from '@mnem/core'
import { S3Storage } from '@mnem/storage-s3'

const vault = await createVault({
  storage: new S3Storage({
    bucket: 'my-vault',
    prefix: 'clients/alice',
    region: 'eu-west-1',
  }),
})

await vault.writeNote({ path: 'notes/hello.md', content: '# hello' })
```

Credentials follow the AWS default credential provider chain (environment variables, shared config, IAM role). You can also pass them explicitly:

```typescript
new S3Storage({
  bucket: 'my-vault',
  endpoint: 'https://minio.local',
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_KEY,
    secretAccessKey: process.env.S3_SECRET,
  },
})
```

## License

MIT
