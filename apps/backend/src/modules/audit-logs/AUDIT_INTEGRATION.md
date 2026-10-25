# Audit logging — integration guide

Requirement: **§7.18 of `new-requirements.md`** — "the principal and Super Admin
need to see who changed what."

The audit trail is written by one mechanism, in one place:

```
route handler  ──▶  AuditInterceptor  ──▶  AuditService.record()  ──▶  AuditLogsRepository.create()  ──▶  audit_logs
```

A route opts in by carrying the `@Audited(...)` decorator. Routes without it are
not audited, so read paths cost nothing.

---

## 1. The decorator

```ts
import { Audited, AuditAction, AuditResource } from '@/common/decorators';
```

`@Audited(resource, action, options?)`

| Argument | Type | Meaning |
|---|---|---|
| `resource` | `string` | The `resource` column of the audit row. Use the `AuditResource` constants. |
| `action` | `string` | The `action` column. Use the `AuditAction` constants. |
| `options` | `AuditedOptions` | Optional; see below. |

### `AuditAction`

`CREATE` · `UPDATE` · `DELETE` · `BULK_IMPORT` · `CONFIRM`

### `AuditResource`

`student` · `subject` · `subject_offering` · `mark` · `branch` · `scheme` ·
`teacher_allocation` · `class_teacher_assignment` · `upload_job`

A resource that is not in the list is still accepted — the constant is a
convenience, not a constraint.

### `AuditedOptions`

| Option | Default | Meaning |
|---|---|---|
| `resourceIdSource` | `'response'` | Where the entity id comes from: `'response'` (the handler's return value), `'param'` (a route parameter), `'body'` (a body field), `'none'` (bulk operations — no id). |
| `resourceIdField` | `'id'` | The name of the field the id is read from. |
| `details` | `{}` | Extra detail merged into the row's `details` JSON. |
| `detailsFromBody` | — | `{ auditFieldName: 'bodyFieldName' }` — copies named fields out of the request body into `details`. An **array** body field is recorded as its **length**, never as the array itself. |
| `skip` | `false` | Cancels a controller-level `@Audited` on this handler. |

### Examples

```ts
// A create — the id only exists in the response.
@Post()
@Permissions('students:write')
@Audited(AuditResource.STUDENT, AuditAction.CREATE, {
  resourceIdSource: 'response',
  detailsFromBody: { rollNo: 'rollNo', semester: 'semester' },
})
async create(@Body() dto: CreateStudentDto, @CurrentUser() user: JwtPayload) {
  return this.service.create(dto, user.sub);
}

// An update — the id is in the route.
@Put(':id')
@Permissions('students:write')
@Audited(AuditResource.STUDENT, AuditAction.UPDATE, { resourceIdSource: 'param' })
async update(@Param('id') id: string, @Body() dto: UpdateStudentDto) { … }

// A bulk import — no single id; the row count is recorded instead.
@Post('bulk-import')
@Permissions('students:write')
@Audited(AuditResource.STUDENT, AuditAction.BULK_IMPORT, { resourceIdSource: 'none' })
async bulkImport(@Body() dto: BulkImportStudentsDto) { … }
```

---

## 2. What the interceptor does and does not do

**Does**

- Records **only successful** mutations. A handler that throws changes nothing.
- Captures the **authenticated user** (`req.user.sub`), the **client IP** (the
  left-most `X-Forwarded-For` entry, falling back to the socket address) and
  the **user agent**.
- Records the **HTTP method and route** under `details.request`.
- Awaits the audit write before the response is returned, so a row cannot be
  lost to a process shutdown.

**Does not**

- **Never fails the request.** The mutation has already been committed by the
  time the row is written; refusing to answer would leave the caller
  believing the change did not happen. A failed write is logged with
  `Logger(AuditService)` and dropped.
- Does not audit read paths, and does not audit routes without `@Audited`.

---

## 3. Calling the audit service directly

For a mutation that does not go through an HTTP route — a queue processor, a
bootstrap script — inject `AuditService` and call it:

```ts
import { AuditService } from '@/common/services/audit.service';

@Injectable()
export class SomeProcessor {
  constructor(private readonly audit: AuditService) {}

  async run(jobId: string, actorId: string) {
    await this.audit.record({
      userId: actorId,
      action: 'BULK_IMPORT',
      resource: 'mark',
      resourceId: jobId,
      details: { rows: 120 },
    });
  }
}
```

`AuditService` is exported by the global `AuditLogsModule`, so it can be
injected anywhere without importing the module.

`AuditLogsService.log({ … })` still exists and is used by the auth, invite and
password-reset modules. It delegates to `AuditService.record()`, so there is
only one write path.

---

## 4. Reading the trail

### `GET /audit-logs`

Requires `audit:read`.

| Query parameter | Type | Notes |
|---|---|---|
| `page` | number | 1-based. |
| `pageSize` | number | Default 20, maximum 100. |
| `userId` | string | Exact match. |
| `action` | string | Exact match. **Comma-separated list accepted** (`CREATE,UPDATE`). |
| `resource` | string | Exact match. **Comma-separated list accepted** (`student,mark`). |
| `fromDate` | ISO date | `createdAt >=`. |
| `toDate` | ISO date | `createdAt <=`. |
| `search` | string | Case-insensitive match on `resourceId`, `action` or `resource`. |
| `ipAddress` | string | Exact match. |

Response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "…",
        "userId": "…",
        "action": "CREATE",
        "resource": "student",
        "resourceId": "…",
        "details": { "rollNo": "CS-042" },
        "ipAddress": "10.0.0.4",
        "userAgent": "Mozilla/5.0 …",
        "createdAt": "2026-10-25T09:12:44.000Z",
        "user": { "id": "…", "email": "…", "name": "…" }
      }
    ],
    "meta": { "page": 1, "pageSize": 20, "total": 137, "totalPages": 7 }
  },
  "timestamp": "…"
}
```

### `GET /audit-logs/facets`

Requires `audit:read`. The distinct actions, resources and users present in
the trail, so a screen can build its filter dropdowns without paging through
the whole trail.

```json
{
  "success": true,
  "data": {
    "actions": [{ "value": "CREATE", "count": 42 }],
    "resources": [{ "value": "student", "count": 18 }],
    "users": [{ "id": "…", "email": "…", "name": "…" }]
  },
  "timestamp": "…"
}
```

### `GET /audit-logs/:id`

Requires `audit:read`. A single entry, with the acting user included.

---

## 5. Routes that still need `@Audited(...)`

The routes below mutate academic data but do not yet carry the decorator.
Each line is the exact decorator to add, immediately after the
`@Permissions(...)` line of the named handler.

### `apps/backend/src/modules/marks/marks.controller.ts`

| Handler | Decorator to add |
|---|---|
| `create` (`POST /marks`) | `@Audited(AuditResource.MARK, AuditAction.CREATE, { resourceIdSource: 'response', detailsFromBody: { studentId: 'studentId', subjectOfferingId: 'subjectOfferingId', examType: 'examType', marksObtained: 'marksObtained' } })` |
| `createBulk` (`POST /marks/bulk`) | `@Audited(AuditResource.MARK, AuditAction.BULK_IMPORT, { resourceIdSource: 'none', detailsFromBody: { rowCount: 'marks' } })` |
| `update` (`PUT /marks/:id`) | `@Audited(AuditResource.MARK, AuditAction.UPDATE, { resourceIdSource: 'param', detailsFromBody: { marksObtained: 'marksObtained' } })` |
| `delete` (`DELETE /marks/:id`) | `@Audited(AuditResource.MARK, AuditAction.DELETE, { resourceIdSource: 'param' })` |

### `apps/backend/src/modules/subjects/subjects.controller.ts`

| Handler | Decorator to add |
|---|---|
| `create` (`POST /subjects`) | `@Audited(AuditResource.SUBJECT, AuditAction.CREATE, { resourceIdSource: 'response', detailsFromBody: { code: 'code', name: 'name' } })` |
| `update` (`PUT /subjects/:id`) | `@Audited(AuditResource.SUBJECT, AuditAction.UPDATE, { resourceIdSource: 'param', detailsFromBody: { code: 'code', name: 'name' } })` |
| `delete` (`DELETE /subjects/:id`) | `@Audited(AuditResource.SUBJECT, AuditAction.DELETE, { resourceIdSource: 'param' })` |

### `apps/backend/src/modules/subjects/subject-offerings.controller.ts`

| Handler | Decorator to add |
|---|---|
| `create` (`POST /subject-offerings`) | `@Audited(AuditResource.SUBJECT_OFFERING, AuditAction.CREATE, { resourceIdSource: 'response', detailsFromBody: { subjectId: 'subjectId', branchId: 'branchId', semester: 'semester', schemeId: 'schemeId' } })` |
| `update` (`PUT /subject-offerings/:id`) | `@Audited(AuditResource.SUBJECT_OFFERING, AuditAction.UPDATE, { resourceIdSource: 'param' })` |
| `delete` (`DELETE /subject-offerings/:id`) | `@Audited(AuditResource.SUBJECT_OFFERING, AuditAction.DELETE, { resourceIdSource: 'param' })` |

Both subject files also need the import:

```ts
import { Permissions, Audited, AuditAction, AuditResource } from '@/common/decorators';
```

---

## 6. Routes that are already audited

| Route | Action | Resource |
|---|---|---|
| `POST /students` | `CREATE` | `student` |
| `PUT /students/:id` | `UPDATE` | `student` |
| `DELETE /students/:id` | `DELETE` | `student` |
| `POST /students/bulk-import` | `BULK_IMPORT` | `student` |
| `POST /students/bulk-import/file` | `BULK_IMPORT` | `student` |
| `POST /branches` | `CREATE` | `branch` |
| `PUT /branches/:id` | `UPDATE` | `branch` |
| `DELETE /branches/:id` | `DELETE` | `branch` |
| `POST /schemes` | `CREATE` | `scheme` |
| `PUT /schemes/:id` | `UPDATE` | `scheme` |
| `DELETE /schemes/:id` | `DELETE` | `scheme` |
| `POST /teacher-allocations` | `CREATE` | `teacher_allocation` |
| `DELETE /teacher-allocations/:id` | `DELETE` | `teacher_allocation` |
| `POST /class-teacher-assignments` | `CREATE` | `class_teacher_assignment` |
| `DELETE /class-teacher-assignments/:id` | `DELETE` | `class_teacher_assignment` |
| `POST /upload` | `CREATE` | `upload_job` |
| `POST /upload/file` | `CREATE` | `upload_job` |
| `POST /upload/jobs/:jobId/confirm` | `CONFIRM` | `upload_job` |
| `DELETE /upload/:id` | `DELETE` | `upload_job` |

`POST /students/:studentId/provision-login` is audited by
`StudentProvisioningService` itself, because only the service knows whether
the account was created or merely linked. It must **not** also carry
`@Audited`, or the trail would hold two rows for one action.
