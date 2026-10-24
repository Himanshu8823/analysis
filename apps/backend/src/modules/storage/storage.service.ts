import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'crypto';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import { dirname, extname, join, resolve, sep } from 'path';

export interface StoredFile {
  /** The absolute URL the backend can fetch the file from. */
  fileUrl: string;
  /** The path the file was written to, relative to the storage root. */
  relativePath: string;
  size: number;
}

/**
 * Local-disk file storage.
 *
 * The upload flow needs a URL the backend can fetch the bytes from. S3-style
 * presigned uploads are the production answer, but they need a live bucket and
 * a signing endpoint; the local store keeps the whole flow working end to end
 * and is what the multipart endpoint uses today.
 *
 * Files are written under a single root directory and every path is resolved
 * and checked against that root, so a crafted file name cannot escape it.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly root: string;
  private readonly publicBaseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.root = resolve(
      process.cwd(),
      this.config.get<string>('storage.local.directory') ?? 'uploads',
    );
    this.publicBaseUrl = (
      this.config.get<string>('storage.local.publicBaseUrl')
      ?? `http://localhost:${this.config.get<number>('server.port') ?? 3001}`
    ).replace(/\/+$/, '');
  }

  /** The directory every uploaded file lives under. */
  get rootDirectory(): string {
    return this.root;
  }

  /**
   * Writes a buffer to disk and returns the URL it can be fetched from.
   */
  async save(buffer: Buffer, originalName: string): Promise<StoredFile> {
    if (!buffer.length) {
      throw new BadRequestException('The uploaded file is empty');
    }

    const extension = extname(originalName).toLowerCase().slice(0, 10);
    const relativePath = join(
      new Date().toISOString().slice(0, 10),
      `${randomUUID()}${extension}`,
    );

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

  /** Reads a stored file back. */
  async read(relativePath: string): Promise<Buffer> {
    return readFile(this.resolveInsideRoot(relativePath));
  }

  /** Deletes a stored file. Missing files are ignored. */
  async remove(relativePath: string): Promise<void> {
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
