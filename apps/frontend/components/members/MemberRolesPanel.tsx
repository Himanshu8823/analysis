'use client';

import { useMemo, useState } from 'react';
import { ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import {
  BRANCH_SCOPED_ROLES,
  grantableRoles,
  type UserRole,
} from '@result-analysis/shared-types';

import { Button } from '@/components/ui/button';
import { Select } from '@/components/forms/Select';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { Spinner } from '@/components/feedback/Spinner';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useAssignRole, useRevokeRole, useUserRoles } from '@/hooks/useUserRoles';
import { useBranches } from '@/hooks/useBranches';
import { useCurrentUser } from '@/hooks/useAuth';
import { roleDisplayName } from '@/lib/utils/role-labels';

interface MemberRolesPanelProps {
  /** The member whose roles are being managed. */
  memberId: string;
  /** The member's name, for the sentences in the dialogs. */
  memberName: string;
}

/**
 * MemberRolesPanel — the role screen for one member.
 *
 * A role is how a person gains authority over students, marks and results,
 * so handing one out and taking one back are both treated as deliberate
 * acts: the screen says who is affected, what the change means, and what the
 * member will be able to do afterwards.
 *
 * Two rules shape what appears here:
 *
 *  - a member may only hand out a role **below their own**. The list of
 *    choices is narrowed to those, so the screen never offers something the
 *    server would refuse;
 *  - a branch-scoped role (Head of Department, Principal, Teacher) is tied to
 *    one branch. It cannot be granted without one, and taking it back in one
 *    branch leaves the member's roles in the others alone.
 */
export function MemberRolesPanel({ memberId, memberName }: MemberRolesPanelProps) {
  const { data: currentUser } = useCurrentUser();
  const rolesQuery = useUserRoles(memberId);
  const branchesQuery = useBranches();

  const [assignOpen, setAssignOpen] = useState(false);
  const [roleToRemove, setRoleToRemove] = useState<{
    roleName: string;
    branchId: string | null;
  } | null>(null);

  const held = rolesQuery.data ?? [];
  const branches = branchesQuery.data ?? [];

  /**
   * The roles the signed-in member may hand out.
   *
   * A member who holds several roles is judged by the strongest of them, so
   * a Principal who also teaches can hand out a Teacher role but not another
   * Principal. This mirrors the server's rule exactly — the screen narrows
   * the choice, the server makes the decision.
   */
  const grantable = useMemo(
    () => grantableRoles(currentUser?.roles ?? []),
    [currentUser?.roles],
  );

  /**
   * The branches the signed-in member may appoint into.
   *
   * A college-wide member — one whose own role names no branch — may appoint
   * into any branch. A branch-scoped member may only appoint into a branch
   * they work in. The list is narrowed here so the screen never offers a
   * branch the server would refuse.
   *
   * The session carries one `branchId` — the branch of the member's first
   * role. That is enough to tell the two cases apart: a member whose role
   * names no branch is college-wide.
   */
  const appointableBranches = useMemo(() => {
    if (!currentUser?.branchId) return branches;
    const own = branches.filter((branch) => branch.id === currentUser.branchId);
    return own.length > 0 ? own : branches;
  }, [branches, currentUser?.branchId]);

  const branchName = (branchId: string | null | undefined): string => {
    if (!branchId) return 'All branches';
    const branch = branches.find((b) => b.id === branchId);
    return branch ? `${branch.code} — ${branch.name}` : 'A branch that is no longer listed';
  };

  const canManage = grantable.length > 0;

  return (
    <section
      className="rounded-xl border border-hairline bg-card p-4 md:p-6"
      aria-labelledby={`roles-heading-${memberId}`}
    >
      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-1">
          <h2
            id={`roles-heading-${memberId}`}
            className="font-display text-title-md text-ink"
          >
            Roles
          </h2>
          <p className="text-body-sm text-body">
            What {memberName} may see and do. A change takes effect on their next request —
            nobody has to sign in again.
          </p>
        </div>

        {canManage ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => setAssignOpen(true)}
            className="w-full md:w-auto"
          >
            <UserPlus aria-hidden /> Add a role
          </Button>
        ) : null}
      </header>

      {rolesQuery.isError ? (
        <div className="mt-4">
          <ErrorBanner
            message="Could not load this member's roles."
            retry={() => rolesQuery.refetch()}
          />
        </div>
      ) : null}

      {rolesQuery.isLoading ? (
        <div className="mt-4 flex items-center gap-sm text-body-sm text-body">
          <Spinner size={16} /> Loading roles…
        </div>
      ) : null}

      {!rolesQuery.isLoading && !rolesQuery.isError && held.length === 0 ? (
        <p className="mt-4 text-body-sm text-muted">
          {memberName} holds no roles yet. Without a role they will see nothing in this
          system.
        </p>
      ) : null}

      {held.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-2">
          {held.map((assignment) => {
            const key = `${assignment.role.id}-${assignment.branchId ?? 'all'}`;
            const removable = canManage;
            return (
              <li
                key={key}
                className="flex flex-col gap-2 rounded-lg border border-hairline bg-canvas p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="cb-badge">{roleDisplayName(assignment.role.name)}</span>
                    <span className="text-body-sm text-muted">
                      {assignment.branch ? (
                        <>
                          in{' '}
                          <span className="font-semibold text-ink">
                            {assignment.branch.code} — {assignment.branch.name}
                          </span>
                        </>
                      ) : (
                        <span className="font-semibold text-ink">across the whole college</span>
                      )}
                    </span>
                  </span>
                  {assignment.role.description ? (
                    <span className="text-caption text-muted">{assignment.role.description}</span>
                  ) : null}
                </div>

                {removable ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setRoleToRemove({
                        roleName: assignment.role.name,
                        branchId: assignment.branchId,
                      })
                    }
                    className="w-full shrink-0 sm:w-auto"
                  >
                    <Trash2 aria-hidden /> Remove
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {!canManage ? (
        <p className="mt-4 text-caption text-muted">
          You can only hand out roles below your own, and you hold none that could be handed
          out here. Ask an administrator above you.
        </p>
      ) : null}

      <AssignRoleDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        memberId={memberId}
        memberName={memberName}
        grantable={grantable}
        branches={appointableBranches}
        heldRoles={held.map((assignment) => ({
          roleName: assignment.role.name,
          branchId: assignment.branchId,
        }))}
      />

      <RemoveRoleDialog
        role={roleToRemove}
        memberId={memberId}
        memberName={memberName}
        branchLabel={roleToRemove ? branchName(roleToRemove.branchId) : ''}
        onOpenChange={(open) => {
          if (!open) setRoleToRemove(null);
        }}
      />
    </section>
  );
}

interface AssignRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: string;
  memberName: string;
  /** The roles the signed-in member may hand out. */
  grantable: UserRole[];
  /** The branches the signed-in member may appoint into. */
  branches: { id: string; code: string; name: string }[];
  /** The roles the member already holds, so a duplicate is not offered. */
  heldRoles: { roleName: string; branchId: string | null }[];
}

/**
 * The "give this member a role" dialog.
 *
 * The branch field appears only for a branch-scoped role, and the dialog
 * says why: a Head of Department with no branch would be looking after every
 * branch, which is not an appointment anybody makes on purpose.
 */
function AssignRoleDialog({
  open,
  onOpenChange,
  memberId,
  memberName,
  grantable,
  branches,
  heldRoles,
}: AssignRoleDialogProps) {
  const [roleName, setRoleName] = useState<UserRole | ''>('');
  const [branchId, setBranchId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const assignRole = useAssignRole();

  const needsBranch = roleName !== '' && BRANCH_SCOPED_ROLES.includes(roleName);

  /**
   * The roles that are not already held.
   *
   * A role already held in *this* branch is not offered again — assigning it
   * a second time would change nothing but the grant date. A role held in
   * *another* branch is still offered, because that is how a teacher comes to
   * work in two branches.
   */
  const available = grantable.filter((role) => {
    if (BRANCH_SCOPED_ROLES.includes(role)) return true;
    return !heldRoles.some((held) => held.roleName === role && !held.branchId);
  });

  const reset = () => {
    setRoleName('');
    setBranchId('');
    setError(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleSubmit = () => {
    if (!roleName) {
      setError('Choose the role to give.');
      return;
    }
    if (needsBranch && !branchId) {
      setError('Choose the branch this member will work in.');
      return;
    }

    setError(null);

    assignRole.mutate(
      {
        userId: memberId,
        roleName,
        ...(needsBranch && branchId ? { branchId } : {}),
      },
      {
        onSuccess: () => {
          reset();
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="dialog">
        <SheetHeader>
          <SheetTitle>Give {memberName} a role</SheetTitle>
          <SheetDescription>
            A role decides what someone may see and do. It takes effect on their very next
            request.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-base">
          {available.length === 0 ? (
            <p className="text-body-sm text-body">
              {memberName} already holds every role you are able to hand out.
            </p>
          ) : (
            <>
              <Select
                label="Role"
                value={roleName}
                onChange={(e) => setRoleName(e.target.value as UserRole)}
                placeholder="Select a role"
                error={error && !roleName ? error : undefined}
              >
                <option value="">Select a role</option>
                {available.map((role) => (
                  <option key={role} value={role}>
                    {roleDisplayName(role)}
                  </option>
                ))}
              </Select>

              {needsBranch ? (
                <Select
                  label="Branch"
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  placeholder="Select a branch"
                  error={error && !branchId ? error : undefined}
                >
                  <option value="">Select a branch</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.code} — {branch.name}
                    </option>
                  ))}
                </Select>
              ) : (
                <p className="text-caption text-muted">
                  This role applies to the whole college, so there is no branch to choose.
                </p>
              )}

              {error && roleName && (!needsBranch || branchId) ? (
                <p role="alert" className="text-body-sm text-semantic-down">
                  {error}
                </p>
              ) : null}
            </>
          )}
        </div>

        <SheetFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => handleOpenChange(false)}
            className="w-full md:w-auto"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={assignRole.isPending || available.length === 0}
            className="w-full md:w-auto"
          >
            {assignRole.isPending ? 'Saving…' : 'Give the role'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

interface RemoveRoleDialogProps {
  role: { roleName: string; branchId: string | null } | null;
  /** The member the role is being taken back from. */
  memberId: string;
  memberName: string;
  branchLabel: string;
  onOpenChange: (open: boolean) => void;
}

/**
 * The "take this role back" dialog.
 *
 * The consequence is stated before the button is pressed: what the member
 * will no longer be able to do, and in which branch. Taking back a role in
 * one branch leaves their roles in the other branches alone — and that is
 * said here, because it is the thing a person is most likely to be unsure
 * about.
 */
function RemoveRoleDialog({
  role,
  memberId,
  memberName,
  branchLabel,
  onOpenChange,
}: RemoveRoleDialogProps) {
  const revokeRole = useRevokeRole();

  const handleSubmit = () => {
    if (!role) return;
    revokeRole.mutate(
      {
        userId: memberId,
        roleName: role.roleName as UserRole,
        ...(role.branchId ? { branchId: role.branchId } : {}),
      },
      {
        onSuccess: () => onOpenChange(false),
      },
    );
  };

  return (
    <Sheet open={role !== null} onOpenChange={onOpenChange}>
      <SheetContent side="dialog">
        <SheetHeader>
          <SheetTitle>Take back the {roleDisplayName(role?.roleName ?? '')} role?</SheetTitle>
          <SheetDescription>
            {memberName} will no longer be able to do what this role allows
            {role?.branchId ? (
              <>
                {' '}
                in <span className="font-semibold text-ink">{branchLabel}</span>.
              </>
            ) : (
              ' across the whole college.'
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-base">
          <div className="rounded-lg border border-hairline bg-surface-soft p-4">
            <p className="text-body-sm text-body">
              {memberName} will keep their other roles, and their access to the rest of the
              college is unchanged.
            </p>
          </div>
        </div>

        <SheetFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            className="w-full md:w-auto"
          >
            Keep the role
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleSubmit}
            disabled={revokeRole.isPending}
            className="w-full md:w-auto"
          >
            {revokeRole.isPending ? 'Removing…' : 'Take back the role'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/**
 * The roles a member holds, with the branch each is scoped to.
 *
 * Exported for the screens that show a member's roles as a summary rather
 * than as a screen that manages them.
 */
export function MemberRoleSummary({
  roles,
  branches,
}: {
  roles: { roleName: string; branchId?: string | null }[];
  branches: { id: string; code: string; name: string }[];
}) {
  if (!roles || roles.length === 0) {
    return <span className="text-caption text-muted">No roles assigned</span>;
  }

  return (
    <div className="flex flex-wrap gap-xs">
      {roles.map((role) => {
        const branch = role.branchId
          ? branches.find((b) => b.id === role.branchId)
          : undefined;
        return (
          <span
            key={`${role.roleName}-${role.branchId ?? 'global'}`}
            className="cb-badge"
            title={
              branch ? `${roleDisplayName(role.roleName)} · ${branch.code} — ${branch.name}` : roleDisplayName(role.roleName)
            }
          >
            {roleDisplayName(role.roleName)}
            {branch ? ` · ${branch.code}` : ''}
          </span>
        );
      })}
    </div>
  );
}

/**
 * The icon set the panel uses, exported so a parent screen can reuse it
 * without importing from `lucide-react` directly.
 */
export const MemberRolesIcons = { ShieldCheck };
