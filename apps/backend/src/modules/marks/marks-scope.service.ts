import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { AuthorisationService } from '@/common/services/authorisation.service';

/**
 * Resolves what a caller may **read** in the marks module.
 *
 * The read rules differ from the write rules, and the difference is
 * deliberate:
 *
 *  - A **teacher** may read the marks of the subjects they were allocated,
 *    plus their own class's aggregate statistics. They may *not* read the
 *    whole branch's mark sheet — that is every student's every score, which
 *    is not theirs to see.
 *  - A **class teacher** may read their own class's aggregate statistics and
 *    class toppers — and only for the class they are assigned to.
 *  - An **HOD** may read their branch.
 *  - The **Principal**, **Super Admin** and **exam cell** may read their
 *    scope.
 *  - A **student** may read only their own marks, through the separate
 *    `marks:read_own` path. The general path is unreachable for them: they
 *    hold neither `marks:read` nor `marks:enter_own_subject`.
 *
 * Everything is derived from the authenticated caller. A caller-supplied
 * `subjectOfferingId` is a filter within the caller's authority, never a way
 * to reach outside it.
 */
@Injectable()
export class MarksScopeService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly authorisation: AuthorisationService
  ) {}

  /**
   * The scope for a mark listing.
   *
   * @returns The branch filter (a set of branches, or `undefined` for
   *   college-wide) and, for a teacher, the offering filter that narrows the
   *   listing to the subjects they were allocated.
   */
  async resolveMarkScope(
    userId: string,
    requested: {
      branchId?: string;
      academicYearId?: string;
      subjectOfferingId?: string;
    }
  ): Promise<{ branchId?: string | string[]; subjectOfferingId?: string | string[] }> {
    // The returned filter may be a set of branches (a member may hold a role
    // in more than one branch), so the repository accepts either shape.
    const permissions = await this.authorisation.permissionsOf(userId);

    // A student never reaches this path — but if they somehow did, they get
    // nothing rather than everything.
    if (permissions.includes('students:read_own') && !permissions.includes('marks:read')) {
      throw new ForbiddenException('You can only see your own marks, on the My Result screen.');
    }

    const branchId = await this.authorisation.resolveBranchFilter(userId, requested.branchId);

    /**
     * The exam cell and the roles that read the whole college see everything
     * in scope. A teacher does not: their listing is narrowed to the
     * subjects they were allocated.
     */
    const readsEverything =
      permissions.includes('marks:write') ||
      permissions.includes('analytics:read') ||
      permissions.includes('reports:read') ||
      permissions.includes('toppers:read');

    if (readsEverything) {
      return {
        branchId,
        subjectOfferingId: requested.subjectOfferingId,
      };
    }

    /**
     * A teacher. The allocation list is what bounds their view.
     *
     * It needs an academic year: an allocation is granted for one year, so
     * "the subjects I teach" is only meaningful within a year. When the
     * caller names no year, their allocations across **all** years are used,
     * so the listing is never wider than what they have ever been given.
     */
    const allocations = await this.prisma.teacherSubject.findMany({
      where: {
        teacherId: userId,
        ...(requested.academicYearId ? { academicYearId: requested.academicYearId } : {}),
      },
      select: { subjectOfferingId: true },
    });

    const allocatedIds = [...new Set(allocations.map((a) => a.subjectOfferingId))];

    // A teacher with no allocation at all sees nothing, rather than
    // everything.
    if (!allocatedIds.length) {
      return { branchId, subjectOfferingId: '__no_allocations__' };
    }

    // When the caller names a specific offering, it must be one of theirs.
    if (requested.subjectOfferingId) {
      if (!allocatedIds.includes(requested.subjectOfferingId)) {
        throw new ForbiddenException(
          'You are not allocated to that subject, so you cannot see its marks.'
        );
      }
      return { branchId, subjectOfferingId: requested.subjectOfferingId };
    }

    return { branchId, subjectOfferingId: allocatedIds };
  }

  /**
   * The scope for a class's aggregate statistics.
   *
   * A class teacher may see their own class. Anyone else who may read a
   * class's statistics needs a branch-wide reach — the HOD, the Principal,
   * the exam cell.
   */
  async assertMayReadClass(
    userId: string,
    context: {
      branchId: string;
      semester: number;
      schemeId: string;
      academicYearId: string;
    }
  ): Promise<void> {
    const permissions = await this.authorisation.permissionsOf(userId);

    // The branch scope is checked first: a class outside the caller's branch
    // is refused regardless of any other right they hold.
    await this.authorisation.assertBranchVisible(userId, context.branchId);

    const readsAnyClass =
      permissions.includes('marks:write') ||
      permissions.includes('analytics:read') ||
      permissions.includes('reports:read');

    if (readsAnyClass) return;

    // A teacher may see their own class, and only their own class.
    const isClassTeacher = await this.authorisation.isClassTeacherOf(userId, context);
    if (isClassTeacher) return;

    /**
     * A teacher who is not the class teacher may still read the statistics
     * of a class in which they teach an allocated subject — that is the
     * aggregate of the students whose marks they hold.
     */
    const teachesInClass = await this.prisma.teacherSubject.findFirst({
      where: {
        teacherId: userId,
        academicYearId: context.academicYearId,
        subjectOffering: {
          branchId: context.branchId,
          semester: context.semester,
          schemeId: context.schemeId,
        },
      },
      select: { id: true },
    });
    if (teachesInClass) return;

    throw new ForbiddenException(
      'You can only see the statistics of a class you teach or are the class teacher of.'
    );
  }

  /**
   * The scope for a single student's result.
   *
   * A teacher may calculate a student in a class they teach; the branch
   * scope covers everyone else.
   */
  async assertMayReadStudent(
    userId: string,
    studentId: string,
    academicYearId: string
  ): Promise<void> {
    const permissions = await this.authorisation.permissionsOf(userId);

    const branchId = await this.authorisation.branchOfStudent(studentId);
    if (!branchId) {
      throw new ForbiddenException('That student no longer exists.');
    }
    await this.authorisation.assertBranchVisible(userId, branchId);

    if (
      permissions.includes('marks:write') ||
      permissions.includes('analytics:read') ||
      permissions.includes('reports:read')
    ) {
      return;
    }

    // A teacher: allowed for a student in a class they teach, or for a
    // student whose marks they hold for an allocated subject.
    const teachesThem = await this.prisma.teacherSubject.findFirst({
      where: {
        teacherId: userId,
        academicYearId,
        subjectOffering: { branchId },
      },
      select: { id: true },
    });
    if (teachesThem) return;

    const classTeacher = await this.prisma.classTeacherAssignment.findFirst({
      where: {
        teacherId: userId,
        branchId,
        academicYearId,
      },
      select: { id: true },
    });
    if (classTeacher) return;

    throw new ForbiddenException('You can only see the results of students in a class you teach.');
  }

  /**
   * The scope for a single mark read.
   */
  async assertMayReadMark(userId: string, markId: string): Promise<void> {
    const permissions = await this.authorisation.permissionsOf(userId);

    const mark = await this.prisma.mark.findUnique({
      where: { id: markId },
      select: {
        subjectOfferingId: true,
        academicYearId: true,
        student: { select: { branchId: true } },
      },
    });
    if (!mark) {
      throw new ForbiddenException('That mark entry no longer exists.');
    }

    await this.authorisation.assertBranchVisible(userId, mark.student.branchId);

    if (
      permissions.includes('marks:write') ||
      permissions.includes('analytics:read') ||
      permissions.includes('reports:read')
    ) {
      return;
    }

    const allocated = await this.authorisation.isAllocated(
      userId,
      mark.subjectOfferingId,
      mark.academicYearId
    );
    if (allocated) return;

    throw new ForbiddenException(
      'You are not allocated to that subject, so you cannot see its marks.'
    );
  }
}
