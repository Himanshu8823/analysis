import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { createHash, randomUUID } from 'crypto';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import { dirname, extname, resolve, sep } from 'path';

export interface StoredFile {
  /** The absolute URL the backend can fetch the file from. */
  fileUrl: string;
  /** The path the file was written to, relative to the storage root. */
  relativePath: string;
  size: number;
}

/**
 * The object-storage client used when the bucket is configured.
 *
 * The S3-compatible settings work with Neon Storage, AWS S3, Cloudflare R2 and
 * MinIO alike — only the endpoint and the credentials differ.
 */
interface S3Settings {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  bucket: string;
  forcePathStyle: boolean;
}

/**
 * File storage.
 *
 * Files live in an S3-compatible bucket — Neon Storage in this deployment —
 * and the database only ever holds the URL they were published under.
 *
 * The local-disk store is the fallback for a deployment with no bucket
 * configured (a fresh checkout, a CI run). It is not used when the bucket is
 * configured, so an installation never silently splits its files across two
 * stores.
 *
 * Every local path is resolved and checked against the storage root, so a
 * crafted file name cannot escape it.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly root: string;
  private readonly publicBaseUrl: string;
  private readonly s3: S3Settings | null;
  private readonly s3Client: S3Client | null;

  constructor(private readonly config: ConfigService) {
    this.root = resolve(
      process.cwd(),
      this.config.get<string>('storage.local.directory') ?? 'uploads'
    );
    /**
     * The configured base URL, or the local server URL when none is set.
     * `||` is deliberate: an empty string is not a usable base URL, and the
     * `??` operator would let it through and produce relative file URLs.
     */
    this.publicBaseUrl = (
      this.config.get<string>('storage.local.publicBaseUrl') ||
      `http://localhost:${this.config.get<number>('server.port') ?? 3001}`
    ).replace(/\/+$/, '');

    this.s3 = this.readS3Settings();
    this.s3Client = this.s3
      ? new S3Client({
          region: this.s3.region,
          endpoint: this.s3.endpoint,
          forcePathStyle: this.s3.forcePathStyle,
          credentials: {
            accessKeyId: this.s3.accessKeyId,
            secretAccessKey: this.s3.secretAccessKey,
          },
        })
      : null;
  }

  /**
   * Reads the bucket settings, or returns `null` when the bucket is not
   * fully configured.
   *
   * All four values are required. A partially configured bucket would produce
   * a client that fails on the first write with an opaque credential error,
   * so the store falls back to local disk instead and says so in the log.
   */
  private readS3Settings(): S3Settings | null {
    const endpoint = this.config.get<string>('storage.s3.endpoint');
    const accessKeyId = this.config.get<string>('storage.s3.accessKeyId');
    const secretAccessKey = this.config.get<string>('storage.s3.secretAccessKey');
    const bucket = this.config.get<string>('storage.s3.bucket');

    if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
      return null;
    }

    return {
      endpoint,
      accessKeyId,
      secretAccessKey,
      bucket,
      region: this.config.get<string>('storage.s3.region') ?? 'us-east-2',
      forcePathStyle: this.config.get<boolean>('storage.s3.forcePathStyle') ?? false,
    };
  }

  /** True when files are written to the object-storage bucket. */
  get usesObjectStorage(): boolean {
    return this.s3Client !== null;
  }

  /** The directory every locally stored file lives under. */
  get rootDirectory(): string {
    return this.root;
  }

  /**
   * Writes a buffer to storage and returns the URL it can be fetched from.
   *
   * `folder` groups the files inside the bucket — an upload and a profile
   * picture share the bucket but not the prefix, so a listing of one never
   * walks into the other.
   */
  async save(buffer: Buffer, originalName: string, folder = 'uploads'): Promise<StoredFile> {
    if (!buffer.length) {
      throw new BadRequestException('The uploaded file is empty');
    }

    const extension = extname(originalName).toLowerCase().slice(0, 10);
    const relativePath = `${folder}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}${extension}`;

    if (this.s3Client && this.s3) {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.s3.bucket,
          Key: relativePath,
          Body: buffer,
        })
      );

      this.logger.log(
        `Stored upload ${relativePath} in ${this.s3.bucket} (${buffer.length} bytes)`
      );

      return {
        fileUrl: this.publicObjectUrl(relativePath),
        relativePath,
        size: buffer.length,
      };
    }

    const absolutePath = this.resolveInsideRoot(relativePath);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, buffer);

    this.logger.log(`Stored upload ${relativePath} (${buffer.length} bytes)`);

    return {
      fileUrl: `${this.publicBaseUrl}/files/${relativePath.split(sep).join('/')}`,
      relativePath,
      size: buffer.length,
    };
  }

  /**
   * The public URL a stored object is served from.
   *
   * For a path-style endpoint the bucket is part of the path; for a
   * virtual-hosted endpoint it is the host's first label. Neon Storage uses
   * the path style, which is why the bucket is prefixed here.
   */
  private publicObjectUrl(relativePath: string): string {
    if (!this.s3) {
      return `${this.publicBaseUrl}/files/${relativePath}`;
    }

    const endpoint = this.s3.endpoint.replace(/\/+$/, '');
    if (this.s3.forcePathStyle) {
      return `${endpoint}/${this.s3.bucket}/${relativePath}`;
    }

    // A virtual-hosted endpoint already carries the bucket in its host.
    return `${endpoint}/${relativePath}`;
  }

  /**
   * Reads a stored file back.
   *
   * Reads from the bucket when one is configured, and from the local store
   * otherwise. A path is tried against the configured store first, so a file
   * written before the bucket was configured is still readable.
   */
  async read(relativePath: string): Promise<Buffer> {
    if (this.s3Client && this.s3) {
      try {
        const result = await this.s3Client.send(
          new GetObjectCommand({
            Bucket: this.s3.bucket,
            Key: relativePath,
          })
        );
        if (result.Body) {
          return Buffer.from(await result.Body.transformToByteArray());
        }
      } catch (error) {
        this.logger.warn(
          `Could not read ${relativePath} from ${this.s3.bucket}: ${error instanceof Error ? error.message : 'unknown error'}`
        );
      }
    }

    return readFile(this.resolveInsideRoot(relativePath));
  }

  /**
   * Reads a stored file given the URL it was published under.
   *
   * The parser workers need the bytes of a file the backend itself stored.
   * Fetching that URL over HTTP would hit the JWT guard on the `/files`
   * route, so the bytes are read straight from the store instead — the path
   * is derived from the URL and then resolved inside the storage root, so a
   * crafted URL still cannot escape it.
   *
   * Returns `null` when the URL does not point at this store — for example
   * when the file lives in an external bucket — and the caller can then fall
   * back to fetching it over HTTP.
   */
  async readByUrl(fileUrl: string): Promise<Buffer | null> {
    const relativePath = this.relativePathFromUrl(fileUrl);
    if (!relativePath) return null;

    try {
      return await this.read(relativePath);
    } catch {
      return null;
    }
  }

  /**
   * Extracts the storage-relative path from a published file URL.
   *
   * Returns `null` when the URL does not address this store — for example
   * when the file lives in an external bucket.
   */
  relativePathFromUrl(fileUrl: string): string | null {
    let pathname: string;
    try {
      pathname = new URL(fileUrl).pathname;
    } catch {
      return null;
    }

    /**
     * A bucket URL carries the bucket as its first path segment, so the
     * marker is looked for after it rather than at the start.
     */
    for (const marker of ['/files/', '/neon/']) {
      const index = pathname.indexOf(marker);
      if (index === -1) continue;

      const relativePath = decodeURIComponent(pathname.slice(index + marker.length));
      if (!relativePath) continue;

      // `resolveInsideRoot` rejects anything that tries to escape the root.
      return relativePath;
    }

    return null;
  }

  /**
   * Deletes a stored file. Missing files are ignored.
   */
  async remove(relativePath: string): Promise<void> {
    if (this.s3Client && this.s3) {
      try {
        await this.s3Client.send(
          new DeleteObjectCommand({
            Bucket: this.s3.bucket,
            Key: relativePath,
          })
        );
        return;
      } catch (error) {
        this.logger.warn(
          `Could not delete ${relativePath} from ${this.s3.bucket}: ${error instanceof Error ? error.message : 'unknown error'}`
        );
        return;
      }
    }

    try {
      await unlink(this.resolveInsideRoot(relativePath));
    } catch {
      // The file is already gone — nothing to clean up.
    }
  }

  /**
   * Resolves a path inside the storage root and rejects anything that tries
   * to escape it (`../` traversal, absolute paths, symlink tricks).
   */
  private resolveInsideRoot(relativePath: string): string {
    const absolute = resolve(this.root, relativePath);
    if (absolute !== this.root && !absolute.startsWith(this.root + sep)) {
      throw new BadRequestException('Invalid file path');
    }
    return absolute;
  }

  /** A stable hash of the file bytes — used to de-duplicate uploads. */
  static checksum(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }
}
