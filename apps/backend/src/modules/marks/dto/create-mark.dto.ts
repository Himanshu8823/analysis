import { IsString, IsNumber, IsBoolean, IsOptional, Min, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsEntityId } from '@/common/validators/is-entity-id.validator';

const EXAM_TYPES = ['CA1', 'CA2', 'MID_SEM', 'WRITTEN', 'PRACTICAL', 'ORAL'] as const;

export class CreateMarkDto {
  @ApiProperty()
  @IsEntityId()
  studentId: string;

  /**
   * The subject offering the marks belong to — the subject as it runs in a
   * particular branch, semester and scheme.
   *
   * A mark is recorded against the offering rather than the bare subject
   * because the same subject is offered in several semesters, and each
   * offering has its own class of students.
   */
  @ApiProperty()
  @IsEntityId()
  subjectOfferingId: string;

  @ApiProperty({ enum: EXAM_TYPES })
  @IsString()
  @IsIn(EXAM_TYPES as unknown as string[])
  examType: string;

  @ApiProperty({ example: 78 })
  @IsNumber()
  @Min(0)
  marksObtained: number;

  @ApiProperty({ example: 100 })
  @IsNumber()
  @Min(1)
  maxMarks: number;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isAbsent?: boolean;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isWithheld?: boolean;

  @ApiProperty()
  @IsEntityId()
  academicYearId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  remarks?: string;
}
