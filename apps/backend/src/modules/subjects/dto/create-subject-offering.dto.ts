import { IsString, IsInt, IsOptional, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsEntityId } from '@/common/validators/is-entity-id.validator';

/**
 * Assigns an existing subject to a branch + semester + scheme.
 *
 * The subject itself is never duplicated here — this record says "CS301 runs
 * for the CSE branch in semester 5 under the 2024 scheme". Marks entered by a
 * teacher hang off this record, not off the subject.
 */
export class CreateSubjectOfferingDto {
  @ApiProperty({ description: 'Existing subject being offered' })
  @IsEntityId()
  subjectId: string;

  @ApiProperty({ description: 'Branch the subject is offered in' })
  @IsEntityId()
  branchId: string;

  @ApiProperty({ example: 5 })
  @IsInt()
  @Min(1)
  semester: number;

  @ApiProperty({ description: 'Scheme (curriculum) the offering follows' })
  @IsEntityId()
  schemeId: string;

  @ApiProperty({ required: false, example: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  year?: number;

  @ApiProperty({ required: false, description: 'Academic year the offering belongs to' })
  @IsOptional()
  @IsEntityId()
  academicYearId?: string;
}

/**
 * Filter for listing subject offerings.
 */
export class SubjectOfferingQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  subjectId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  schemeId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  academicYearId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  semester?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  isActive?: string;
}
