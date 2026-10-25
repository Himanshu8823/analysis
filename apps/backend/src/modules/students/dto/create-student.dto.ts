import { IsString, IsNotEmpty, IsInt, IsBoolean, IsOptional, IsEmail, Min } from 'class-validator';
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

  @ApiProperty({
    required: false,
    example: 'aarav.sharma@example.com',
    description:
      "The student's email address. Optional — but without it the student cannot be given a login, because the account is created against this address.",
  })
  @IsOptional()
  @IsEmail()
  email?: string;

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
