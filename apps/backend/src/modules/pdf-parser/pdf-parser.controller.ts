import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PdfParserService } from './pdf-parser.service';
import { ParsePdfDto } from './dto';
import { Roles, Permissions } from '@/common/decorators';

@ApiTags('PDF Parser')
@ApiBearerAuth()
@Controller('pdf-parser')
export class PdfParserController {
  constructor(private readonly service: PdfParserService) {}

  @Post('parse')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @Permissions('upload:process')
  @ApiOperation({ summary: 'Parse a text-based PDF from URL (stub, runs in worker)' })
  async parse(@Body() dto: ParsePdfDto) {
    return this.service.extractTextFromUrl(dto.fileUrl);
  }
}