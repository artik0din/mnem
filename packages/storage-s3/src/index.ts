import type { StorageAdapter } from '@mnem/core'

export interface S3StorageOptions {
  readonly bucket: string
  readonly prefix?: string
  readonly endpoint?: string
  readonly region?: string
  readonly accessKeyId?: string
  readonly secretAccessKey?: string
}

/**
 * S3-compatible object storage adapter. Reads and writes notes as objects in
 * a bucket, optionally under a prefix.
 *
 * Implementation is scheduled for v0.1. The current version exposes the
 * constructor and configuration surface so downstream packages can compile
 * against the final shape.
 */
export class S3Storage implements StorageAdapter {
  private readonly options: S3StorageOptions

  constructor(options: S3StorageOptions) {
    this.options = options
  }

  async read(_path: string): Promise<string> {
    throw new Error(
      `[@mnem/storage-s3] read is not implemented yet (bucket=${this.options.bucket})`,
    )
  }

  async write(_path: string, _content: string): Promise<void> {
    throw new Error(
      `[@mnem/storage-s3] write is not implemented yet (bucket=${this.options.bucket})`,
    )
  }

  async delete(_path: string): Promise<void> {
    throw new Error(
      `[@mnem/storage-s3] delete is not implemented yet (bucket=${this.options.bucket})`,
    )
  }

  async exists(_path: string): Promise<boolean> {
    throw new Error(
      `[@mnem/storage-s3] exists is not implemented yet (bucket=${this.options.bucket})`,
    )
  }

  // eslint-disable-next-line require-yield
  async *list(_prefix?: string): AsyncIterable<string> {
    throw new Error(
      `[@mnem/storage-s3] list is not implemented yet (bucket=${this.options.bucket})`,
    )
  }
}
