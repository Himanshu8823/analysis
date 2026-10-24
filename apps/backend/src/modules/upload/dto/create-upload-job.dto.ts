import {
  IsString, IsNotEmpty, IsInt, IsIn, IsObject, IsOptional, Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

const FILE_TYPES = ['EXCEL', 'PDF_TEXT', 'PDF_IMAGE', 'CSV'] as const;

export class CreateUploadJobDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @ApiProperty({ enum: FILE_TYPES })
  @IsString()
  @IsIn(FILE_TYPES as unknown as string[])
  fileType: string;

  @ApiProperty({ description: 'Storage URL after presigned upload completes' })
  @IsString()
  @IsNotEmpty()
  fileUrl: string;

  @ApiProperty({ example: 1024000 })
  @IsInt()
  @Min(1)
  fileSize: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}