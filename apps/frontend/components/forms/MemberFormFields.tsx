'use client';

import { useState } from 'react';
import {
  BRANCH_SCOPED_ROLES,
  INVITABLE_ROLES,
  type Member,
  type UserRole,
} from '@result-analysis/shared-types';

import { Select } from '@/components/forms/Select';
import { roleDisplayName } from '@/lib/utils/role-labels';

/**
 * The roles a new member may be invited with, and the roles that are tied to
 * a branch.
 *
 * Both lists come from the shared package, which is also what the backend
 * seed and the role-assignment screen use — so the invitation screen, the
 * role screen and the server can never disagree about which roles exist or
 * which of them belong to a branch.
 */
export { INVITABLE_ROLES, BRANCH_SCOPED_ROLES };

interface InviteMemberFormFieldsProps {
  id: string;
  branches: { id: string; code: string; name: string }[];
  onSubmit: (payload: {
    email: string;
    name: string;
    roleName: UserRole;
    branchId?: string;
  }) => void;
}

/**
 * InviteMemberFormFields — the shared field set for inviting a member.
 *
 * Used by the "invite member" page. The branch field appears only for
 * branch-scoped roles, since a global role has no branch to scope to.
 */
export function InviteMemberFormFields({
  id,
  branches,
  onSubmit,
}: InviteMemberFormFieldsProps) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    roleName: 'TEACHER' as UserRole,
    branchId: '',
  });

  const needsBranch = BRANCH_SCOPED_ROLES.includes(form.roleName);

  return (
    <form
      id={id}
      className="grid grid-cols-1 gap-base md:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          email: form.email,
          name: form.name,
          roleName: form.roleName,
          ...(needsBranch && form.branchId ? { branchId: form.branchId } : {}),
        });
      }}
    >
      <label className="flex flex-col gap-xs">
        <span className="text-body-sm font-semibold text-ink">Full name</span>
        <input
          required
          minLength={2}
          maxLength={100}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="cb-input"
          placeholder="Jane Doe"
        />
      </label>

      <label className="flex flex-col gap-xs">
        <span className="text-body-sm font-semibold text-ink">Email</span>
        <input
          type="email"
          required
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="cb-input"
          placeholder="jane@college.edu"
        />
      </label>

      <Select
        label="Role"
        value={form.roleName}
        onChange={(e) => setForm({ ...form, roleName: e.target.value as UserRole })}
        className="md:col-span-2"
      >
        {INVITABLE_ROLES.map((role) => (
          <option key={role} value={role}>
            {role}
          </option>
        ))}
      </Select>

      {needsBranch ? (
        <Select
          label="Branch"
          value={form.branchId}
          onChange={(e) => setForm({ ...form, branchId: e.target.value })}
          className="md:col-span-2"
        >
          <option value="">Select a branch</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.code} — {branch.name}
            </option>
          ))}
        </Select>
      ) : null}

      <p className="text-caption text-muted md:col-span-2">
        They will receive an email with a one-time link to choose their own password. The link
        expires in 7 days.
      </p>
    </form>
  );
}

interface EditMemberFormFieldsProps {
  id: string;
  member: Member;
  onSubmit: (payload: { email: string; name: string }) => void;
  /**
   * The branches, so a role chip can say which branch the role belongs to.
   *
   * Without it the chips would show a bare role name and an administrator
   * could not tell whether a Teacher works in one branch or three.
   */
  branches?: { id: string; code: string; name: string }[];
}

/**
 * EditMemberFormFields — the shared field set for editing a member.
 *
 * Roles are deliberately not editable here — a role change goes through the
 * RBAC endpoints so the permission cache is invalidated and the change is
 * audited. Editing a role in place would bypass both. The roles are shown
 * as a read-only summary here, and changed on the roles panel below.
 */
export function EditMemberFormFields({
  id,
  member,
  onSubmit,
  branches = [],
}: EditMemberFormFieldsProps) {
  const [form, setForm] = useState({
    name: member.name,
    email: member.email,
  });

  /**
   * The role chips are rendered from the member's roles. The endpoint may
   * omit the array entirely for a member with no role rows, so it is
   * defaulted — reading `.length` off `undefined` would crash the page.
   */
  const assignedRoles = member.roles ?? [];

  return (
    <form
      id={id}
      className="grid grid-cols-1 gap-base md:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(form);
      }}
    >
      <label className="flex flex-col gap-xs">
        <span className="text-body-sm font-semibold text-ink">Full name</span>
        <input
          required
          minLength={2}
          maxLength={100}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="cb-input"
        />
      </label>

      <label className="flex flex-col gap-xs">
        <span className="text-body-sm font-semibold text-ink">Email</span>
        <input
          type="email"
          required
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="cb-input"
        />
      </label>

      <div className="flex flex-col gap-xs md:col-span-2">
        <span className="text-body-sm font-semibold text-ink">Current roles</span>
        {assignedRoles.length === 0 ? (
          <span className="text-caption text-muted">
            No roles assigned. Use the Roles panel below to give this member their first role.
          </span>
        ) : (
          <div className="flex flex-wrap gap-xs">
            {assignedRoles.map((r) => {
              const branch = r.branchId
                ? branches.find((b) => b.id === r.branchId)
                : undefined;
              return (
                <span
                  key={`${r.roleName}-${r.branchId ?? 'global'}`}
                  className="cb-badge"
                  title={branch ? `${branch.code} — ${branch.name}` : 'The whole college'}
                >
                  {roleDisplayName(r.roleName)}
                  {branch ? ` · ${branch.code}` : ''}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </form>
  );
}
