import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Inject } from '@nestjs/common';
import { AuditService } from '@/common/services/audit.service';
import { AuditAction, AuditResource } from '@/common/decorators/audited.decorator';
import { CACHE_SERVICE } from '@/common/constants/injection-tokens';
import { CacheKeys } from '../cache/cache.constants';
import type { CacheService } from '@/common/interfaces/cache.service';

/**
 * The revocation lifecycle.
 *
 * Revoking a member is not "set a flag and stop". A revoked member who still
 * holds a subject allocation, still appears as a class teacher, and still has
 * a valid access token is a member who has not actually been revoked — and a
 * college that trusts the screen to reflect reality will be wrong about who
 * can see and change what.
 *
 * So a revocation does all of this, in one transaction:
 *
 *  1. marks the account inactive, so every authenticated request is refused;
 *  2. revokes every refresh token, so no session survives;
 *  3. withdraws every pending invitation for the member's address;
 *  4. releases every subject allocation — the marks the member entered are
 *     **kept**, and still name them as the author;
 *  5. releases every class teacher assignment — and the class is left visibly
 *     "class teacher required", because the college needs to know a class
 *     has lost its teacher;
 *  6. removes every role assignment, so the branch scope goes with it;
 *  7. records the whole thing in the audit trail.
 *
 * Nothing is hard-deleted. `Mark`, `AuditLog`, `Report` and `Invitation` all
 * reference members, and a hard delete would destroy the trail that makes a
 * result traceable.
 */
@Injectable()
export class MemberRevocationService {
  private readonly logger = new Logger(MemberRevocationService.name);

  constructor(
    private readonly prisma: PrismaClient,
    private readonly auditService: AuditService,
    @Inject(CACHE_SERVICE) private readonly cache: CacheService
  ) {}

  /**
   * Revokes a member's access.
   *
   * @param userId    The member being revoked.
   * @param revokedBy The administrator performing the revocation.
   * @param reason    Why. Recorded in the audit trail — a revocation without
   *   a reason cannot be explained to the member later.
   */
  async revoke(
    userId: string,
    revokedBy: string,
    reason: string
  ): Promise<{ releasedAllocations: number; releasedClassAssignments: number }> {
    const trimmedReason = reason?.trim();
    if (!trimmedReason) {
      throw new BadRequestException('Give a reason for revoking this member.');
    }

    const member = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        userRoles: { select: { role: { select: { name: true } } } },
        teacherSubjects: { select: { id: true, subjectOfferingId: true } },
        classTeacherAssignments: {
          select: {
            id: true,
            branch: { select: { name: true } },
            semester: true,
            scheme: { select: { name: true } },
            academicYear: { select: { year: true } },
          },
        },
        refreshTokens: { where: { revokedAt: null }, select: { id: true } },
      },
    });

    if (!member) {
      throw new BadRequestException('That member no longer exists.');
    }

    if (!member.isActive) {
      throw new BadRequestException(`${member.name} is already revoked.`);
    }

    /**
     * A member must never be able to revoke themselves — that would leave
     * the college with no administrator at all, and no way back in.
     */
    if (userId === revokedBy) {
      throw new BadRequestException('You cannot revoke your own account.');
    }

    const releasedAllocations = member.teacherSubjects.length;
    const releasedClassAssignments = member.classTeacherAssignments.length;

    /**
     * One transaction, so the member is never half-revoked. A failure part
     * way through leaves the member exactly as they were — which is safe —
     * rather than with their tokens dead but their allocations live.
     */
    await this.prisma.$transaction(async (tx) => {
      // 1. The account itself.
      await tx.user.update({
        where: { id: userId },
        data: { isActive: false, updatedBy: revokedBy },
      });

      // 2. Every session ends now, not when the token happens to expire.
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      // 3. Pending invitations are withdrawn, so a revoked member cannot
      //    re-activate themselves by accepting an invitation sent earlier.
      await tx.invite.updateMany({
        where: { email: member.email.toLowerCase(), status: 'PENDING' },
        data: { status: 'REVOKED' },
      });

      /**
       * 4. Subject allocations are released. The marks the member entered are
       *    NOT deleted — `Mark.createdBy` keeps pointing at them, so the
       *    history still shows who entered what.
       */
      await tx.teacherSubject.deleteMany({ where: { teacherId: userId } });

      /**
       * 5. Class teacher assignments are released. The class is left with no
       *    class teacher, which is visible: the class-overview and dashboard
       *    screens read the assignment table, and its absence is what they
       *    report. The college fills the gap deliberately.
       */
      await tx.classTeacherAssignment.deleteMany({ where: { teacherId: userId } });

      // 6. The roles go, and with them the branch scope.
      await tx.userRole.deleteMany({ where: { userId } });
    });

    /**
     * The cached permission set is orphaned by the global RBAC version bump,
     * so the next request re-reads from the database and sees the revoked
     * member's empty permission set.
     */
    await this.cache.incr(CacheKeys.rbacVersion);

    await this.auditService.record({
      userId: revokedBy,
      action: AuditAction.DEACTIVATE,
      resource: AuditResource.USER,
      resourceId: userId,
      details: {
        reason: trimmedReason,
        memberName: member.name,
        memberEmail: member.email,
        rolesReleased: member.userRoles.map((role) => role.role.name),
        subjectAllocationsReleased: releasedAllocations,
        classTeacherAssignmentsReleased: releasedClassAssignments,
        sessionsRevoked: member.refreshTokens.length,
      },
      requestContext: {},
    });

    this.logger.log(
      `Revoked ${member.name}: ${releasedAllocations} allocations and ` +
        `${releasedClassAssignments} class assignments released.`
    );

    return { releasedAllocations, releasedClassAssignments };
  }

  /**
   * Restores a revoked member.
   *
   * The account becomes usable again, but the allocations and roles are
   * **not** restored automatically: those were released deliberately, and
   * quietly handing them back would undo the administrator's decision
   * without them knowing. The screen says so and they are re-applied by
   * hand.
   */
  async restore(userId: string, restoredBy: string, reason: string): Promise<void> {
    const trimmedReason = reason?.trim();
    if (!trimmedReason) {
      throw new BadRequestException('Give a reason for restoring this member.');
    }

    const member = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, isActive: true },
    });
    if (!member) {
      throw new BadRequestException('That member no longer exists.');
    }
    if (member.isActive) {
      throw new BadRequestException(`${member.name} is already active.`);
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: true, updatedBy: restoredBy },
    });

    await this.cache.incr(CacheKeys.rbacVersion);

    await this.auditService.record({
      userId: restoredBy,
      action: AuditAction.UPDATE,
      resource: AuditResource.USER,
      resourceId: userId,
      details: { reason: trimmedReason, memberName: member.name, restored: true },
      requestContext: {},
    });
  }
}
