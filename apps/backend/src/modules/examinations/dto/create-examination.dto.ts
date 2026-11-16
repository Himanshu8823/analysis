import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsInt, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { IsEntityId } from '@/common/validators/is-entity-id.validator';

/**
 * The body of a request to open an examination for a class.
 */
export class CreateExaminationDto {
  @ApiProperty({ example: 'Computer Science — Semester 5 — End Semester 2025' })
  @IsString()
  @MinLength(3, { message: 'Give the examination a name of at least three characters.' })
  @MaxLength(120)
  name!: string;

  @ApiProperty({ description: 'The branch of the class.' })
  @IsEntityId()
  branchId!: string;

  @ApiProperty({ example: 5 })
  @IsInt()
  @Min(1, { message: 'Choose the semester of the class.' })
  semester!: number;

  @ApiProperty({ description: 'The scheme of the class.' })
  @IsEntityId()
  schemeId!: string;

  @ApiProperty({ description: 'The academic year of the class.' })
  @IsEntityId()
  academicYearId!: string;

  @ApiProperty({ description: 'The day of the examination.', example: '2026-05-12' })
  @IsDateString({}, { message: 'Give the date of the examination, as YYYY-MM-DD.' })
  examDate!: string;
}
