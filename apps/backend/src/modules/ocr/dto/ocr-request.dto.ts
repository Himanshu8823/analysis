import { IsUrl, IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class OcrRequestDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @IsUrl({ require_protocol: true })
  fileUrl: string;

  @ApiProperty({ required: false, enum: ['table', 'text'] })
  @IsOptional()
  @IsIn(['table', 'text'])
  modelHint?: 'table' | 'text';
}