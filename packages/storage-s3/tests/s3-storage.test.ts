import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { NoteNotFoundError } from '@mnem/core'
import { mockClient } from 'aws-sdk-client-mock'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { S3Storage } from '../src/index.js'

const s3Mock = mockClient(S3Client)

function makeStorage(opts: { prefix?: string } = {}): S3Storage {
  return new S3Storage({
    bucket: 'mnem-test',
    ...(opts.prefix === undefined ? {} : { prefix: opts.prefix }),
    client: new S3Client({ region: 'us-east-1' }),
  })
}

beforeEach(() => {
  s3Mock.reset()
})

afterEach(() => {
  s3Mock.reset()
})

describe('S3Storage', () => {
  it('reads an existing object as utf-8 string', async () => {
    const storage = makeStorage()
    s3Mock.on(GetObjectCommand).resolves({
      Body: {
        transformToString: async () => 'hello',
      } as unknown as undefined,
    })
    const out = await storage.read('a.md')
    expect(out).toBe('hello')
  })

  it('throws NoteNotFoundError when reading a missing object', async () => {
    const storage = makeStorage()
    const err = new Error('NoSuchKey') as Error & { name: string }
    err.name = 'NoSuchKey'
    s3Mock.on(GetObjectCommand).rejects(err)
    await expect(storage.read('missing.md')).rejects.toBeInstanceOf(NoteNotFoundError)
  })

  it('throws NoteNotFoundError when S3 returns empty body', async () => {
    const storage = makeStorage()
    s3Mock.on(GetObjectCommand).resolves({})
    await expect(storage.read('a.md')).rejects.toBeInstanceOf(NoteNotFoundError)
  })

  it('writes with markdown content-type', async () => {
    const storage = makeStorage()
    s3Mock.on(PutObjectCommand).resolves({})
    await storage.write('a.md', 'hi')
    const calls = s3Mock.commandCalls(PutObjectCommand)
    expect(calls).toHaveLength(1)
    expect(calls[0]?.args[0].input.ContentType).toBe('text/markdown; charset=utf-8')
    expect(calls[0]?.args[0].input.Key).toBe('a.md')
  })

  it('applies the configured prefix to write keys', async () => {
    const storage = makeStorage({ prefix: 'vault' })
    s3Mock.on(PutObjectCommand).resolves({})
    await storage.write('a.md', 'hi')
    const calls = s3Mock.commandCalls(PutObjectCommand)
    expect(calls[0]?.args[0].input.Key).toBe('vault/a.md')
  })

  it('delete removes the object', async () => {
    const storage = makeStorage()
    s3Mock.on(DeleteObjectCommand).resolves({})
    await storage.delete('a.md')
    expect(s3Mock.commandCalls(DeleteObjectCommand)).toHaveLength(1)
  })

  it('delete throws NoteNotFoundError when object is missing', async () => {
    const storage = makeStorage()
    const err = new Error('NoSuchKey') as Error & { name: string }
    err.name = 'NoSuchKey'
    s3Mock.on(DeleteObjectCommand).rejects(err)
    await expect(storage.delete('missing.md')).rejects.toBeInstanceOf(NoteNotFoundError)
  })

  it('exists returns true when HeadObject succeeds', async () => {
    const storage = makeStorage()
    s3Mock.on(HeadObjectCommand).resolves({})
    expect(await storage.exists('a.md')).toBe(true)
  })

  it('exists returns false when HeadObject 404s', async () => {
    const storage = makeStorage()
    const err = new Error('NotFound') as Error & { name: string; $metadata: unknown }
    err.name = 'NotFound'
    err.$metadata = { httpStatusCode: 404 }
    s3Mock.on(HeadObjectCommand).rejects(err)
    expect(await storage.exists('a.md')).toBe(false)
  })

  it('list yields keys with prefix stripped', async () => {
    const storage = makeStorage({ prefix: 'vault' })
    s3Mock.on(ListObjectsV2Command).resolves({
      Contents: [{ Key: 'vault/a.md' }, { Key: 'vault/b.md' }],
      IsTruncated: false,
    })
    const out: string[] = []
    for await (const key of storage.list()) out.push(key)
    expect(out.sort()).toEqual(['a.md', 'b.md'])
  })

  it('list paginates through multiple pages', async () => {
    const storage = makeStorage()
    s3Mock
      .on(ListObjectsV2Command)
      .resolvesOnce({
        Contents: [{ Key: 'a.md' }],
        IsTruncated: true,
        NextContinuationToken: 't1',
      })
      .resolvesOnce({
        Contents: [{ Key: 'b.md' }],
        IsTruncated: false,
      })
    const out: string[] = []
    for await (const key of storage.list()) out.push(key)
    expect(out).toEqual(['a.md', 'b.md'])
  })

  it('list accepts a sub-prefix argument', async () => {
    const storage = makeStorage({ prefix: 'vault' })
    s3Mock.on(ListObjectsV2Command).resolves({ Contents: [], IsTruncated: false })
    const out: string[] = []
    for await (const key of storage.list('notes/')) out.push(key)
    const calls = s3Mock.commandCalls(ListObjectsV2Command)
    expect(calls[0]?.args[0].input.Prefix).toBe('vault/notes/')
    expect(out).toEqual([])
  })

  it('list skips entries without a key', async () => {
    const storage = makeStorage()
    s3Mock.on(ListObjectsV2Command).resolves({
      Contents: [{}, { Key: 'a.md' }],
      IsTruncated: false,
    })
    const out: string[] = []
    for await (const key of storage.list()) out.push(key)
    expect(out).toEqual(['a.md'])
  })

  it('builds a default client when none is provided', () => {
    const storage = new S3Storage({
      bucket: 'b',
      region: 'eu-west-1',
      endpoint: 'https://minio.local',
      forcePathStyle: true,
      credentials: { accessKeyId: 'k', secretAccessKey: 's', sessionToken: 'x' },
    })
    expect(storage).toBeInstanceOf(S3Storage)
  })
})
