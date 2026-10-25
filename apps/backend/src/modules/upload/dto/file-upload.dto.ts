import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum SupportedFileType {
  EXCEL = 'EXCEL',
  PDF_TEXT = 'PDF_TEXT',
  PDF_IMAGE = 'PDF_IMAGE',
  CSV = 'CSV',
}

export class FileMetadataDto {
  @ApiProperty({ description: 'Original filename' })
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @ApiProperty({ enum: SupportedFileType })
  @IsEnum(SupportedFileType)
  fileType: SupportedFileType;

  @ApiProperty({ example: 1024000 })
  @IsNumber()
  @Min(1)
  fileSize: number;

  @ApiProperty({
    description: 'MIME-type or storage URL container info (not the actual file)',
    required: false,
  })
  @IsOptional()
  @IsString()
  contentType?: string;

  @ApiProperty({
    description:
      'Filter hints (branchId, schemeId, semester, academicYearId) to apply during processing',
    required: false,
  })
  @IsOptional()
  context?: Record<string, unknown>;
}
