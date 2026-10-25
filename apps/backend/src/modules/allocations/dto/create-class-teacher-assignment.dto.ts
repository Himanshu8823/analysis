import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';
import { IsEntityId } from '@/common/validators/is-entity-id.validator';

/**
 * Assigns the class teacher for a class.
 *
 * A class is branch + semester + scheme + academic year, and it has exactly
 * one class teacher — the backend enforces that with a unique constraint, so
 * replacing a class teacher is a delete followed by a create.
 */
export class CreateClassTeacherAssignmentDto {
  @ApiProperty({ description: 'Teacher taking on the class' })
  @IsEntityId()
  teacherId: string;

  @ApiProperty({ description: 'Branch of the class' })
  @IsEntityId()
  branchId: string;

  @ApiProperty({ example: 5 })
  @IsInt()
  @Min(1)
  semester: number;

  @ApiProperty({ description: 'Scheme of the class' })
  @IsEntityId()
  schemeId: string;

  @ApiProperty({ description: 'Academic year of the class' })
  @IsEntityId()
  academicYearId: string;
}
