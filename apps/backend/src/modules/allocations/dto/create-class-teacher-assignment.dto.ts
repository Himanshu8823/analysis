import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';
import { IsEntityId } from '@/common/validators/is-entity-id.validator';

/**
 * Assigns the class teacher for a class.
 *
 * A class is branch + semester + scheme + academic year, and it has exactly
 * one class teacher — the backend enforces that with a unique constraint.
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

  /**
   * Confirms that replacing an existing class teacher is intended.
   *
   * A class has exactly one class teacher. When one is already assigned,
   * assigning another is a **replacement** — the previous teacher's access
   * to the class's statistics ends. That must be a deliberate act, not an
   * accidental overwrite, so the request has to say so.
   *
   * It is optional because it is only needed when there is something to
   * replace; a first assignment carries no previous teacher.
   */
  @ApiProperty({
    required: false,
    description: 'Set to true to confirm that replacing the existing class teacher is intended.',
  })
  @IsOptional()
  @IsBoolean({
    message: 'replacesExisting must be true or false.',
  })
  replacesExisting?: boolean;
}
