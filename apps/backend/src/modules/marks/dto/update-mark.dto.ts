import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateMarkDto } from './create-mark.dto';

export class UpdateMarkDto extends PartialType(
  OmitType(CreateMarkDto, ['studentId', 'subjectOfferingId', 'examType', 'academicYearId'] as const)
) {}
