// Hooks barrel — every hook lives in its own file and uses React Query
// for server-state + cache invalidation via `@/lib/query/invalidationRules`.
export {
  useLogin,
  useAcceptInvite,
  useChangePassword,
  useForgotPassword,
  useLogout,
  useCurrentUser,
} from './useAuth';
export { useBranches, useCreateBranch, useUpdateBranch, useDeleteBranch } from './useBranches';
export { useSchemes, useScheme, useCreateScheme, useUpdateScheme } from './useSchemes';
export {
  useSubjects,
  useSubjectsByBranchSchemeSem,
  useCreateSubject,
  useUpdateSubject,
  useDeleteSubject,
} from './useSubjects';
export {
  useStudents,
  useStudent,
  useCreateStudent,
  useUpdateStudent,
  useDeleteStudent,
  useImportStudents,
} from './useStudents';
export {
  useMarks,
  useMarksByStudent,
  useCreateBulkMarks,
  useUpdateMark,
  useCalculateMarks,
} from './useMarks';
export { useUploadFile, useUploadJob, useConfirmUpload } from './useUpload';
export {
  useGenerateReport,
  useReports,
  useReport,
  useDownloadReport,
} from './useReports';
export { useSubjectToppers, useClassToppers } from './useToppers';
export {
  useOverview,
  usePassFail,
  useSubjectDifficulty,
  usePerformanceTrends,
} from './useAnalytics';
export {
  useInvites,
  useInviteCounts,
  useInviteUser,
  useRevokeInvite,
  useResendInvite,
  useValidateInvite,
} from './useInvites';
export {
  useMembers,
  useRoles,
  useSetMemberActive,
  useUpdateMember,
  useDeleteMember,
} from './useMembers';
export { useDashboard } from './useDashboard';