import {
  IsString, IsNotEmpty, IsInt, IsUUID, IsBoolean, IsOptional, Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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
  @IsUUID('4')
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
  @IsUUID('4')
  schemeId: string;

  @ApiProperty()
  @IsUUID('4')
  batchId: string;

  @ApiProperty()
  @IsUUID('4')
  academicYearId: string;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}