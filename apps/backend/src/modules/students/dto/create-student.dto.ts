import {
  IsString, IsNotEmpty, IsInt, IsBoolean, IsOptional, Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsEntityId } from '@/common/validators/is-entity-id.validator';

export class CreateStudentDto {
  @ApiProperty({ example: 'CS2022-001' })
  @IsString()
  @IsNotEmpty()
  rollNo: string;

  @ApiProperty({ example: 'Aarav Sharma' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsEntityId()
  branchId: string;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  currentYear: number;

  @ApiProperty({ example: 4 })
  @IsInt()
  @Min(1)
  semester: number;

  @ApiProperty()
  @IsEntityId()
  schemeId: string;

  @ApiProperty()
  @IsEntityId()
  batchId: string;

  @ApiProperty()
  @IsEntityId()
  academicYearId: string;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}