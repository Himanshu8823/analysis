import { ApiProperty } from '@nestjs/swagger';
import { IsEntityId } from '@/common/validators/is-entity-id.validator';

/**
 * Allocates a subject offering to a teacher.
 *
 * The offering already carries the branch, semester and scheme, so the
 * allocation only names the teacher, the offering and the academic year the
 * allocation applies to.
 */
export class CreateTeacherAllocationDto {
  @ApiProperty({ description: 'Teacher who will teach the subject' })
  @IsEntityId()
  teacherId: string;

  @ApiProperty({ description: 'Subject offering being allocated' })
  @IsEntityId()
  subjectOfferingId: string;

  @ApiProperty({ description: 'Academic year the allocation applies to' })
  @IsEntityId()
  academicYearId: string;
}
