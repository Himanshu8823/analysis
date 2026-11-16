import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PermissionsCacheRepository } from '@/modules/rbac/permissions-cache.repository';
import { ScopeService } from './scope.service';

/**
 * The authorisation spine.
 *
 * Every authorisation decision in the system is made here, in the **service**
 * layer — not only in a controller decorator. A decorator alone is bypassable
 * by any code path that calls the service directly: a background job, a queue
 * processor, a future controller. The rules this service encodes are the ones
 * a controller decorator cannot express anyway — "only for the subjects you
 * were allocated", "only for your own class", "only within your branch".
 *
 * The three ideas it separates:
 *
 *  1. **Permission** — may this member perform this *kind* of operation?
 *  2. **Scope** — which *records* may they perform it on?
 *  3. **Ownership/allocation** — is this specific record theirs to act on?
 *
 * All three are answered from the authenticated caller. A caller-supplied
 * parameter is a *filter*, never a *grant*.
 */
@Injectable()
export class AuthorisationService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly scope: ScopeService,
    private readonly permissionsRepository: PermissionsCacheRepository
  ) {}

  // ---------------------------------------------------------------------
  // Permissions
  // ---------------------------------------------------------------------

  /**
   * The caller's effective permissions — the union of every role they hold.
   *
   * Read through the cache repository so it uses exactly the same
   * cache-and-fallback path as the guard. Two sources of truth for a
   * member's permissions is how a frontend and a backend end up disagreeing.
   */
  async permissionsOf(userId: string): Promise<string[]> {
    return this.permissionsRepository.getPermissionsForUser(userId);
  }

  /** Whether the caller holds a permission. */
  async has(userId: string, permission: string): Promise<boolean> {
    const permissions = await this.permissionsOf(userId);
    return permissions.includes(permission);
  }

  /**
   * Asserts the caller holds at least one of the permissions.
   *
   * The refusal message names what the member would need, in the language of
   * the college, and says who can grant it — not "Insufficient permissions".
   */
  async assertAnyPermission(userId: string, permissions: string[]): Promise<void> {
    const held = await this.permissionsOf(userId);
    if (permissions.some((permission) => held.includes(permission))) return;
    throw new ForbiddenException(
      'You do not have access to this. Ask the college administrator if you need it.'
    );
  }

  // ---------------------------------------------------------------------
  // Branch scope
  // ---------------------------------------------------------------------

  /**
   * The branches the caller may see.
   *
   * An empty array means college-wide: the member holds no branch-scoped role,
   * so no branch filter applies to their reads.
   */
  async branchScope(userId: string): Promise<string[]> {
    return this.scope.branchScope(userId);
  }

  /**
   * The effective branch filter for a read.
   *
   * `undefined` means college-wide. A request for a branch outside the
   * caller's scope is refused rather than silently redirected — overriding
   * would hide a client bug and return a result set nobody asked for.
   */
  async resolveBranchFilter(
    userId: string,
    requestedBranchId?: string
  ): Promise<string[] | undefined> {
    return this.scope.resolveBranchFilter(userId, requestedBranchId);
  }

  /**
   * The effective single branch for a read or write.
   *
   * `undefined` means the caller is college-scoped and may narrow to the
   * branch they named.
   */
  async resolveBranchScope(
    userId: string,
    requestedBranchId?: string
  ): Promise<string | undefined> {
    return this.scope.resolveBranchScope(userId, requestedBranchId);
  }

  /**
   * Refuses a write that names a branch outside the caller's scope.
   *
   * Unlike {@link resolveBranchScope}, a college-scoped caller is *not*
   * allowed through here: writing a student into another branch is a
   * different act from reading one, and the exam cell's reach is bounded by
   * the class it is working on.
   *
   * @param label What the record is, for the refusal message — "student",
   *   "subject offering" and so on.
   */
  async assertBranchWritable(
    userId: string,
    branchId: string | undefined,
    label: string
  ): Promise<void> {
    if (!branchId) {
      throw new BadBranchException(`No branch was supplied for this ${label}.`);
    }
    const scope = await this.scope.branchScope(userId);
    if (scope.length === 0) return; // college-scoped: the exam cell's reach
    if (scope.includes(branchId)) return;
    throw new ForbiddenException(
      `This ${label} belongs to another branch, so you cannot change it.`
    );
  }

  // ---------------------------------------------------------------------
  // Subject allocation — "may this member write marks for this subject?"
  // ---------------------------------------------------------------------

  /**
   * The subject offerings the teacher is allocated to, for one academic year.
   *
   * This is the single source of the "own subject" boundary. Every mark write
   * path resolves the caller's allocations through here.
   */
  async allocatedOfferingIds(teacherId: string, academicYearId: string): Promise<string[]> {
    const rows = await this.prisma.teacherSubject.findMany({
      where: { teacherId, academicYearId },
      select: { subjectOfferingId: true },
    });
    return rows.map((row) => row.subjectOfferingId);
  }

  /**
   * Whether the teacher is allocated to the offering for that academic year.
   */
  async isAllocated(
    teacherId: string,
    subjectOfferingId: string,
    academicYearId: string
  ): Promise<boolean> {
    const allocation = await this.prisma.teacherSubject.findFirst({
      where: { teacherId, subjectOfferingId, academicYearId },
      select: { id: true },
    });
    return allocation !== null;
  }

  /**
   * The teacher who currently holds the allocation for an offering.
   *
   * Used by the exam-cell rule: the exam cell may write any offering in
   * scope, but not one a teacher holds, unless it is an explicit, audited
   * correction.
   */
  async allocatedTeacher(
    subjectOfferingId: string,
    academicYearId: string
  ): Promise<{ id: string; name: string } | null> {
    const row = await this.prisma.teacherSubject.findFirst({
      where: { subjectOfferingId, academicYearId },
      select: { teacher: { select: { id: true, name: true } } },
      orderBy: { id: 'asc' },
    });
    return row?.teacher ?? null;
  }

  // ---------------------------------------------------------------------
  // Class teacher — "is this member the class teacher of that class?"
  // ---------------------------------------------------------------------

  /**
   * The classes the member is the class teacher of.
   *
   * The unique constraint on (branch, semester, scheme, academic year) makes
   * this exactly one class per context.
   */
  async classesTaughtBy(userId: string): Promise<
    Array<{
      id: string;
      branchId: string;
      semester: number;
      schemeId: string;
      academicYearId: string;
    }>
  > {
    return this.prisma.classTeacherAssignment.findMany({
      where: { teacherId: userId },
      select: {
        id: true,
        branchId: true,
        semester: true,
        schemeId: true,
        academicYearId: true,
      },
    });
  }

  /**
   * Whether the member is the class teacher of the given class context.
   */
  async isClassTeacherOf(
    userId: string,
    context: { branchId: string; semester: number; schemeId: string; academicYearId: string }
  ): Promise<boolean> {
    const assignment = await this.prisma.classTeacherAssignment.findFirst({
      where: {
        teacherId: userId,
        branchId: context.branchId,
        semester: context.semester,
        schemeId: context.schemeId,
        academicYearId: context.academicYearId,
      },
      select: { id: true },
    });
    return assignment !== null;
  }

  // ---------------------------------------------------------------------
  // Record-level helpers
  // ---------------------------------------------------------------------

  /**
   * The branch a student belongs to, or `null` when the student does not
   * exist.
   */
  async branchOfStudent(studentId: string): Promise<string | null> {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { branchId: true },
    });
    return student?.branchId ?? null;
  }

  /**
   * Refuses the read when the record's branch is outside the caller's scope.
   */
  async assertBranchVisible(userId: string, recordBranchId: string): Promise<void> {
    await this.scope.resolveBranchScope(userId, recordBranchId);
  }

  /**
   * Refuses a read of a record that does not exist.
   *
   * A missing record and a forbidden one must not be confused: a 404 for a
   * record the caller may not see would confirm it exists.
   */
  async assertExists<T>(record: T | null, message: string): Promise<T> {
    if (!record) throw new NotFoundException(message);
    return record;
  }
}

/**
 * A bad branch on a write.
 *
 * `BadRequestException` rather than `ForbiddenException`: the request itself
 * is malformed — it names no branch — rather than the member reaching for
 * something they may not touch.
 */
class BadBranchException extends ForbiddenException {}
