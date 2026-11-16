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
  async create(@Body() dto: CreateTeacherAllocationDto, @CurrentUser() user: JwtPayload) {
    return this.service.createTeacherAllocation(dto, user.sub);
  }

  /**
   * The teachers who may be allocated a subject in a branch.
   *
   * Declared before the list route so the literal path wins over it.
   *
   * This is guarded by `teacher_allocations:read` — the permission the HOD
   * already holds to do the allocation — rather than by `users:read`. The
   * member list would expose every account in the college, which is more
   * than the HOD needs to allocate a subject and more than they are
   * entitled to.
   */
  @Get('assignable-teachers')
  @Permissions('teacher_allocations:read')
  @ApiOperation({ summary: 'List the teachers assignable in a branch' })
  @ApiQuery({ name: 'branchId', required: false })
  async findAssignableTeachers(
    @CurrentUser() user: JwtPayload,
    @Query('branchId') branchId?: string
  ) {
    const effectiveBranchIds = await this.scope.resolveBranchFilter(
      user.sub,
      parseOptionalString(branchId)
    );

    return this.service.findAssignableTeachers(effectiveBranchIds);
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
    const effectiveBranchIds = await this.scope.resolveBranchFilter(
      user.sub,
      parseOptionalString(branchId)
    );

    return this.service.findTeacherAllocations({
      branchIds: effectiveBranchIds,
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
  async delete(@Param('id') id: string, @CurrentUser() user: JwtPayload): Promise<void> {
    return this.service.deleteTeacherAllocation(id, user.sub);
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
    // The branch check itself lives in the service, so every code path that
    // assigns a class teacher is covered — not just this one.
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
    const effectiveBranchIds = await this.scope.resolveBranchFilter(
      user.sub,
      parseOptionalString(branchId)
    );

    return this.service.findClassTeacherAssignments({
      branchIds: effectiveBranchIds,
      semester: parseOptionalInt(semester),
      academicYearId: parseOptionalString(academicYearId),
      teacherId: parseOptionalString(teacherId),
    });
  }

  /**
   * The classes that have students but no class teacher.
   *
   * A separate route from the assignment list, because it answers a
   * different question. The assignment list says who *has* a class; this one
   * says which classes *do not*, and it is what keeps the gap visible after
   * a member is revoked.
   */
  @Get('needs-teacher')
  @Permissions('class_teacher_assignments:read')
  @ApiOperation({ summary: 'List the classes that have no class teacher' })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'semester', required: false })
  @ApiQuery({ name: 'academicYearId', required: false })
  async findNeedingTeacher(
    @CurrentUser() user: JwtPayload,
    @Query('branchId') branchId?: string,
    @Query('semester') semester?: string,
    @Query('academicYearId') academicYearId?: string
  ) {
    const effectiveBranchIds = await this.scope.resolveBranchFilter(
      user.sub,
      parseOptionalString(branchId)
    );

    return this.service.findClassesNeedingTeacher({
      branchIds: effectiveBranchIds,
      semester: parseOptionalInt(semester),
      academicYearId: parseOptionalString(academicYearId),
    });
  }

  @Delete(':id')
  @Permissions('class_teacher_assignments:write')
  @Audited(AuditResource.CLASS_TEACHER_ASSIGNMENT, AuditAction.DELETE, {
    resourceIdSource: 'param',
  })
  @ApiOperation({ summary: 'Remove a class-teacher assignment' })
  async delete(@Param('id') id: string, @CurrentUser() user: JwtPayload): Promise<void> {
    return this.service.deleteClassTeacherAssignment(id, user.sub);
  }
}
