import {
  IsArray,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class ExtractedMarkRowDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  rollNo: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  subjectCode: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  examType: string;

  @ApiProperty()
  marksObtained: number;

  @ApiProperty()
  maxMarks: number;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  isAbsent?: boolean;
}

export class ConfirmUploadDto {
  @ApiProperty({ type: [ExtractedMarkRowDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExtractedMarkRowDto)
  rows: ExtractedMarkRowDto[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
