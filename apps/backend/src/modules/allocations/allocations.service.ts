import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import {
  AllocationsRepository,
  type TeacherAllocationRow,
  type ClassTeacherAssignmentRow,
  type ClassNeedingTeacherRow,
  type AssignableTeacher,
} from './allocations.repository';
import { CreateTeacherAllocationDto, CreateClassTeacherAssignmentDto } from './dto';
import { AuthorisationService } from '@/common/services/authorisation.service';

@Injectable()
export class AllocationsService {
  constructor(
    private readonly repository: AllocationsRepository,
    private readonly prisma: PrismaClient,
    private readonly authorisation: AuthorisationService
  ) {}

  // ---------------------------------------------------------------------
  // Teacher allocations — "this teacher teaches this subject offering"
  // ---------------------------------------------------------------------

  /**
   * The teachers who may be allocated a subject in a branch.
   *
   * This is deliberately not the member list. The member list carries the
   * whole college's people — every account, with its roles — and is guarded
   * by `users:read`, which the HOD does not hold. The HOD needs only the
   * teachers of their own branch, so they get exactly that.
   *
   * `branchIds` is the caller's whole scope, not one branch of it. A caller
   * scoped to several branches sees the teachers of all of them.
   */
  async findAssignableTeachers(branchIds?: string[]): Promise<AssignableTeacher[]> {
    return this.repository.findAssignableTeachers(branchIds);
  }

  async findTeacherAllocations(params: {
    branchIds?: string[];
    semester?: number;
    academicYearId?: string;
    teacherId?: string;
    subjectOfferingId?: string;
  }): Promise<TeacherAllocationRow[]> {
    return this.repository.findTeacherAllocations(params);
  }

  /**
   * Allocates a subject offering to a teacher.
   *
   * Four things are checked before the write:
   *  - the caller may write in the offering's branch,
   *  - the teacher exists and is active,
   *  - the offering exists and is active,
   *  - the pair has not already been allocated for that year.
   *
   * The offering must belong to the same branch as the teacher. A teacher of
   * one branch cannot be allocated a subject from another — that is what
   * makes the HOD's branch scope meaningful.
   */
  async createTeacherAllocation(
    dto: CreateTeacherAllocationDto,
    allocatedBy: string
  ): Promise<TeacherAllocationRow> {
    const teacher = await this.prisma.user.findUnique({
      where: { id: dto.teacherId },
      select: { id: true, isActive: true, name: true, email: true },
    });
    if (!teacher) throw new NotFoundException('Teacher not found');
    if (!teacher.isActive) {
      throw new BadRequestStateException('This teacher account is deactivated');
    }

    const offering = await this.prisma.subjectOffering.findUnique({
      where: { id: dto.subjectOfferingId },
      select: { id: true, branchId: true, isActive: true },
    });
    if (!offering) throw new NotFoundException('Subject offering not found');
    if (!offering.isActive) {
      throw new BadRequestStateException('This subject offering is no longer active');
    }

    /**
     * The branch is the offering's, not the caller's — it decides whose
     * students the teacher may mark. The caller must be allowed to allocate
     * in it, so an HOD of one branch cannot hand a subject of another branch
     * to one of their own teachers.
     */
    await this.authorisation.assertBranchWritable(
      allocatedBy,
      offering.branchId,
      'subject offering'
    );

    const duplicate = await this.prisma.teacherSubject.findFirst({
      where: {
        teacherId: dto.teacherId,
        subjectOfferingId: dto.subjectOfferingId,
        academicYearId: dto.academicYearId,
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException(
        'This teacher is already allocated to that subject for this year'
      );
    }

    await this.repository.createTeacherAllocation(dto);

    const rows = await this.repository.findTeacherAllocations({
      subjectOfferingId: dto.subjectOfferingId,
      teacherId: dto.teacherId,
      academicYearId: dto.academicYearId,
    });
    const created = rows[0];
    if (!created) {
      throw new NotFoundException('Allocation could not be read back');
    }
    return created;
  }

  /**
   * Removes a teacher allocation.
   *
   * The allocation's branch is resolved from the offering it points at, and
   * the caller must be allowed to write in it. Without this check an HOD of
   * one branch could remove another branch's allocation and strip that
   * branch's teacher of the right to enter marks.
   */
  async deleteTeacherAllocation(id: string, deletedBy: string): Promise<void> {
    const existing = await this.repository.findTeacherAllocationById(id);
    if (!existing) throw new NotFoundException('Teacher allocation not found');

    const offering = await this.prisma.subjectOffering.findUnique({
      where: { id: existing.subjectOfferingId },
      select: { branchId: true },
    });
    await this.authorisation.assertBranchWritable(
      deletedBy,
      offering?.branchId,
      'subject allocation'
    );

    await this.repository.deleteTeacherAllocation(id);
  }

  // ---------------------------------------------------------------------
  // Class teacher assignments — "this teacher is the class teacher"
  // ---------------------------------------------------------------------

  async findClassTeacherAssignments(params: {
    branchIds?: string[];
    semester?: number;
    academicYearId?: string;
    teacherId?: string;
  }): Promise<ClassTeacherAssignmentRow[]> {
    return this.repository.findClassTeacherAssignments(params);
  }

  /**
   * The classes that have students but no class teacher.
   *
   * This is the "class teacher required" state. When a member is revoked and
   * they were the class teacher of a class, the class loses its teacher —
   * and the college has to see that gap, or the class quietly goes
   * unmanaged. The revocation screen shows the consequence before the
   * administrator confirms; this list is where they go afterwards to fix it.
   */
  async findClassesNeedingTeacher(params: {
    branchIds?: string[];
    semester?: number;
    academicYearId?: string;
  }): Promise<ClassNeedingTeacherRow[]> {
    return this.repository.findClassesNeedingTeacher(params);
  }

  /**
   * Assigns the class teacher for a class.
   *
   * A class has exactly one class teacher. Posting for a class that already
   * has one *replaces* it rather than failing, so the caller never has to do
   * a delete-then-create dance — which would leave the class with no teacher
   * if the second step failed.
   */
  async createClassTeacherAssignment(
    dto: CreateClassTeacherAssignmentDto,
    assignedBy: string
  ): Promise<ClassTeacherAssignmentRow> {
    const teacher = await this.prisma.user.findUnique({
      where: { id: dto.teacherId },
      select: { id: true, isActive: true },
    });
    if (!teacher) throw new NotFoundException('Teacher not found');
    if (!teacher.isActive) {
      throw new BadRequestStateException('This teacher account is deactivated');
    }

    /**
     * The class belongs to a branch, and only that branch's HOD may put a
     * class teacher in it. The class-teacher role is what opens the class's
     * statistics, so assigning one in another branch is a real escalation.
     */
    await this.authorisation.assertBranchWritable(assignedBy, dto.branchId, 'class');

    const existing = await this.prisma.classTeacherAssignment.findFirst({
      where: {
        branchId: dto.branchId,
        semester: dto.semester,
        schemeId: dto.schemeId,
        academicYearId: dto.academicYearId,
      },
      select: { id: true, teacherId: true, teacher: { select: { name: true } } },
    });

    if (existing) {
      /**
       * A class has exactly one class teacher. Assigning another is a
       * **replacement**, and the previous teacher's access to the class's
       * statistics ends with it.
       *
       * The request must say that the replacement is intended. Without that,
       * assigning a class teacher to a class that already has one is an
       * accidental overwrite — and an accidental overwrite silently takes
       * away somebody's access to a class.
       */
      if (!dto.replacesExisting) {
        throw new ConflictException(
          `${existing.teacher.name} is already the class teacher of this class. ` +
            'Replacing them ends their access to this class’s statistics. Confirm the ' +
            'replacement to go ahead.'
        );
      }

      /**
       * Replacing a class teacher with the same person is not a change.
       * It is refused so that the audit trail never records a replacement
       * that did not happen.
       */
      if (existing.teacherId === dto.teacherId) {
        throw new ConflictException(
          `${existing.teacher.name} is already the class teacher of this class.`
        );
      }

      await this.prisma.classTeacherAssignment.update({
        where: { id: existing.id },
        data: { teacherId: dto.teacherId, assignedBy, assignedAt: new Date() },
      });
    } else {
      await this.repository.createClassTeacherAssignment({ ...dto, assignedBy });
    }

    const rows = await this.repository.findClassTeacherAssignments({
      branchIds: [dto.branchId],
      semester: dto.semester,
      academicYearId: dto.academicYearId,
      teacherId: dto.teacherId,
    });
    const created = rows.find((r) => r.schemeId === dto.schemeId);
    if (!created) {
      throw new NotFoundException('Assignment could not be read back');
    }
    return created;
  }

  /**
   * Removes a class-teacher assignment.
   *
   * The caller must be allowed to write in the branch the class belongs to.
   */
  async deleteClassTeacherAssignment(id: string, deletedBy: string): Promise<void> {
    const existing = await this.repository.findClassTeacherAssignmentById(id);
    if (!existing) throw new NotFoundException('Class teacher assignment not found');

    await this.authorisation.assertBranchWritable(deletedBy, existing.branchId, 'class');

    await this.repository.deleteClassTeacherAssignment(id);
  }
}

/**
 * A bad state on an existing record — the record is there but cannot be used
 * (a deactivated teacher, a retired offering).
 *
 * `BadRequestException` is used rather than `ConflictException` because the
 * conflict is with the record's own state, not with another request.
 */
class BadRequestStateException extends ForbiddenException {}
