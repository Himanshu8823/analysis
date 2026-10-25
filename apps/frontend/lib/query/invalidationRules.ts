import { QueryClient } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';

/**
 * Invalidates every invitation query.
 *
 * The list query key embeds the active filters, so a single `invalidateQueries`
 * on the bare `['invites']` prefix has to match on the *hash* of the nested
 * filter object. Invalidate the list and the counts separately instead —
 * both are named explicitly, so a change to the key factory cannot silently
 * stop the list from refreshing.
 */
function invalidateInvites(qc: QueryClient): void {
  qc.invalidateQueries({ queryKey: ['invites', 'list'] });
  qc.invalidateQueries({ queryKey: queryKeys.invites.counts() });
}

// Centralized invalidation rules for mutations
export const invalidationRules = {
  onInviteSent: (qc: QueryClient) => {
    invalidateInvites(qc);
    qc.invalidateQueries({ queryKey: queryKeys.members.all() });
  },
  onInviteRevoked: (qc: QueryClient) => {
    invalidateInvites(qc);
  },
  onInviteResent: (qc: QueryClient) => {
    invalidateInvites(qc);
  },
  onMemberUpdated: (qc: QueryClient) => {
    qc.invalidateQueries({ queryKey: queryKeys.members.all() });
  },
  /**
   * Invalidates everything touched by an RBAC change.
   *
   * A role's permission set changed, so every cached view of that role's
   * permissions is stale, the role list is stale (its permission count moved),
   * and the member screens are stale (their role chips and the role filter
   * dropdown are derived from the same roles). The member list is included
   * because the roles tab and the "assign a role" dropdown both read from
   * it.
   */
  onRolesChanged: (qc: QueryClient, roleId?: string) => {
    qc.invalidateQueries({ queryKey: queryKeys.roles.all() });
    if (roleId) {
      qc.invalidateQueries({ queryKey: queryKeys.roles.permissions(roleId) });
      qc.invalidateQueries({ queryKey: queryKeys.roles.detail(roleId) });
    }
    qc.invalidateQueries({ queryKey: queryKeys.permissions.all() });
    qc.invalidateQueries({ queryKey: queryKeys.members.all() });
  },
  onStudentCreated: (qc: QueryClient) => {
    qc.invalidateQueries({ queryKey: queryKeys.students.all() });
    qc.invalidateQueries({ queryKey: queryKeys.analytics.overview() });
  },
  onMarksUpdated: (qc: QueryClient, studentId: string) => {
    qc.invalidateQueries({ queryKey: queryKeys.marks.byStudent(studentId) });
    qc.invalidateQueries({ queryKey: queryKeys.marks.all() });
    qc.invalidateQueries({ queryKey: queryKeys.toppers.subjectWise() });
    qc.invalidateQueries({ queryKey: queryKeys.toppers.class() });
    qc.invalidateQueries({ queryKey: queryKeys.analytics.overview() });
    qc.invalidateQueries({ queryKey: queryKeys.reports.all() });
  },
  onSchemeUpdated: (qc: QueryClient, schemeId: string) => {
    qc.invalidateQueries({ queryKey: queryKeys.schemes.detail(schemeId) });
    qc.invalidateQueries({ queryKey: queryKeys.schemes.all() });
    qc.invalidateQueries({ queryKey: queryKeys.subjects.all() });
    qc.invalidateQueries({ queryKey: queryKeys.marks.all() });
    qc.invalidateQueries({ queryKey: queryKeys.analytics.overview() });
  },
  /**
   * A branch is referenced by students, subjects and reports, so a change to
   * the branch list invalidates those lists too — they render the branch code
   * and name next to each record.
   */
  onBranchChanged: (qc: QueryClient) => {
    qc.invalidateQueries({ queryKey: queryKeys.branches.all() });
    qc.invalidateQueries({ queryKey: queryKeys.students.all() });
    qc.invalidateQueries({ queryKey: queryKeys.subjects.all() });
  },
  onReportGenerated: (qc: QueryClient) => {
    qc.invalidateQueries({ queryKey: queryKeys.reports.all() });
  },
  /**
   * A subject changed — created, updated or deactivated.
   *
   * The subject catalogue and the offerings are invalidated together because
   * they are two views of the same structure: a subject is the identity, an
   * offering says where that identity is taught. Editing the marks template
   * changes both the catalogue row and every offering that references it.
   *
   * The list key embeds the active filters, so the `list` prefix is
   * invalidated explicitly (the same reasoning as `invalidateInvites`).
   */
  onSubjectChanged: (qc: QueryClient) => {
    qc.invalidateQueries({ queryKey: ['subjects', 'list'] });
    qc.invalidateQueries({ queryKey: queryKeys.subjects.all() });
    qc.invalidateQueries({ queryKey: ['subjects', 'offerings'] });
  },
  /**
   * A teacher allocation changed — a subject was given to a teacher, or the
   * allocation was removed.
   *
   * The list query key embeds the active filters, so the `list` prefix is
   * invalidated explicitly (the same reasoning as `invalidateInvites`).
   * The subject list is invalidated too: an allocation references a subject
   * offering, and a removed offering must not linger in the picker.
   */
  onTeacherAllocationChanged: (qc: QueryClient) => {
    qc.invalidateQueries({ queryKey: ['teacher-allocations', 'list'] });
    qc.invalidateQueries({ queryKey: queryKeys.teacherAllocations.all() });
    qc.invalidateQueries({ queryKey: queryKeys.subjects.all() });
    qc.invalidateQueries({ queryKey: ['subjects', 'offerings'] });
  },
  /**
   * A class-teacher assignment changed — a class teacher was set, replaced,
   * or removed.
   */
  onClassTeacherAssignmentChanged: (qc: QueryClient) => {
    qc.invalidateQueries({ queryKey: ['class-teacher-assignments', 'list'] });
    qc.invalidateQueries({ queryKey: queryKeys.classTeacherAssignments.all() });
  },
};