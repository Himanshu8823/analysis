import { Controller, Get, Post, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AllocationsService } from './allocations.service';
import { CreateTeacherAllocationDto, CreateClassTeacherAssignmentDto } from './dto';
import { Permissions, CurrentUser, Audited, AuditAction, AuditResource } from '@/common/decorators';
import { ScopeService } from '@/common/services/scope.service';
import { parseOptionalInt, parseOptionalString } from '@/common/utils/query-params';
import type { JwtPayload } from '@/common/types';

/**
 * Teacher allocations and class-teacher assignments.
 *
 * These are two separate things with two separate permissions, because they
 * are two separate duties of the HOD:
 *
 *  - `teacher_allocations:write` — "this teacher teaches this subject".
 *    It is what gives the teacher the right to enter marks for that subject.
 *  - `class_teacher_assignments:write` — "this teacher is the class teacher".
 *    It is what gives the teacher the right to see the class's statistics.
 *
 * Granting one does not grant the other, and neither is granted by simply
 * being a teacher.
 */
@ApiTags('Allocations')
@ApiBearerAuth()
@Controller('teacher-allocations')
export class TeacherAllocationsController {
  constructor(
    private readonly service: AllocationsService,
    private readonly scope: ScopeService
  ) {}

  @Post()
  @Permissions('teacher_allocations:write')
  @Audited(AuditResource.TEACHER_ALLOCATION, AuditAction.CREATE, {
    resourceIdSource: 'response',
    detailsFromBody: {
      teacherId: 'teacherId',
      subjectOfferingId: 'subjectOfferingId',
      academicYearId: 'academicYearId',
    },
  })
  @ApiOperation({ summary: 'Allocate a subject offering to a teacher' })
  async create(@Body() dto: CreateTeacherAllocationDto) {
    return this.service.createTeacherAllocation(dto);
  }

  @Get()
  @Permissions('teacher_allocations:read')
  @ApiOperation({ summary: 'List subject-to-teacher allocations' })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'semester', required: false })
  @ApiQuery({ name: 'academicYearId', required: false })
  @ApiQuery({ name: 'teacherId', required: false })
  @ApiQuery({ name: 'subjectOfferingId', required: false })
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query('branchId') branchId?: string,
    @Query('semester') semester?: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('teacherId') teacherId?: string,
    @Query('subjectOfferingId') subjectOfferingId?: string
  ) {
    const effectiveBranchId = await this.scope.resolveBranchScope(
      user.sub,
      parseOptionalString(branchId)
    );

    return this.service.findTeacherAllocations({
      branchId: effectiveBranchId,
      semester: parseOptionalInt(semester),
      academicYearId: parseOptionalString(academicYearId),
      teacherId: parseOptionalString(teacherId),
      subjectOfferingId: parseOptionalString(subjectOfferingId),
    });
  }

  @Delete(':id')
  @Permissions('teacher_allocations:write')
  @Audited(AuditResource.TEACHER_ALLOCATION, AuditAction.DELETE, {
    resourceIdSource: 'param',
  })
  @ApiOperation({ summary: 'Remove a teacher allocation' })
  async delete(@Param('id') id: string): Promise<void> {
    return this.service.deleteTeacherAllocation(id);
  }
}

@ApiTags('Allocations')
@ApiBearerAuth()
@Controller('class-teacher-assignments')
export class ClassTeacherAssignmentsController {
  constructor(
    private readonly service: AllocationsService,
    private readonly scope: ScopeService
  ) {}

  @Post()
  @Permissions('class_teacher_assignments:write')
  @Audited(AuditResource.CLASS_TEACHER_ASSIGNMENT, AuditAction.CREATE, {
    resourceIdSource: 'response',
    detailsFromBody: {
      teacherId: 'teacherId',
      branchId: 'branchId',
      semester: 'semester',
      schemeId: 'schemeId',
      academicYearId: 'academicYearId',
    },
  })
  @ApiOperation({ summary: 'Assign the class teacher for a class' })
  async create(@Body() dto: CreateClassTeacherAssignmentDto, @CurrentUser() user: JwtPayload) {
    // The HOD may only assign within their own branch.
    await this.scope.resolveBranchScope(user.sub, dto.branchId);
    return this.service.createClassTeacherAssignment(dto, user.sub);
  }

  @Get()
  @Permissions('class_teacher_assignments:read')
  @ApiOperation({ summary: 'List class-teacher assignments' })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'semester', required: false })
  @ApiQuery({ name: 'academicYearId', required: false })
  @ApiQuery({ name: 'teacherId', required: false })
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query('branchId') branchId?: string,
    @Query('semester') semester?: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('teacherId') teacherId?: string
  ) {
    const effectiveBranchId = await this.scope.resolveBranchScope(
      user.sub,
      parseOptionalString(branchId)
    );

    return this.service.findClassTeacherAssignments({
      branchId: effectiveBranchId,
      semester: parseOptionalInt(semester),
      academicYearId: parseOptionalString(academicYearId),
      teacherId: parseOptionalString(teacherId),
    });
  }

  @Delete(':id')
  @Permissions('class_teacher_assignments:write')
  @Audited(AuditResource.CLASS_TEACHER_ASSIGNMENT, AuditAction.DELETE, {
    resourceIdSource: 'param',
  })
  @ApiOperation({ summary: 'Remove a class-teacher assignment' })
  async delete(@Param('id') id: string): Promise<void> {
    return this.service.deleteClassTeacherAssignment(id);
  }
}
