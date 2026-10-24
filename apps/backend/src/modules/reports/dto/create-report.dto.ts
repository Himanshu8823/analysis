import { IsString, IsNotEmpty, IsObject, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

const REPORT_TYPES = [
  'STUDENT_WISE',
  'SCHEME_WISE',
  'SUBJECT_ANALYSIS',
  'STUDENT_ANALYSIS',
  'CLASS_TOPPERS',
  'PASS_FAIL',
  'COMPLETE',
] as const;

export class CreateReportDto {
  @ApiProperty({ enum: REPORT_TYPES })
  @IsString()
  @IsIn(REPORT_TYPES as unknown as string[])
  type: string;

  @ApiProperty({
    description: 'Filters for report (branchId, schemeId, semester, academicYearId, etc.)',
    example: { branchId: 'uuid', schemeId: 'uuid', semester: 4, academicYearId: 'uuid' },
  })
  @IsObject()
  filters: Record<string, unknown>;
}