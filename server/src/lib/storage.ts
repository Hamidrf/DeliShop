import { randomBytes } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { env } from '../env';

/** `media` is served straight from the bucket/CDN to the browser; `receipts` is only ever read through an authenticated route. */
export type Bucket = 'media' | 'receipts';

export interface StoredObject {
  body: Buffer;
  contentType: string;
}

export interface StorageDriver {
  put(bucket: Bucket, key: string, data: Buffer, contentType: string): Promise<void>;
  delete(bucket: Bucket, key: string): Promise<void>;
  get(bucket: Bucket, key: string): Promise<StoredObject | null>;
  /** Public URL for a `media` key. Never call this for `receipts`. */
  publicUrl(key: string): string;
}

class DiskStorageDriver implements StorageDriver {
  constructor(private root: string, private publicBase: string) {}

  private pathFor(bucket: Bucket, key: string) {
    return path.join(this.root, bucket, key);
  }

  async put(bucket: Bucket, key: string, data: Buffer, _contentType: string) {
    const dest = this.pathFor(bucket, key);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, data);
  }

  async delete(bucket: Bucket, key: string) {
    await rm(this.pathFor(bucket, key), { force: true });
  }

  async get(bucket: Bucket, key: string): Promise<StoredObject | null> {
    try {
      const body = await readFile(this.pathFor(bucket, key));
      return { body, contentType: mimeFromKey(key) };
    } catch {
      return null;
    }
  }

  publicUrl(key: string) {
    return `${this.publicBase}/${key}`;
  }
}

class S3StorageDriver implements StorageDriver {
  private client: S3Client;
  private buckets: Record<Bucket, string>;

  constructor(private publicBase: string) {
    this.client = new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      forcePathStyle: true,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID!,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
      },
    });
    this.buckets = { media: env.S3_MEDIA_BUCKET!, receipts: env.S3_RECEIPTS_BUCKET! };
  }

  async put(bucket: Bucket, key: string, data: Buffer, contentType: string) {
    await this.client.send(new PutObjectCommand({
      Bucket: this.buckets[bucket],
      Key: key,
      Body: data,
      ContentType: contentType,
    }));
  }

  async delete(bucket: Bucket, key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.buckets[bucket], Key: key }));
  }

  async get(bucket: Bucket, key: string): Promise<StoredObject | null> {
    try {
      const res = await this.client.send(new GetObjectCommand({ Bucket: this.buckets[bucket], Key: key }));
      const body = Buffer.from(await res.Body!.transformToByteArray());
      return { body, contentType: res.ContentType ?? mimeFromKey(key) };
    } catch {
      return null;
    }
  }

  publicUrl(key: string) {
    return `${this.publicBase}/${key}`;
  }
}

function mimeFromKey(key: string): string {
  const ext = path.extname(key).toLowerCase();
  const table: Record<string, string> = {
    '.webp': 'image/webp',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.heic': 'image/heic',
    '.webm': 'audio/webm',
    '.m4a': 'audio/mp4',
    '.mp3': 'audio/mpeg',
    '.ogg': 'audio/ogg',
  };
  return table[ext] ?? 'application/octet-stream';
}

/** A short random suffix so replacing a file at "the same" logical key busts caches (`Cache-Control: immutable`). */
export function randomSuffix(): string {
  return randomBytes(4).toString('hex');
}

export const storage: StorageDriver = env.STORAGE_DRIVER === 's3'
  ? new S3StorageDriver(env.MEDIA_PUBLIC_BASE_URL)
  : new DiskStorageDriver(path.resolve(env.LOCAL_UPLOAD_DIR), env.MEDIA_PUBLIC_BASE_URL);
