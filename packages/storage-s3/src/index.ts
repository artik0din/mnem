import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import type { S3ClientConfig } from '@aws-sdk/client-s3'
import type { StorageAdapter } from '@mnem/core'
import { NoteNotFoundError } from '@mnem/core'

export interface S3StorageCredentials {
  readonly accessKeyId: string
  readonly secretAccessKey: string
  readonly sessionToken?: string
}

export interface S3StorageOptions {
  /** S3 bucket name. */
  readonly bucket: string
  /**
   * Optional key prefix applied to every note path. Useful when a single
   * bucket holds multiple vaults. No leading slash; a trailing slash is
   * normalized automatically.
   */
  readonly prefix?: string
  /** Optional custom endpoint (for Minio, Cloudflare R2, Scaleway, etc.). */
  readonly endpoint?: string
  /** AWS region. Defaults to `us-east-1` if not provided. */
  readonly region?: string
  /**
   * Optional explicit credentials. If omitted, the AWS default credential
   * provider chain is used (env vars, shared config, IAM role, …).
   */
  readonly credentials?: S3StorageCredentials
  /**
   * For S3-compatible providers such as Minio, set to `true` to use
   * path-style addressing instead of virtual-hosted style.
   */
  readonly forcePathStyle?: boolean
  /**
   * Inject a pre-configured S3 client. Primarily useful for tests. When
   * provided, all other client-building options are ignored.
   */
  readonly client?: S3Client
}

/**
 * S3-compatible object storage adapter. Notes are stored as individual objects
 * under an optional prefix.
 *
 * Works with AWS S3, Cloudflare R2, Scaleway Object Storage, Backblaze B2,
 * and Minio.
 */
export class S3Storage implements StorageAdapter {
  private readonly client: S3Client
  private readonly bucket: string
  private readonly prefix: string

  constructor(options: S3StorageOptions) {
    this.bucket = options.bucket
    this.prefix = normalizePrefix(options.prefix)
    if (options.client !== undefined) {
      this.client = options.client
    } else {
      const config: S3ClientConfig = {
        region: options.region ?? 'us-east-1',
      }
      if (options.endpoint !== undefined) {
        config.endpoint = options.endpoint
      }
      if (options.forcePathStyle !== undefined) {
        config.forcePathStyle = options.forcePathStyle
      }
      if (options.credentials !== undefined) {
        const creds: {
          accessKeyId: string
          secretAccessKey: string
          sessionToken?: string
        } = {
          accessKeyId: options.credentials.accessKeyId,
          secretAccessKey: options.credentials.secretAccessKey,
        }
        if (options.credentials.sessionToken !== undefined) {
          creds.sessionToken = options.credentials.sessionToken
        }
        config.credentials = creds
      }
      this.client = new S3Client(config)
    }
  }

  async read(path: string): Promise<string> {
    try {
      const res = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: this.toKey(path) }),
      )
      if (res.Body === undefined || res.Body === null) {
        throw new NoteNotFoundError(path)
      }
      return await bodyToString(res.Body)
    } catch (err) {
      if (isNotFound(err)) {
        throw new NoteNotFoundError(path)
      }
      throw err
    }
  }

  async write(path: string, content: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.toKey(path),
        Body: content,
        ContentType: 'text/markdown; charset=utf-8',
      }),
    )
  }

  async delete(path: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: this.toKey(path) }),
      )
    } catch (err) {
      if (isNotFound(err)) {
        throw new NoteNotFoundError(path)
      }
      throw err
    }
  }

  async exists(path: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: this.toKey(path) }),
      )
      return true
    } catch (err) {
      if (isNotFound(err)) return false
      throw err
    }
  }

  async *list(prefix?: string): AsyncIterable<string> {
    const combined = this.prefix + (prefix ?? '')
    let continuationToken: string | undefined
    do {
      const input: {
        Bucket: string
        Prefix?: string
        ContinuationToken?: string
      } = { Bucket: this.bucket }
      if (combined.length > 0) input.Prefix = combined
      if (continuationToken !== undefined) input.ContinuationToken = continuationToken
      const res = await this.client.send(new ListObjectsV2Command(input))
      const contents = res.Contents ?? []
      for (const obj of contents) {
        if (obj.Key === undefined) continue
        yield this.fromKey(obj.Key)
      }
      continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined
    } while (continuationToken !== undefined)
  }

  private toKey(path: string): string {
    return this.prefix + path
  }

  private fromKey(key: string): string {
    if (this.prefix.length > 0 && key.startsWith(this.prefix)) {
      return key.slice(this.prefix.length)
    }
    return key
  }
}

function normalizePrefix(prefix: string | undefined): string {
  if (prefix === undefined || prefix.length === 0) return ''
  if (prefix.endsWith('/')) return prefix
  return prefix + '/'
}

function isNotFound(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false
  const name = (err as { name?: unknown }).name
  const code = (err as { Code?: unknown }).Code
  const status =
    (err as { $metadata?: { httpStatusCode?: unknown } }).$metadata?.httpStatusCode
  return (
    name === 'NoSuchKey' ||
    name === 'NotFound' ||
    code === 'NoSuchKey' ||
    code === 'NotFound' ||
    status === 404
  )
}

async function bodyToString(body: unknown): Promise<string> {
  if (typeof body === 'string') return body
  if (body instanceof Uint8Array) return new TextDecoder('utf-8').decode(body)
  const withTransform = body as {
    transformToString?: (encoding?: string) => Promise<string>
  }
  if (typeof withTransform.transformToString === 'function') {
    return withTransform.transformToString('utf-8')
  }
  // Last resort for Node readable streams.
  const chunks: Buffer[] = []
  const stream = body as AsyncIterable<Buffer | Uint8Array | string>
  for await (const chunk of stream) {
    if (typeof chunk === 'string') {
      chunks.push(Buffer.from(chunk, 'utf-8'))
    } else if (chunk instanceof Uint8Array) {
      chunks.push(Buffer.from(chunk))
    }
  }
  return Buffer.concat(chunks).toString('utf-8')
}
