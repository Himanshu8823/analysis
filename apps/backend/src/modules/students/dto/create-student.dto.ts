import { IsString, IsNotEmpty, IsInt, IsBoolean, IsOptional, IsEmail, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsEntityId } from '@/common/validators/is-entity-id.validator';
import { StudentDetailsDto } from './student-details.dto';

export class CreateStudentDto extends StudentDetailsDto {
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

  @ApiProperty({
    example: 4,
    description:
      'The semester the student is in. The curriculum year follows from it — semesters 1-2 are year 1, 3-4 are year 2, and so on.',
  })
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
