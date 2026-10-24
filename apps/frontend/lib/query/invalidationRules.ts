import { QueryClient } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';

// Centralized invalidation rules for mutations
export const invalidationRules = {
  onInviteSent: (qc: QueryClient) => {
    qc.invalidateQueries({ queryKey: queryKeys.invites.all() });
    qc.invalidateQueries({ queryKey: queryKeys.members.all() });
  },
  onInviteRevoked: (qc: QueryClient) => {
    qc.invalidateQueries({ queryKey: queryKeys.invites.all() });
  },
  onInviteResent: (qc: QueryClient) => {
    qc.invalidateQueries({ queryKey: queryKeys.invites.all() });
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