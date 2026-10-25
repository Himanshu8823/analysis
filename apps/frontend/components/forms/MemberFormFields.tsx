'use client';

import { useState } from 'react';
import type { Member, UserRole } from '@result-analysis/shared-types';

import { Select } from '@/components/forms/Select';

export const INVITABLE_ROLES: UserRole[] = ['ADMIN', 'HOD', 'TEACHER', 'PRINCIPAL'];

/** Roles that are scoped to a specific branch. */
export const BRANCH_SCOPED_ROLES: UserRole[] = ['HOD', 'PRINCIPAL', 'TEACHER'];

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
}

/**
 * EditMemberFormFields — the shared field set for editing a member.
 *
 * Roles are deliberately not editable here — a role change goes through the
 * RBAC endpoints so the permission cache is invalidated and the change is
 * audited. Editing a role in place would bypass both.
 */
export function EditMemberFormFields({
  id,
  member,
  onSubmit,
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

      <div className="flex flex-wrap gap-xs md:col-span-2">
        {assignedRoles.length === 0 ? (
          <span className="text-caption text-muted">No roles assigned</span>
        ) : (
          assignedRoles.map((r) => (
            <span key={`${r.roleName}-${r.branchId ?? 'global'}`} className="cb-badge">
              {r.roleName}
            </span>
          ))
        )}
      </div>

      <p className="text-caption text-muted md:col-span-2">
        Roles are managed through the RBAC settings so every change is audited and applied
        immediately.
      </p>
    </form>
  );
}
