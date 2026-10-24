import {
  IsString, IsNotEmpty, IsInt, IsOptional, Min, Max, IsArray,
  ValidateNested, ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsEntityId } from '@/common/validators/is-entity-id.validator';

/**
 * One row of an uploaded student sheet. The scope (branch, scheme, batch,
 * academic year) can be supplied per row or once for the whole file — the
 * service merges the two so a single-scope sheet does not repeat the same
 * columns on every line.
 */
export class BulkImportStudentRowDto {
  @ApiProperty({ example: 'CS2022-001' })
  @IsString()
  @IsNotEmpty()
  rollNo: string;

  @ApiProperty({ example: 'Aarav Sharma' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEntityId()
  branchId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  currentYear?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  semester?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEntityId()
  schemeId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEntityId()
  batchId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEntityId()
  academicYearId?: string;
}

/**
 * The JSON body used by the spreadsheet importer. The multipart endpoint
 * accepts the same shape after parsing the uploaded file into rows.
 */
export class BulkImportStudentsDto {
  @ApiProperty({ type: [BulkImportStudentRowDto] })
  @IsArray()
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => BulkImportStudentRowDto)
  rows: BulkImportStudentRowDto[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEntityId()
  branchId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEntityId()
  schemeId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEntityId()
  batchId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEntityId()
  academicYearId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  currentYear?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  semester?: number;
}
