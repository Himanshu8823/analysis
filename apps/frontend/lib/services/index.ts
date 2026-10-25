// Service barrel — pure async functions wrapping the Axios `apiClient`.
// All services follow the pattern:
//   - import apiClient + ENDPOINTS
//   - export as `xxxService` object with method per endpoint
//   - never import React, never call React Query here.
export { authService } from './auth.service';
export { branchesService } from './branches.service';
export { schemesService } from './schemes.service';
export { subjectsService } from './subjects.service';
export { studentsService } from './students.service';
export { marksService } from './marks.service';
export { uploadService } from './upload.service';
export { reportsService } from './reports.service';
export { toppersService } from './toppers.service';
export { analyticsService } from './analytics.service';
export { usersService } from './users.service';
export { dashboardService } from './dashboard.service';
export { auditLogsService } from './audit-logs.service';