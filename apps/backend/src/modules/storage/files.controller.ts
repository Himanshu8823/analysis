import { Controller, Get, NotFoundException, Param, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import { StorageService } from './storage.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';

const CONTENT_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.csv': 'text/csv',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.txt': 'text/plain',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

/**
 * Serves stored files.
 *
 * The route is authenticated — a stored file may contain a result sheet or a
 * member's profile picture, so it must not be publicly readable. The parser
 * workers read the same bytes straight from storage via
 * `StorageService.readByUrl`, so they do not go through here and are
 * unaffected by this guard.
 *
 * This route serves the local-disk store. When a bucket is configured the
 * files are served from it directly, and this route is only reached for
 * files that were written before the bucket was configured.
 */
@ApiTags('Files')
@ApiBearerAuth()
@Controller('files')
export class FilesController {
  constructor(private readonly storage: StorageService) {}

  /**
   * Serves a stored file by its path below the storage root.
   *
   * The path is matched in full (`*`) rather than as a fixed number of
   * segments, because a stored file lives under a folder and a dated
   * sub-folder — `uploads/2026-11-01/<uuid>.csv` — and the shape of that
   * path differs per file type.
   */
  @Get('*')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Download a stored file' })
  async download(@Param('0') relativePath: string, @Res() response: Response): Promise<void> {
    /**
     * The route parameter arrives without its leading slash. A path that
     * tries to climb out of the storage root is rejected by the storage
     * service itself, so it is only passed on as-is.
     */
    const normalized = relativePath.replace(/^\/+/, '');
    if (!normalized) {
      throw new NotFoundException('File not found');
    }

    let buffer: Buffer;
    try {
      buffer = await this.storage.read(normalized);
    } catch {
      throw new NotFoundException('File not found');
    }

    const dot = normalized.lastIndexOf('.');
    const extension = dot === -1 ? '' : normalized.slice(dot).toLowerCase();
    response.setHeader('Content-Type', CONTENT_TYPES[extension] ?? 'application/octet-stream');
    response.setHeader('Content-Length', buffer.length);
    response.send(buffer);
  }
}
