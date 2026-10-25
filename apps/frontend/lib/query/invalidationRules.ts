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
  onReportGenerated: (qc: QueryClient) => {
    qc.invalidateQueries({ queryKey: queryKeys.reports.all() });
  },
};