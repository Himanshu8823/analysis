import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type { UserRole as UserRoleRow } from '@prisma/client';
import { AssignRoleDto } from './dto';
import { BRANCH_SCOPED_ROLES, canGrantRole } from '@/common/constants/roles';
import type { UserRole as UserRoleName } from '@result-analysis/shared-types';

@Injectable()
export class UserRolesRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * The role names a member holds.
   *
   * This is read fresh from the database rather than from the caller's
   * token, because the token carries a single role while a member may hold
   * several at once. The union of those roles is what decides what they may
   * grant.
   */
  private async rolesHeldBy(userId: string): Promise<string[]> {
    const assignments = await this.prisma.userRole.findMany({
      where: { userId },
      select: { role: { select: { name: true } } },
    });

    return assignments.map((assignment) => assignment.role.name);
  }

  /**
   * Grants a role to a user, optionally scoped to a branch.
   *
   * Idempotent: re-assigning an existing role updates `grantedBy`/`grantedAt`
   * instead of creating a duplicate row.
   *
   * This is a find-then-write rather than an `upsert` because the compound
   * unique `(userId, roleId, branchId)` contains a nullable column, and
   * Prisma cannot address a NULL inside a compound unique selector.
   */
  async assign(dto: AssignRoleDto, grantedBy: string): Promise<UserRoleRow> {
    const role = await this.prisma.role.findUnique({ where: { name: dto.roleName } });
    if (!role) {
      throw new NotFoundException(`The role "${dto.roleName}" does not exist.`);
    }

    /**
     * The member must exist and be active. A role granted to a revoked
     * account is a role nobody can use — and it would come back to life
     * silently if the account were restored.
     */
    const member = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: { id: true, isActive: true, name: true },
    });
    if (!member) {
      throw new NotFoundException('That member no longer exists.');
    }
    if (!member.isActive) {
      throw new BadRequestException(
        `${member.name}'s access has been revoked. Restore the account before assigning a role.`
      );
    }

    /**
     * `SUPER_ADMIN` cannot be granted through this flow.
     *
     * The Super Admin must not be able to mint a second Super Admin through
     * the ordinary role-assignment screen — the same reason it is excluded
     * from the invitation flow.
     */
    if (dto.roleName === 'SUPER_ADMIN') {
      throw new BadRequestException(
        'The Super Admin role cannot be assigned here. It is set by the system administrator only.'
      );
    }

    /**
     * A member may grant only the authority they hold themselves.
     *
     * Without this, anybody who can open the role screen could appoint a
     * Principal — or an Admin — and from there reach every branch of the
     * college. The grantor's roles are read from the database, not from the
     * token, because the token carries one role and a member may hold
     * several.
     */
    const heldRoles = await this.rolesHeldBy(grantedBy);
    if (!canGrantRole(heldRoles, dto.roleName)) {
      throw new ForbiddenException(
        `You cannot assign the ${dto.roleName} role. You can only assign roles below your own.`
      );
    }

    /**
     * A branch-scoped member may not appoint someone into another branch.
     *
     * A Teacher who works in Computer Science must not be able to appoint
     * a Principal in Mechanical Engineering — that is authority over a
     * branch the teacher does not belong to, and it is how a college's
     * branch boundaries quietly stop meaning anything.
     */
    if (dto.branchId) {
      const grantorBranches = await this.prisma.userRole.findMany({
        where: { userId: grantedBy, branchId: { not: null } },
        select: { branchId: true },
      });
      const grantorBranchIds = grantorBranches
        .map((assignment) => assignment.branchId)
        .filter((id): id is string => typeof id === 'string');

      /**
       * A college-wide member — one whose assignments all name no branch —
       * may appoint into any branch.
       */
      if (grantorBranchIds.length > 0 && !grantorBranchIds.includes(dto.branchId)) {
        throw new ForbiddenException('You cannot assign a role in a branch you do not work in.');
      }
    }

    /**
     * A branch-scoped role needs a branch, and a college-wide role must not
     * carry one. A branch-scoped role with no branch would silently become
     * college-wide — the member would see every branch's students.
     */
    if (BRANCH_SCOPED_ROLES.includes(dto.roleName as UserRoleName) && !dto.branchId) {
      throw new BadRequestException(
        `The ${dto.roleName} role is tied to a branch. Choose the branch this member will work in.`
      );
    }
    if (!BRANCH_SCOPED_ROLES.includes(dto.roleName as UserRoleName) && dto.branchId) {
      throw new BadRequestException(
        `The ${dto.roleName} role applies to the whole college, so it cannot be limited to one branch.`
      );
    }

    if (dto.branchId) {
      const branch = await this.prisma.branch.findUnique({
        where: { id: dto.branchId },
        select: { id: true, isActive: true, name: true },
      });
      if (!branch) {
        throw new NotFoundException('That branch does not exist.');
      }
      if (!branch.isActive) {
        throw new BadRequestException(
          `The branch "${branch.name}" is not active, so it cannot be assigned.`
        );
      }
    }

    const existing = await this.prisma.userRole.findFirst({
      where: {
        userId: dto.userId,
        roleId: role.id,
        branchId: dto.branchId ?? null,
      },
    });

    if (existing) {
      return this.prisma.userRole.update({
        where: { id: existing.id },
        data: { grantedBy, grantedAt: new Date() },
      });
    }

    return this.prisma.userRole.create({
      data: {
        userId: dto.userId,
        roleId: role.id,
        branchId: dto.branchId ?? null,
        grantedBy,
      },
    });
  }

  /**
   * Takes a role back from a member.
   *
   * The role is removed only in the scope it was granted in: revoking a
   * member's HOD role in Computer Science leaves their Teacher role in
   * Mechanical Engineering alone.
   *
   * A member may take back only the authority they hold themselves — for
   * the same reason they may not hand it out in the first place. Without
   * that rule, a Principal could strip an Admin's role, and a Teacher
   * could strip a Principal's.
   */
  async revoke(
    userId: string,
    roleName: string,
    branchId?: string,
    revokedBy?: string
  ): Promise<number> {
    const role = await this.prisma.role.findUnique({ where: { name: roleName } });
    if (!role) return 0;

    if (revokedBy) {
      const heldRoles = await this.rolesHeldBy(revokedBy);
      if (!canGrantRole(heldRoles, roleName)) {
        throw new ForbiddenException(
          `You cannot take back the ${roleName} role. You can only manage roles below your own.`
        );
      }
    }

    const result = await this.prisma.userRole.deleteMany({
      where: {
        userId,
        roleId: role.id,
        ...(branchId ? { branchId } : { branchId: null }),
      },
    });
    return result.count;
  }

  async findByUser(userId: string) {
    return this.prisma.userRole.findMany({
      where: { userId },
      include: {
        role: { select: { id: true, name: true, description: true } },
        branch: { select: { id: true, code: true, name: true } },
      },
      orderBy: { grantedAt: 'desc' },
    });
  }
}
