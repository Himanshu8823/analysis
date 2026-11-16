import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AcademicService } from './academic.service';
import { Permissions, CurrentUser } from '@/common/decorators';
import { ScopeService } from '@/common/services/scope.service';
import { parseOptionalInt, parseOptionalString } from '@/common/utils/query-params';
import type { JwtPayload } from '@/common/types';

/**
 * The academic structure — the spine of the college.
 *
 * Branches → academic years → semesters → the subjects offered to each
 * class, who teaches them, who is the class teacher, how many students are
 * enrolled, and how many of them still have marks missing.
 *
 * This is the screen the college navigates by. Without it, setting up a new
 * year means opening four different screens and remembering which is which.
 */
@ApiTags('Academic Structure')
@ApiBearerAuth()
@Controller('academic/structure')
export class AcademicStructureController {
  constructor(
    private readonly service: AcademicService,
    private readonly scope: ScopeService
  ) {}

  @Get()
  @Permissions('subject_offerings:read', 'subjects:read')
  @ApiOperation({
    summary:
      'The academic structure — branches, years, semesters, subjects, teachers and readiness',
    description:
      'Returns every class in the caller’s scope with the subjects taught to it, ' +
      'the teacher allocated to each, the class teacher, the number of students, ' +
      'and how many of them still have marks missing.',
  })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'academicYearId', required: false })
  async structure(
    @CurrentUser() user: JwtPayload,
    @Query('branchId') branchId?: string,
    @Query('academicYearId') academicYearId?: string
  ) {
    const effectiveBranchIds = await this.scope.resolveBranchFilter(
      user.sub,
      parseOptionalString(branchId)
    );

    return this.service.buildStructure({
      branchIds: effectiveBranchIds,
      academicYearId: parseOptionalString(academicYearId),
      semester: parseOptionalInt(undefined),
    });
  }
}
