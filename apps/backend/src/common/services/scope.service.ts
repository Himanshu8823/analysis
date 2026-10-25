import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Resolves the branch a user is allowed to see.
 *
 * The scope is derived from the user's `UserRole` rows, not from the JWT.
 * A person can hold several roles at once — an HOD who also teaches, say —
 * and the union of those roles decides what they may see. The JWT carries a
 * single role, so it cannot express that union and would silently drop the
 * other assignments.
 *
 * The rules are:
 *
 *  - a user with at least one role assignment carrying a `branchId` is
 *    BRANCH-scoped: every read must be filtered to those branches;
 *  - a user whose role assignments all have a `branchId` of `null` is
 *    COLLEGE-scoped: no branch filter is applied.
 *
 * A branch-scoped user may hold several branches (one `UserRole` row per
 * branch). The scope is then the set of those branches, and a read without a
 * branch filter still has to be narrowed to that set — otherwise the user
 * would see branches that are not theirs.
 */
@Injectable()
export class ScopeService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * The branches a user is scoped to.
   *
   * An empty array means college-wide: the user has no branch-scoped role
   * assignment, so no branch filter may be applied to their reads.
   */
  async branchScope(userId: string): Promise<string[]> {
    const assignments = await this.prisma.userRole.findMany({
      where: { userId },
      select: { branchId: true },
    });

    const branches = assignments
      .map((a) => a.branchId)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);

    return [...new Set(branches)];
  }

  /**
   * Resolves the effective branch filter for a read query.
   *
   *  - returns `undefined` when the user is college-scoped (no filter);
   *  - returns the branch id when the user is scoped to exactly one branch;
   *  - throws {@link ForbiddenException} when the user is scoped to a branch
   *    that does not match the requested `branchId`.
   *
   * A branch-scoped user asking for a branch they do not own is rejected
   * rather than silently redirected. Rejection makes the mismatch visible to
   * the caller; overriding would hide a bug in the client and produce a
   * result set the caller did not ask for.
   *
   * A user scoped to several branches passes a requested branch through
   * unchanged — it has already been checked against the scope. Callers that
   * must also handle the "no branch requested" case for such a user should
   * use {@link resolveBranchFilter}, which returns the whole set.
   */
  async resolveBranchScope(
    userId: string,
    requestedBranchId?: string
  ): Promise<string | undefined> {
    const scope = await this.branchScope(userId);

    // College-scoped: the caller may narrow to any branch, or none at all.
    if (scope.length === 0) return requestedBranchId;

    // A request for a branch outside the user's scope is refused.
    if (requestedBranchId && !scope.includes(requestedBranchId)) {
      throw new ForbiddenException('You do not have access to the requested branch');
    }

    // Scoped to a single branch: that branch wins, whatever the caller asked.
    if (scope.length === 1) return scope[0];

    // Scoped to several branches: the caller's branch is already validated
    // above and is inside the scope, so it may be used as the filter.
    return requestedBranchId;
  }

  /**
   * The full set of branches a read may cover.
   *
   *  - `undefined` means college-wide — no filter at all;
   *  - a one-element array means the read is narrowed to that branch;
   *  - a longer array means the read is narrowed to that set of branches.
   *
   * This is the form to use whenever the read has to be safe even when the
   * caller named no branch: a user scoped to two branches must still not see
   * a third one. {@link resolveBranchScope} cannot express that, because it
   * returns a single id.
   */
  async resolveBranchFilter(
    userId: string,
    requestedBranchId?: string
  ): Promise<string[] | undefined> {
    const scope = await this.branchScope(userId);

    // College-scoped: no branch filter at all.
    if (scope.length === 0) return undefined;

    // A request for a branch outside the user's scope is refused.
    if (requestedBranchId && !scope.includes(requestedBranchId)) {
      throw new ForbiddenException('You do not have access to the requested branch');
    }

    // Scoped to one branch: that branch wins, whatever the caller asked.
    if (scope.length === 1) return scope;

    // Scoped to several branches: the caller's branch is inside the scope,
    // so it narrows the set; without one the whole set applies.
    return requestedBranchId ? [requestedBranchId] : scope;
  }
}
