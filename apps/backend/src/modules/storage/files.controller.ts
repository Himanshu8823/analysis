import {
  Controller, Get, NotFoundException, Param, Res, UseGuards,
} from '@nestjs/common';
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
};

/**
 * Serves stored upload files.
 *
 * The route is authenticated — a stored file may contain a result sheet, so
 * it must not be publicly readable. The parser workers read the same bytes
 * from disk directly, so they do not go through here.
 */
@ApiTags('Files')
@ApiBearerAuth()
@Controller('files')
export class FilesController {
  constructor(private readonly storage: StorageService) {}

  @Get(':date/:name')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Download a stored upload file' })
  async download(
    @Param('date') date: string,
    @Param('name') name: string,
    @Res() response: Response,
  ): Promise<void> {
    const relativePath = `${date}/${name}`;

    let buffer: Buffer;
    try {
      buffer = await this.storage.read(relativePath);
    } catch {
      throw new NotFoundException('File not found');
    }

    const extension = name.slice(name.lastIndexOf('.')).toLowerCase();
    response.setHeader(
      'Content-Type',
      CONTENT_TYPES[extension] ?? 'application/octet-stream',
    );
    response.setHeader('Content-Length', buffer.length);
    response.send(buffer);
  }
}
