/**
 * The tests for the branch scope.
 *
 * The scope is the second half of authorisation: the permission says *what*
 * a member may do, and the scope says *which records* they may do it to.
 * The scope is the half that leaks.
 *
 * Every test here is about a way a member could see something that is not
 * theirs. The shape of them is the same: a member holds role assignments
 * that name the branches they belong to, and a read must never return a
 * record outside that set.
 *
 * The distinction that these tests exist to protect is between the two
 * resolvers:
 *
 *  - {@link ScopeService.resolveBranchScope} returns **one** branch id, and
 *    is right for a write that acts on a single record;
 *  - {@link ScopeService.resolveBranchFilter} returns a **set**, and is the
 *    only one that is safe for a list read.
 *
 * A list read that uses the single-id resolver drops the filter entirely
 * when the caller names no branch — which is the common case, because the
 * screen opens on "everything I can see" rather than on one branch. That
 * failure is silent: the request succeeds and returns too much.
 */

import { ForbiddenException } from '@nestjs/common';
import { ScopeService } from './scope.service';

/**
 * A stand-in for the database that answers with a fixed set of branches.
 *
 * The scope is derived from the user's role assignments, so the only thing
 * the service asks the database for is that list. The mock mirrors the
 * shape the service actually calls: `prisma.userRole.findMany`.
 */
function prismaWithBranches(branches: Array<string | null>): {
  userRole: { findMany: jest.Mock };
} {
  return {
    userRole: {
      findMany: jest.fn().mockResolvedValue(branches.map((branchId) => ({ branchId }))),
    },
  };
}

describe('the branch scope', () => {
  describe('for a member scoped to one branch', () => {
    it('narrows a read to that branch even when the caller names none', async () => {
      const scope = new ScopeService(prismaWithBranches(['branch-a']) as never);

      await expect(scope.resolveBranchFilter('user-1')).resolves.toEqual(['branch-a']);
    });

    it('refuses a read that names a branch the member does not hold', async () => {
      const scope = new ScopeService(prismaWithBranches(['branch-a']) as never);

      await expect(scope.resolveBranchFilter('user-1', 'branch-b')).rejects.toBeInstanceOf(
        ForbiddenException
      );
    });

    it('keeps the member on their own branch when they ask for it', async () => {
      const scope = new ScopeService(prismaWithBranches(['branch-a']) as never);

      await expect(scope.resolveBranchFilter('user-1', 'branch-a')).resolves.toEqual(['branch-a']);
    });
  });

  describe('for a member scoped to several branches', () => {
    const branches = ['branch-a', 'branch-b'];

    it('narrows a read to every branch the member holds, not to none of them', async () => {
      const scope = new ScopeService(prismaWithBranches(branches) as never);

      /**
       * This is the case the single-id resolver gets wrong. It cannot
       * express a set, so it answers "no filter" — and the member sees the
       * whole college.
       */
      await expect(scope.resolveBranchFilter('user-1')).resolves.toEqual(branches);
    });

    it('narrows a read to the one branch the member named', async () => {
      const scope = new ScopeService(prismaWithBranches(branches) as never);

      await expect(scope.resolveBranchFilter('user-1', 'branch-b')).resolves.toEqual(['branch-b']);
    });

    it('refuses a read that names a third branch', async () => {
      const scope = new ScopeService(prismaWithBranches(branches) as never);

      await expect(scope.resolveBranchFilter('user-1', 'branch-c')).rejects.toBeInstanceOf(
        ForbiddenException
      );
    });
  });

  describe('for a college-wide member', () => {
    it('applies no branch filter at all', async () => {
      const scope = new ScopeService(prismaWithBranches([null]) as never);

      await expect(scope.resolveBranchFilter('admin')).resolves.toBeUndefined();
    });

    it('may narrow the read to a branch it names', async () => {
      const scope = new ScopeService(prismaWithBranches([null]) as never);

      await expect(scope.resolveBranchFilter('admin', 'branch-a')).resolves.toEqual(['branch-a']);
    });
  });

  describe('the branches themselves', () => {
    it('counts a branch once however many roles name it', async () => {
      const scope = new ScopeService(prismaWithBranches(['branch-a', 'branch-a']) as never);

      await expect(scope.branchScope('user-1')).resolves.toEqual(['branch-a']);
    });

    it('ignores a role assignment that names no branch', async () => {
      const scope = new ScopeService(prismaWithBranches([null, 'branch-a']) as never);

      await expect(scope.branchScope('user-1')).resolves.toEqual(['branch-a']);
    });
  });

  describe('the single-branch resolver, which is for writes and single records', () => {
    it("answers with the member's own branch", async () => {
      const scope = new ScopeService(prismaWithBranches(['branch-a']) as never);

      await expect(scope.resolveBranchScope('user-1')).resolves.toBe('branch-a');
    });

    it('cannot express a member who holds several branches', async () => {
      const scope = new ScopeService(prismaWithBranches(['branch-a', 'branch-b']) as never);

      /**
       * This is why the list reads use the other resolver. With no branch
       * named, the single-id resolver has nothing to return and answers
       * "no filter" — which for a list read means "everything".
       */
      await expect(scope.resolveBranchScope('user-1')).resolves.toBeUndefined();
    });
  });
});
