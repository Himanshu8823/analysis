# API Reference

Every endpoint the Resultiq API exposes, with the permission it needs, the
scope it applies, what it returns, and what it may refuse with.

**Status date:** 2026-11-16
**Base URL:** `http://localhost:3001/api/v1` (development)
**Route count:** 157

**How to read this file.**

| Section | What it covers |
|---|---|
| [1. Authentication](#1-authentication) | How the token is sent, how refresh works, what a 401 does |
| [2. The error envelope](#2-the-error-envelope) | The exact JSON shape of every failure |
| [3. Status codes](#3-status-codes) | What each status means *here* |
| [4. Pagination](#4-pagination) | The request and response shape |
| [5. Rate limits](#5-rate-limits) | Which routes have them and what they are |
| [6. Permissions and scopes](#6-permissions-and-scopes) | How to read the columns in the tables |
| [7. The endpoints](#7-the-endpoints) | Every route, by controller group |
| [8. The permission catalogue](#8-the-permission-catalogue) | All 48 permissions and who holds them |

**Conventions used throughout.**

- **Permission** names the permission string(s) the route requires. `all of`
  means the member must hold **every** one of them; `any of` means **at
  least one**.
- **Scope** names the records the route is narrowed to for the caller.
- A route marked **public** needs no session at all. A route marked
  **member-scoped** needs a session but no particular permission, because it
  acts only on the caller's own records.
- Every path in the tables is relative to `/api/v1`. So `POST /marks` means
  `POST http://localhost:3001/api/v1/marks`.

---

## 1. Authentication

### 1.1 The token

The API uses a **bearer token**. Send it in the `Authorization` header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

The access token is a JWT signed with `JWT_SECRET` and expires in **15
minutes** (`JWT_EXPIRES_IN`). The refresh token expires in **7 days**
(`REFRESH_EXPIRES_IN`).

The frontend's Axios client attaches the header automatically; a native
client must add it to every request except the public ones.

### 1.2 Signing in

```
POST /auth/login
Content-Type: application/json

{ "email": "hod.cs@college.edu", "password": "••••••••" }
```

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "eyJhbGciOi...",
    "user": {
      "id": "…", "email": "hod.cs@college.edu", "name": "…",
      "roles": [{ "roleName": "HOD", "branchId": "…" }],
      "permissions": ["students:read", "marks:read", "…"],
      "mustChangePassword": false
    }
  },
  "timestamp": "2026-11-16T09:41:07.123Z"
}
```

**`permissions` is the array the whole system turns on.** It is the union of
every role the member holds — never a role name. Send it back to the client
so the frontend can decide what to show; the server decides what to allow.

### 1.3 Refreshing

```
POST /auth/refresh
{ "refreshToken": "eyJhbGciOi..." }
```

```json
{ "success": true, "data": { "accessToken": "…", "refreshToken": "…" } }
```

**The refresh token is rotated.** The response's `refreshToken` is a *new*
token; the one you sent is revoked. **Store the new one**, or the next
refresh will be rejected.

Only the SHA-256 hash of a refresh token is stored, so a database leak yields
no usable session.

### 1.4 What happens on a 401

A 401 means the access token is missing, invalid or expired.

**What the server does:** nothing special. It refuses the request.

**What the frontend does:** the Axios response interceptor catches the 401,
calls `POST /auth/refresh` with the stored refresh token, stores the rotated
pair, and replays the original request. Concurrent requests during a refresh
are queued and replayed when it completes. If the refresh itself fails, the
session is cleared and the member is sent to `/login`.

`/auth/login`, `/auth/refresh` and `/auth/accept-invite` are **exempt** from
the silent refresh — a 401 on those means "wrong credentials", and refreshing
would reload the page and hide the error the member needs to see.

### 1.5 Signing out

| Route | Effect |
|---|---|
| `POST /auth/logout` | Revokes the current session |
| `POST /auth/logout-all` | Revokes **every** session the member holds |

Both return **204 No Content**.

### 1.6 The forced password change

When `mustChangePassword` is true, **every** route returns 403 except the
ones decorated `@AllowPasswordChange()` — which are `POST /auth/logout`,
`POST /auth/logout-all`, `POST /auth/change-password`, `GET /auth/me`,
`PATCH /auth/profile`, `POST /auth/profile/avatar` and
`DELETE /auth/profile/avatar`.

The frontend sends the member to `/change-password` and holds them there.

### 1.7 The other credentials

| Credential | Where it goes | How it is stored |
|---|---|---|
| Password | Sent in the body over HTTPS | bcrypt, 12 rounds |
| Access token | `Authorization: Bearer` header | Not stored server-side; signed JWT |
| Refresh token | Body of `POST /auth/refresh` | SHA-256 hash only |
| Password-reset token | Body of `POST /auth/reset-password` | SHA-256 hash only |
| Invitation token | Body of `POST /auth/accept-invite`, or `?token=` on `GET /invites/validate` | SHA-256 hash only |

---

## 2. The error envelope

**Every** failure — validation, permission, missing record, conflict, rate
limit, server fault — has the same shape. `HttpExceptionFilter` is the
single place it is shaped.

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "You are not allocated to Computer Networks, so you cannot enter its marks."
  },
  "timestamp": "2026-11-16T09:41:07.123Z",
  "path": "/api/v1/marks"
}
```

| Field | Type | What it is |
|---|---|---|
| `success` | `false` | Always `false` on an error. Always `true` on a success. |
| `error.code` | `string` | A machine-readable kind. Derived from the status, unless the exception carried its own. |
| `error.message` | `string` | A sentence **for the person reading it**. Never a code, never a stack trace. |
| `error.retryAfter` | `number` | **Only on a 429.** Seconds to wait before retrying. Also sent as the `Retry-After` header. |
| `timestamp` | `string` | ISO-8601, when the response was produced. |
| `path` | `string` | The request path. |

**The codes**, and the status each accompanies:

| Code | Status | Meaning |
|---|---|---|
| `BAD_REQUEST` | 400 | The request was malformed or a field failed validation |
| `MALFORMED_REQUEST` | 400 | The body could not be parsed |
| `UNAUTHORIZED` | 401 | No session, or the session has expired |
| `FORBIDDEN` | 403 | Signed in, but not allowed to do this |
| `NOT_FOUND` | 404 | The record does not exist, or is not yours to see |
| `CONFLICT` | 409 | The change collides with something that already exists |
| `UNPROCESSABLE_ENTITY` | 422 | The request was well-formed but the rule was not satisfied |
| `TOO_MANY_REQUESTS` | 429 | The rate limit was reached |
| `REQUEST_TIMEOUT` | 408 | The request took longer than its route allows |
| `SERVICE_UNAVAILABLE` | 503 | A dependency the route needs is unavailable |
| `INTERNAL_ERROR` | 500 | An unexpected server fault |
| `HTTP_<n>` | any | A status with no code of its own |

**A 400 from validation** carries the field-level messages in
`error.message`, as an array of strings, one per failing field:

```json
{
  "success": false,
  "error": {
    "code": "BAD_REQUEST",
    "message": [
      "rollNo should not be empty",
      "marksObtained must not be less than 0"
    ]
  },
  "timestamp": "2026-11-16T09:41:07.123Z",
  "path": "/api/v1/marks"
}
```

**What never appears in a response.** No stack trace, no SQL, no Prisma error,
no file path, no secret, no database table or column name. The original
message is written to the server's log and replaced with a sentence. A 500
always reads *"Something went wrong on our side. Please try again."*

---

## 3. Status codes

| Status | What it means here | What the member is told |
|---|---|---|
| **200** | The operation succeeded | — |
| **201** | The record was created | — |
| **204** | The operation succeeded and there is nothing to return (logout, delete, archive) | — |
| **400** | The request was malformed, or a field failed validation. The messages name the fields. | The field messages, verbatim |
| **401** | No session, or the access token has expired. Refresh, or sign in again. | "Your session has ended" |
| **403** | Signed in, but not allowed. Either the permission is missing, or the record is outside the caller's scope, or the caller is not allocated to that subject. | The specific reason — *"You are not allocated to Computer Networks, so you cannot enter its marks."* — or *"You do not have access to this. Ask the college administrator if you need it."* |
| **404** | The record does not exist, or it does not exist **for you**. A 404 for a record the caller may not see confirms nothing. | *"That student record no longer exists. It may have been removed from the register."* |
| **409** | The change collides with something that already exists — a duplicate roll number, an unconfirmed class-teacher replacement, an academic year that already exists. | The collision, explained: *"Roll No 42 already exists for 2024-25."* |
| **422** | The request was well-formed but the rule was not satisfied. | The rule, in a sentence |
| **429** | The rate limit was reached. Wait `retryAfter` seconds and try again. | "Too many attempts" |
| **500** | An unexpected server fault. The work was not saved. Retry; if it persists, quote the timestamp and path. | *"Something went wrong on our side. Please try again."* |
| **503** | A dependency the route needs is unavailable — the AI provider, storage. | The dependency's own sentence |

---

## 4. Pagination

### 4.1 The request

List routes that paginate take two query parameters:

| Parameter | Type | Default | Range |
|---|---|---|---|
| `page` | integer | `1` | 1 or more |
| `pageSize` | integer | `20` | 1 – 100 |

```
GET /students?page=2&pageSize=50
```

Values outside the range are **clamped**, not rejected: `pageSize=1000`
becomes 100, `page=0` becomes 1, and a non-numeric value is treated as "not
provided".

### 4.2 The response

A paginated list is returned as `data` with an `items` array and a `meta`
object:

```json
{
  "success": true,
  "data": {
    "items": [
      { "id": "…", "rollNo": "42", "name": "Priya Sharma", "branchId": "…" }
    ],
    "meta": {
      "page": 2,
      "pageSize": 50,
      "total": 137,
      "totalPages": 3
    }
  },
  "timestamp": "2026-11-16T09:41:07.123Z"
}
```

| Field | Type | What it is |
|---|---|---|
| `items` | `array` | The records for this page |
| `meta.page` | `integer` | The page you asked for |
| `meta.pageSize` | `integer` | The page size actually used (after clamping) |
| `meta.total` | `integer` | How many records match the filter in total |
| `meta.totalPages` | `integer` | `ceil(total / pageSize)` |

**The paginated routes:** `GET /students`, `GET /users`, `GET /users/members`,
`GET /reports`, `GET /upload/jobs`, `GET /upload`, `GET /invites`,
`GET /notifications`, `GET /audit-logs`.

**A note on filters.** A list key on the frontend embeds the active filters,
so a bare prefix invalidation does not match it — the frontend invalidates
list prefixes explicitly for this reason.

### 4.3 The success envelope

Every non-paginated success uses the same wrapper:

```json
{
  "success": true,
  "data": { "…": "…" },
  "timestamp": "2026-11-16T09:41:07.123Z"
}
```

`data` may be an object, an array, `null`, or `true`.

---

## 5. Rate limits

### 5.1 The base tiers

Every route is limited. The base tiers apply unless the route overrides them:

| Tier | Window | Requests |
|---|---|---|
| `short` | 1 second | 3 |
| `medium` | 1 minute | 100 |
| `long` | 1 hour | 1000 |

The limits are per member (or per address for the public routes).

### 5.2 The per-route overrides

| Route | Limit | Window |
|---|---|---|
| `POST /auth/login` | 5 | 15 min |
| `POST /auth/forgot-password` | 5 | 15 min |
| `POST /auth/accept-invite` | 10 | 15 min |
| `POST /auth/reset-password` | 10 | 15 min |
| `GET /invites/validate` | 10 | 15 min |
| `POST /auth/refresh` | 20 | 15 min |
| `POST /auth/profile/avatar` | 20 | 1 hour |
| `POST /upload` | 10 | 1 hour |
| `POST /upload/file` | 10 | 1 hour |
| `POST /reports` | 5 | 1 hour |
| `POST /scheme-reader/read` | 10 | 1 hour |
| `POST /scheme-reader/read-file` | 10 | 1 hour |
| `GET /analytics/overview` | 30 | 1 min |
| `GET /dashboard` | 60 | 1 min |
| `GET /dashboard/header` | 120 | 1 min |
| `GET /dashboard/metrics` | 120 | 1 min |
| `GET /dashboard/sections` | 120 | 1 min |
| `GET /dashboard/recent-uploads` | 120 | 1 min |

**The shape is the point.** The expensive, abusable operations — getting a
token, generating a report, uploading a file, reading a syllabus — get small
per-hour budgets. The cheap reads get generous per-minute ones.

### 5.3 When a limit is hit

```json
{
  "success": false,
  "error": {
    "code": "TOO_MANY_REQUESTS",
    "message": "Too many requests. Please try again in a moment.",
    "retryAfter": 42
  },
  "timestamp": "2026-11-16T09:41:07.123Z",
  "path": "/api/v1/auth/login"
}
```

The response also carries a `Retry-After: 42` header. Wait that many seconds
and try again.

---

## 6. Permissions and scopes

### 6.1 How to read the columns

**Permission.** The permission string(s) the route requires.

| Notation | Meaning |
|---|---|
| `students:read` | The member must hold this one permission |
| `students:read`, `students:write` — **all of** | The member must hold **every** one of them |
| `marks:read`, `marks:enter_own_subject` — **any of** | The member must hold **at least one** of them |

A route naming several permissions under "all of" is a route whose
permissions are meant to be held **together**. A route naming several under
"any of" is one that different roles use through **different** rights — the
exam cell's and the teacher's, for instance.

**Scope.** The records the route is narrowed to. It is always derived from
the **authenticated caller**, never from a caller-supplied parameter. Asking
for a branch outside your scope is a **403**, not a silent redirect.

### 6.2 The three scope shapes

| Shape | What it means |
|---|---|
| **College-wide** | The member holds no branch-scoped role, so no branch filter applies |
| **Branch-scoped** | The member's `UserRole` rows name one or more branches; every read is narrowed to them |
| **Owned / allocated** | The member sees only what they personally hold — their own student record, the subjects they were allocated, the class they teach |

### 6.3 The permission catalogue

All 48 permissions, and who holds them.

| Permission | Super Admin | Admin | HOD | Principal | Teacher | Student |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| `students:read` | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| `students:read_own` | — | — | — | — | — | ✓ |
| `students:write` | — | ✓ | — | — | — | — |
| `students:read_sensitive` | ✓ | ✓ | — | — | — | — |
| `students:read_guardian` | ✓ | ✓ | ✓ | ✓ | — | — |
| `students:bulk_provision` | — | ✓ | — | — | — | — |
| `marks:read` | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| `marks:read_own` | — | — | — | — | — | ✓ |
| `marks:write` | — | ✓ | — | — | — | — |
| `marks:enter_own_subject` | — | ✓ | — | — | ✓ | — |
| `reports:read` | ✓ | ✓ | ✓ | ✓ | — | — |
| `reports:generate` | — | ✓ | ✓ | — | — | — |
| `reports:download` | — | ✓ | ✓ | ✓ | — | — |
| `upload:create` | — | ✓ | — | — | ✓ | — |
| `upload:read` | — | ✓ | ✓ | — | ✓ | — |
| `upload:process` | — | ✓ | — | — | — | — |
| `upload:process_own_subject` | — | — | — | — | ✓ | — |
| `analytics:read` | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| `analytics:read_own_department` | — | — | ✓ | — | — | — |
| `toppers:read` | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| `toppers:read_own_class` | — | — | — | — | — | ✓ |
| `dashboard:read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `users:read` | ✓ | — | — | — | — | — |
| `users:write` | ✓ | — | — | — | — | — |
| `rbac:read` | ✓ | — | — | — | — | — |
| `rbac:write` | ✓ | — | — | — | — | — |
| `audit:read` | ✓ | — | — | ✓ | — | — |
| `invites:read` | ✓ | — | — | — | — | — |
| `invites:write` | ✓ | — | — | — | — | — |
| `notifications:write` | — | ✓ | — | — | — | — |
| `branches:read` | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| `branches:write` | ✓ | — | — | — | — | — |
| `branches:delete` | ✓ | — | — | — | — | — |
| `schemes:read` | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| `schemes:write` | ✓ | — | — | — | — | — |
| `subjects:read` | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| `subjects:write` | — | ✓ | ✓ | — | — | — |
| `subjects:delete` | — | ✓ | — | — | — | — |
| `subject_offerings:read` | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| `subject_offerings:write` | — | ✓ | ✓ | — | — | — |
| `academic_years:read` | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| `academic_years:write` | ✓ | — | — | — | — | — |
| `examinations:read` | — | ✓ | — | — | — | — |
| `examinations:write` | — | ✓ | — | — | — | — |
| `teacher_allocations:read` | — | — | ✓ | — | ✓ | — |
| `teacher_allocations:write` | — | — | ✓ | — | — | — |
| `class_teacher_assignments:read` | — | — | ✓ | — | ✓ | — |
| `class_teacher_assignments:write` | — | — | ✓ | — | — | — |

**Three things the table says that a person might not expect:**

- **The Super Admin configures; they do not teach.** They hold no
  `students:write`, no `marks:write` and no `upload:create` — entering marks
  and creating students belong to the exam cell. They also hold no allocation
  permission: who teaches what is the HOD's decision.
- **The Principal is strictly read-only.** Thirteen permissions, no write of
  any kind.
- **The student holds four.** `dashboard:read`, `students:read_own`,
  `marks:read_own`, `toppers:read_own_class`. The roster, the mark sheet, the
  reports and the administration are all closed to them.

---

## 7. The endpoints

### 7.1 Authentication — `/auth`

`AuthController` and `PasswordResetController` share the `auth` prefix. All
the routes below are **public** (no session needed) except where noted.

| Method | Path | Permission | Scope | Returns | Errors |
|---|---|---|---|---|---|
| POST | `/auth/login` | *public* | — | The access/refresh token pair and the member's profile, roles and effective permissions | 400 (invalid body), 401 (*"Invalid credentials"*), 429 |
| POST | `/auth/refresh` | *public* | The refresh token itself | A **new** access token and a **new** refresh token (rotated) | 400, 401 (*"Invalid refresh token"*), 429 |
| POST | `/auth/forgot-password` | *public* | — | A confirmation that the reset email was sent. The same answer is given whether or not the address exists | 400, 429 |
| POST | `/auth/reset-password` | *public* | The one-time token | Nothing (200). The password is set | 400 (*"This reset link is invalid or has already been used."* / *"This reset link has expired"*), 429 |
| POST | `/auth/accept-invite` | *public* | The one-time token | The created account and its session tokens | 400 (*"This invitation has expired"* / *"This invitation is invalid or has already been used."*), 409 (*"An account with this email already exists"*), 429 |
| GET | `/auth/me` | member | The member's own record | The signed-in member's profile, roles, effective permissions and `mustChangePassword` flag | 401, 403 (password change pending) |
| PATCH | `/auth/profile` | member | The member's own record | The updated profile. Only `name` is editable — the email is not | 400, 401, 403 |
| POST | `/auth/profile/avatar` | member | The member's own record | The stored avatar URL. The previous picture is deleted | 400 (*"An image file is required"*), 401, 403, 429 (20/hour) |
| DELETE | `/auth/profile/avatar` | member | The member's own record | The updated member with no picture. The interface falls back to initials | 401, 403 |
| POST | `/auth/change-password` | member | The member's own account | Nothing (204). The password is set and the forced-change flag is cleared | 400 (*"Your current password is incorrect"* / *"The new password must be different from the current one"*), 401, 403 |
| POST | `/auth/logout` | member | The member's own session | Nothing (204). The current session is revoked | 401, 403 |
| POST | `/auth/logout-all` | member | Every session the member holds | Nothing (204). Every session is revoked | 401, 403 |

**Bodies.**

`POST /auth/login` — `email` (email), `password` (string, min 1).

`POST /auth/refresh` — `refreshToken` (string).

`POST /auth/forgot-password` — `email` (email).

`POST /auth/reset-password` — `token` (string, 32–128 chars), `password`
(string, 8–100 chars, must have an uppercase letter, a lowercase letter, a
digit and one of `@$!%*?&`).

`POST /auth/accept-invite` — `token` (string, 32–128 chars), `password`
(string, 8–72 chars, same pattern).

`POST /auth/change-password` — `currentPassword` (string, 1–72),
`password` (string, 8–72, same pattern).

`PATCH /auth/profile` — `name` (optional, 2–100 chars).

**Note on `POST /auth/profile/avatar`** — `multipart/form-data`, field
`file`. Maximum size is enforced by the interceptor.

---

### 7.2 Health — `/health`

All three routes are **public** and need no session.

| Method | Path | Permission | Scope | Returns | Errors |
|---|---|---|---|---|---|
| GET | `/health` | *public* | — | The health of the service, the database and the cache | — |
| GET | `/health/liveness` | *public* | — | `{ "status": "ok", "timestamp": "…" }` | — |
| GET | `/health/readiness` | *public* | — | Whether the service is ready to take traffic | 503 if a dependency is down |

---

### 7.3 Students — `/students`

| Method | Path | Permission | Scope | Returns | Errors |
|---|---|---|---|---|---|
| GET | `/students` | `students:read` | The caller's branch set; a college-scoped caller sees all | A paginated list of students | 400, 403 (a branch outside the scope) |
| POST | `/students` | `students:write` | The caller's branch **only** | The created student | 400, 403 (the branch is outside the scope), 409 (the roll number exists) |
| GET | `/students/own` | `students:read_own` | The caller's own record | The caller's own student record, whatever filters are sent | 403, 404 |
| GET | `/students/own/:studentId` | `students:read_own` | The caller's own record | The caller's own student record | 403 (the id is somebody else's), 404 |
| GET | `/students/:id` | `students:read` | The student's branch | The one student | 403 (outside the branch scope), 404 |
| GET | `/students/:id/profile` | `students:read` **or** `students:read_own` — **any of** | The student's own branch; **each section is included only if the caller may see it** | The student's whole academic journey — identity, academic snapshot, marks history, result history, documents, activity trail, available actions. A section the caller may not see is **absent from the payload**, not blank | 403, 404 |
| PUT | `/students/:id` | `students:write` | The student's branch | The updated student | 400, 403, 404, 409 |
| DELETE | `/students/:id` | `students:write` | The student's branch | Nothing (204). A **soft** delete — the history is kept | 400, 403, 404, 409 |
| POST | `/students/bulk-import` | `students:write` | Every row's branch is checked; a row outside the scope fails | The import outcome — what was created, what was skipped, and why each row failed | 400, 403, 409 |
| POST | `/students/bulk-import/file` | `students:write` | As above | As above, plus the file's own parse errors | 400 (*"Choose a CSV or Excel file to import."*), 403 |
| POST | `/students/:studentId/provision-login` | `students:write` | The student's branch | A new student account with `mustChangePassword: true` and a temporary password **returned exactly once**, or a link to the existing account | 400, 403, 404, 409 |
| POST | `/students/bulk-provision-logins` | `students:bulk_provision` | The named students' branches | The run's outcome — `created`, `linked` and `skipped` counts, each student's account, and each failure with its reason | 400, 403, 409 |

**Query parameters.**

`GET /students` — `page`, `pageSize`, `branchId`, `schemeId`, `semester`,
`academicYearId`, `search`.

**Bodies.**

`POST /students` — `rollNo`, `name`, `branchId`, `semester` (1+), `schemeId`,
`batchId`, `academicYearId` are required. Optional: `email`, `isActive`,
`dateOfBirth`, `gender`, `phone`, `alternateEmail`, `address`, `city`,
`state`, `pincode`, `photoUrl`, `bloodGroup`, `nationalId`,
`admissionYear`, `section`, `reservedCategory`, `feeCategory`,
`scholarshipRecipient`, the guardian fields (`guardianName`,
`guardianRelation`, `guardianPhone`, `guardianEmail`, `guardianOccupation`,
and the same five again as `guardian2*`), `status`, `statusReason`,
`statusDate`.

`POST /students/bulk-import` — `rows` (array, max 5000). Each row needs
`rollNo` and `name`, and may carry `branchId`, `schemeId`, `batchId`,
`academicYearId`, `semester`. The top level may carry the same context.

`POST /students/bulk-import/file` — `multipart/form-data`, field `file`
(CSV or Excel, max 5 MB). The class context comes from the query string:
`branchId`, `schemeId`, `batchId`, `academicYearId`, `semester`.

`POST /students/:studentId/provision-login` — `email` (optional).

`POST /students/bulk-provision-logins` — either a class scope
(`branchId`, `semester`, `schemeId`, `academicYearId`) **or** `studentIds`
(array, 1–500) — not both. Optional: `skipMissingEmail`.

**The profile's sections.** The response carries only the sections the
caller is entitled to:

| Section | Needs | A teacher | An HOD | The Principal | The exam cell | A student |
|---|---|---|---|---|---|---|
| Identity and contact | `students:read` | ✓ | ✓ | ✓ | ✓ | ✓ (own) |
| Sensitive identity (national id, blood group) | `students:read_sensitive` | — | — | — | ✓ | ✓ (own) |
| Guardians | `students:read_guardian` | — | ✓ | ✓ | ✓ | ✓ (own) |
| Marks | the caller's allocation | own subjects only | branch | branch | branch | own |
| Result history | the caller's allocation | own subjects only | branch | branch | branch | own |
| Activity trail | `audit:read` | — | — | ✓ | ✓ | — |

---

### 7.4 The student's own record — `/my-result`, `/my-toppers`, `/my/student`

Every route here resolves the student **from the session**. There is no
student id in the path that could address somebody else — except
`/my/student/:studentId`, which the server checks against the session and
refuses with 403 if it is somebody else's.

| Method | Path | Permission | Scope | Returns | Errors |
|---|---|---|---|---|---|
| GET | `/my-result` | `students:read_own` | The caller's own record | The signed-in student's own result for their class | 403, 404 |
| GET | `/my-toppers` | `toppers:read_own_class` | The caller's own class | The leaderboard of the student's own class. Query: `limit` | 403, 404 |
| GET | `/my/student` | `students:read_own` | The caller's own record | The signed-in student's own record | 403, 404 |
| GET | `/my/student/:studentId` | `students:read_own` | The caller's own record | The caller's own student record | 403 (a foreign id), 404 |

---

### 7.5 Marks — `/marks`

| Method | Path | Permission | Scope | Returns | Errors |
|---|---|---|---|---|---|
| GET | `/marks` | `marks:read` **or** `marks:enter_own_subject` — **any of** | A teacher sees only the subjects they were allocated; a branch-wide reader sees their branch | The matching marks | 403 (a subject they are not allocated to), 400 |
| GET | `/marks/:id` | `marks:read` **or** `marks:enter_own_subject` — **any of** | Resolved from the mark, not from a parameter | The one mark | 403, 404 |
| GET | `/marks/calculate/class` | `marks:read` **or** `marks:enter_own_subject` — **any of** | Their own class, a class they teach, or a branch-wide reach | Every student's calculated result for the class | 400, 403, 404 (*"Choose the semester to calculate."*) |
| GET | `/marks/calculate/:studentId` | `marks:read` **or** `marks:enter_own_subject` — **any of** | The student's branch, and the class they teach | The student's result, calculated with the scheme-aware calculator (2019 / 2022 / 2024) | 403, 404 |
| POST | `/marks` | `marks:enter_own_subject` **or** `marks:write` — **any of** | A teacher writes only their allocated offerings | The created or updated mark | 400, 403 (*"You are not allocated to Computer Networks, so you cannot enter its marks."*), 404 |
| POST | `/marks/bulk` | `marks:enter_own_subject` **or** `marks:write` — **any of** | **Refused whole** if any row is not allowed | The result of the bulk upsert | 400, 403 (the whole batch is refused) |
| PUT | `/marks/:id` | `marks:enter_own_subject` **or** `marks:write` — **any of** | Resolved from the mark, not from a parameter | The updated mark | 400, 403, 404 |
| DELETE | `/marks/:id` | `marks:enter_own_subject` **or** `marks:write` — **any of** | Resolved from the mark, not from a parameter | Nothing (204) | 403, 404 |
| POST | `/marks/correct` | `marks:write` | The exam cell's scope; **needs a reason** | The corrected mark | 400, 403, 404 |

**Query parameters.**

`GET /marks` — `studentId`, `subjectId`, `subjectOfferingId`, `examType`,
`academicYearId`, `branchId`.

`GET /marks/calculate/class` — `branchId`, `schemeId`, `semester`,
`academicYearId` (all four name the class).

`GET /marks/calculate/:studentId` — `academicYearId`.

**Bodies.**

`POST /marks` — `studentId`, `subjectOfferingId`, `examType`, `marksObtained`
(0+), `maxMarks` (1+), `academicYearId` required. Optional: `isAbsent`,
`isWithheld`, `remarks`.

`examType` is one of `CA1`, `CA2`, `MID_SEM`, `WRITTEN`, `PRACTICAL`,
`ORAL`.

`POST /marks/bulk` — `marks`: an array of 1+ `CreateMarkDto` objects.

`PUT /marks/:id` — `marksObtained`, `maxMarks`, `isAbsent`, `isWithheld`,
`remarks`. The identity fields (`studentId`, `subjectOfferingId`,
`examType`, `academicYearId`) cannot be changed.

`POST /marks/correct` — the `CreateMarkDto` fields **plus** `reason`
(string, 1–500 chars, required).

**Who writes a mark.** The exam cell defines what a subject is worth; the
teacher writes what a student scored.

- A **teacher** may write only for the offerings the HOD allocated to them,
  for that academic year. Class-teacher status grants nothing here.
- The **exam cell** may write any offering in scope — but **not** one a
  teacher holds an allocation for. That is a *correction*: a separate
  operation that needs a reason, is recorded under its own audit action,
  keeps the value it replaced on a revision row, and names the teacher whose
  work it replaced.

A correction keeps the mark it replaced in a `MarkRevision` row — the value
before, the value after, the reason, who made it, and whose entry it was.

---

### 7.6 Reports — `/reports`

| Method | Path | Permission | Scope | Returns | Errors |
|---|---|---|---|---|---|
| GET | `/reports` | `reports:read` | The caller's branch set | A paginated list of live reports | 400, 403 |
| GET | `/reports/:id` | `reports:read` | The report's branch | The one report | 403, 404 |
| GET | `/reports/:id/download` | `reports:download` | The report's branch | The report as an Excel file (`Content-Disposition: attachment`) | 403, 404 |
| GET | `/reports/readiness` | `reports:read` | The named scope | Whether the class's result is complete enough to report on, and what is still missing | 400 (*"Name the branch to check. You have access to more than one branch."*), 403 |
| POST | `/reports` | `reports:generate` | The caller's branch; the rate limit is **5 an hour** | The queued generation job | 400, 403, 429 |
| DELETE | `/reports/:id` | `reports:generate` | The report's branch | Nothing (204). The report is **archived**, never deleted — the row is kept with the reason and who archived it | 400, 403, 404 |

**Bodies.**

`POST /reports` — `type` (one of `STUDENT_WISE`, `SCHEME_WISE`,
`SUBJECT_ANALYSIS`, `STUDENT_ANALYSIS`, `CLASS_TOPPERS`, `PASS_FAIL`,
`COMPLETE`) and `filters` (an object, typically `{ branchId, schemeId,
semester, academicYearId }`).

`DELETE /reports/:id` — `reason` (string, 10–500 chars, required).

**Query parameters.**

`GET /reports` — `page`, `pageSize`, `status`, `type`, `generatedBy`,
`branchId`.

`GET /reports/readiness` — `branchId`, `schemeId`, `semester`,
`academicYearId`.

---

### 7.7 Examinations — `/examinations`

The result lifecycle: `PENDING → PROCESSING → PUBLISHED`.

| Method | Path | Permission | Scope | Returns | Errors |
|---|---|---|---|---|---|
| GET | `/examinations` | `examinations:read` | The caller's branch set | The examinations, with how ready each result is | 400, 403 |
| GET | `/examinations/:id` | `examinations:read` | The examination's branch | The one examination | 403, 404 |
| POST | `/examinations` | `examinations:write` | The caller's branch | The created examination | 400, 403, 409 |
| POST | `/examinations/:id/publish` | `examinations:write` | The examination's branch | The published examination, with `resultPublishedAt` set. **Refused unless every student in the class has a complete result** | 400, 403, 404, 409 |
| DELETE | `/examinations/:id/publish` | `examinations:write` | The examination's branch | The examination, returned to being worked on. The marks are not changed — a correction is a separate act | 400, 403, 404, 409 |

**Bodies.**

`POST /examinations` — `name`, `branchId`, `semester`, `schemeId`,
`academicYearId`, `examDate`.

**Query parameters.**

`GET /examinations` — `branchId`, `semester`, `academicYearId`.

---

### 7.8 Members — `/users`

| Method | Path | Permission | Scope | Returns | Errors |
|---|---|---|---|---|---|
| GET | `/users` | `users:read` | The caller's branches | A paginated list of users | 400, 403 |
| GET | `/users/members` | `users:read` | The caller's branches | A paginated list of members **with their assigned roles** | 400, 403 |
| GET | `/users/roles` | `users:read` | — | The assignable roles and their member counts | 400, 403 |
| GET | `/users/:id` | `users:read` | — | The one member | 403, 404 (*"That member no longer exists."*) |
| GET | `/users/:id/revocation-impact` | `users:write` | — | What revoking this member would do — the counts, and the consequences **in sentences** | 404 |
| POST | `/users` | `users:write` | — | The created member | 400, 409 |
| PUT | `/users/:id` | `users:write` | — | The updated member | 400, 404, 409 |
| DELETE | `/users/:id` | `users:write` | — | Nothing (204). The full revocation lifecycle: the account is deactivated, the sessions are revoked, the pending invitations are withdrawn, the allocations and class-teacher assignments are released, the roles are removed — and **the history is kept** | 400 (*"You cannot revoke your own account."* / *"Give a reason for revoking this member."* / *"<name> is already revoked."*), 404 |
| POST | `/users/:id/restore` | `users:write` | — | Nothing (204). The account is restored. **The allocations and roles are not given back automatically** | 400 (*"Give a reason for restoring this member."* / *"<name> is already active."*), 404 |

**Query parameters.**

`GET /users` — `page`, `pageSize`, `search`, `isActive`.

`GET /users/members` — `search`, `role`, `branchId`, `page`, `pageSize`.

**Bodies.**

`POST /users` — `email`, `name` (2–100), `password` (8–72, with an uppercase
letter, a lowercase letter, a digit and one of `@$!%*?&`). Optional:
`isActive`.

`PUT /users/:id` — `email`, `name`, `isActive`, `password` — all optional.

`DELETE /users/:id` and `POST /users/:id/restore` — `reason` (string, 1–500,
required).

**The revocation preview.** `GET /users/:id/revocation-impact` returns the
counts and the consequences in the language the administrator reads:

> This will remove 3 subject allocations and 1 class teacher assignment.
> Computer Science · Semester 5 will have no class teacher.

The client is expected to show this **before** the member confirms the
revocation.

---

### 7.9 Roles — `/roles`

| Method | Path | Permission | Scope | Returns | Errors |
|---|---|---|---|---|---|
| GET | `/roles` | `rbac:read` | — | All roles | 400, 403 |
| GET | `/roles/:id` | `rbac:read` | — | The one role | 404 (*"Role not found"*) |
| GET | `/roles/:id/permissions` | `rbac:read` | — | The permissions granted to the role | 404 |
| POST | `/roles` | `rbac:write` | — | The created role | 400, 409 |
| PUT | `/roles/:id` | `rbac:write` | — | The updated role | 400, 404 |
| PUT | `/roles/:id/permissions` | `rbac:write` | — | Nothing. The role's permission set is **replaced** | 400, 404 |
| DELETE | `/roles/:id` | `rbac:write` | — | Nothing (204) | 404 |

**Bodies.**

`POST /roles` — `name` (1–50), `description` (optional, ≤255), `isActive`
(optional).

`PUT /roles/:id/permissions` — `permissionIds`: an array of unique permission
ids.

---

### 7.10 Permissions — `/permissions`

| Method | Path | Permission | Scope | Returns | Errors |
|---|---|---|---|---|---|
| GET | `/permissions` | `rbac:read` | — | All permissions | 400, 403 |
| GET | `/permissions/:id` | `rbac:read` | — | The one permission | 404 (*"Permission not found"*) |
| POST | `/permissions` | `rbac:write` | — | The created permission | 400, 409 |
| PUT | `/permissions/:id` | `rbac:write` | — | The updated permission | 400, 404 |
| DELETE | `/permissions/:id` | `rbac:write` | — | Nothing (204) | 404 |

**Bodies.**

`POST /permissions` — `name` (≤100), `resource` (≤50), `action` (≤50),
`description` (optional).

---

### 7.11 A member's roles — `/user-roles`

| Method | Path | Permission | Scope | Returns | Errors |
|---|---|---|---|---|---|
| GET | `/user-roles/:userId` | `rbac:read` | — | The roles assigned to that member, with their branch scope | 404 (*"This member has no roles assigned."*) |
| POST | `/user-roles` | `rbac:write` | The member's branch scope | The granted role assignment | 400, 403, 404 |
| DELETE | `/user-roles` | `rbac:write` | The member's branch scope | Nothing. The role is taken back | 400, 403, 404 |

**Bodies.** Both take the same shape: `userId` (required), `roleName`
(required), `branchId` (optional — required for a branch-scoped role).

**The refusals.** A role may not be granted twice for the same branch; a
branch-scoped role requires a branch; `SUPER_ADMIN` cannot be granted through
this route; a member may not appoint a peer; a branch-scoped member may not
appoint into a branch they do not work in.

---

### 7.12 Branches — `/branches`

| Method | Path | Permission | Scope | Returns | Errors |
|---|---|---|---|---|---|
| GET | `/branches` | `branches:read` | All | The branches the caller may work in | 400, 403 |
| GET | `/branches/:id` | `branches:read` | The caller's branches | The branch — or `null` if it is outside the caller's scope | 403, 404 |
| POST | `/branches` | `branches:write` | — | The created branch | 400, 409 |
| PUT | `/branches/:id` | `branches:write` | — | The updated branch | 400, 404 |
| DELETE | `/branches/:id` | `branches:delete` | — | Nothing (204). Blocked when the branch carries records | 400, 404, 409 |

**Bodies.**

`POST /branches` — `code` (1–10 chars), `name` (1–100), `isActive`
(optional).

**Note.** `branches:delete` is a **separate permission** from
`branches:write`. A member who may edit a branch may not delete one.

---

### 7.13 Schemes — `/schemes`

| Method | Path | Permission | Scope | Returns | Errors |
|---|---|---|---|---|---|
| GET | `/schemes` | `schemes:read` | All | The schemes | 400, 403 |
| GET | `/schemes/:id` | `schemes:read` | All | The one scheme | 404 |
| POST | `/schemes` | `schemes:write` | — | The created scheme | 400, 409 |
| PUT | `/schemes/:id` | `schemes:write` | — | The updated scheme. A scheme with offerings is **versioned, not overwritten** | 400, 404, 409 |
| DELETE | `/schemes/:id` | `schemes:write` | — | Nothing (204) | 400, 404, 409 |

**Bodies.**

`POST /schemes` — `name` (`SCHEME_2019`, `SCHEME_2022` or `SCHEME_2024`),
`description`, `rules` (an object), `effectiveFrom` (ISO date). Optional:
`isActive`.

---

### 7.14 Subjects — `/subjects`

| Method | Path | Permission | Scope | Returns | Errors |
|---|---|---|---|---|---|
| GET | `/subjects` | `subjects:read` | The caller's branch set | The subject catalogue | 400, 403 |
| GET | `/subjects/:id` | `subjects:read` | The caller's branch set | The subject, with the places it is offered (filtered to the caller's branches) | 403, 404 |
| POST | `/subjects` | `subjects:write` | — | The created subject | 400, 409 |
| PUT | `/subjects/:id` | `subjects:write` | — | The updated subject | 400, 404 |
| DELETE | `/subjects/:id` | `subjects:delete` | — | Nothing (204). The subject is **deactivated**, not hard-deleted. Blocked when the subject carries marks | 400, 404, 409 |

**Query parameters.** `GET /subjects` — `branchId`, `schemeId`, `semester`,
`academicYearId`, `isActive`.

**Bodies.**

`POST /subjects` — `code`, `name`, `credits` (1+), `maxMarks` (1+),
`passingMarks` (0+). Optional: `components` (an array of
`{ type, maxMarks, passingMarks?, weightage? }`), `isActive`.

---

### 7.15 Subject offerings — `/subject-offerings`

An offering is a **placement** — "this subject runs in this branch, this
semester, this scheme". It has its own permissions because it is a different
record with a different owner.

| Method | Path | Permission | Scope | Returns | Errors |
|---|---|---|---|---|---|
| GET | `/subject-offerings` | `subject_offerings:read`, `subjects:read` — **all of** | The caller's branch set | The offerings | 400, 403 |
| GET | `/subject-offerings/:id` | `subject_offerings:read`, `subjects:read` — **all of** | The offering's branch | The offering — or `null` if it does not exist or is outside the scope | 403, 404 |
| POST | `/subject-offerings` | `subject_offerings:write` | The caller's branch | The created offering | 400, 403, 409 |
| PUT | `/subject-offerings/:id` | `subject_offerings:write` | The offering's branch | The updated offering — or `null` if it does not exist or is outside the scope | 400, 403, 404 |
| DELETE | `/subject-offerings/:id` | `subject_offerings:write` **or** `subjects:delete` — **any of** | The offering's branch | Nothing (204). The offering is deactivated | 400, 403, 404 |

**Query parameters.** `GET /subject-offerings` — `subjectId`, `branchId`,
`schemeId`, `academicYearId`, `semester`, `isActive`.

**Bodies.** `POST /subject-offerings` — `subjectId`, `branchId`, `semester`
(1+), `schemeId` required; `academicYearId` optional.

---

### 7.16 Teacher allocations — `/teacher-allocations`

"This teacher teaches this subject." It is what gives the teacher the right
to enter marks for that subject.

| Method | Path | Permission | Scope | Returns | Errors |
|---|---|---|---|---|---|
| GET | `/teacher-allocations` | `teacher_allocations:read` | The caller's branch set | The allocations | 400, 403 |
| GET | `/teacher-allocations/assignable-teachers` | `teacher_allocations:read` | The branch's teachers only | The teachers who may be allocated a subject in that branch | 400, 403 |
| POST | `/teacher-allocations` | `teacher_allocations:write` | The caller's branch | The created allocation | 400, 403, 409 |
| DELETE | `/teacher-allocations/:id` | `teacher_allocations:write` | The caller's branch | Nothing (204). The allocation is released; **the marks already entered under it are preserved**, and their author stays readable | 400, 403, 404 |

**Query parameters.** `GET /teacher-allocations` — `branchId`, `semester`,
`academicYearId`, `teacherId`, `subjectOfferingId`.

**Bodies.** `POST /teacher-allocations` — `teacherId`, `subjectOfferingId`,
`academicYearId`.

---

### 7.17 Class-teacher assignments — `/class-teacher-assignments`

"This teacher is the class teacher." It gives the teacher the right to see
the class's statistics. **Granting one does not grant the other**, and
neither is granted by simply being a teacher.

| Method | Path | Permission | Scope | Returns | Errors |
|---|---|---|---|---|---|
| GET | `/class-teacher-assignments` | `class_teacher_assignments:read` | The caller's branch set | The assignments | 400, 403 |
| GET | `/class-teacher-assignments/needs-teacher` | `class_teacher_assignments:read` | The caller's branch set | The classes that have students and **no** class teacher | 400, 403 |
| POST | `/class-teacher-assignments` | `class_teacher_assignments:write` | The caller's branch | The assignment. Replacing an existing teacher needs `replacesExisting` — **an unconfirmed replacement is refused with a 409 naming the current class teacher** | 400, 403, 404, 409 |
| DELETE | `/class-teacher-assignments/:id` | `class_teacher_assignments:write` | The caller's branch | Nothing (204) | 400, 403, 404 |

**Query parameters.** `GET /class-teacher-assignments` — `branchId`,
`semester`, `academicYearId`, `teacherId`. `GET .../needs-teacher` —
`branchId`, `semester`, `academicYearId`.

**Bodies.** `POST /class-teacher-assignments` — `teacherId`, `branchId`,
`semester`, `schemeId`, `academicYearId`, and `replacesExisting` (boolean) to
confirm a replacement.

**The replacement is one operation, not two.** The backend replaces in a
single transaction, so the class is never left without a teacher because a
second step failed.

---

### 7.18 Class overview — `/class-overview`

The routes are scoped to the session. There is no branch, semester or
teacher id in the path — a member can only ever read the classes they are the
class teacher of, whatever the client sends.

| Method | Path | Permission | Scope | Returns | Errors |
|---|---|---|---|---|---|
| GET | `/class-overview` | `class_teacher_assignments:read` | The member's own class assignments | The classes the member is the class teacher of. **An empty array is a valid state**, not an error | 403 |
| GET | `/class-overview/:assignmentId` | `class_teacher_assignments:read` | That assignment | The class's overview — the students, their results, and the class's statistics | 403, 404 |

---

### 7.19 Academic years and batches — `/academic`

| Method | Path | Permission | Scope | Returns | Errors |
|---|---|---|---|---|---|
| GET | `/academic/years` | `students:read` | All | The academic years, the running one first | 400, 403 |
| GET | `/academic/years/:id` | `students:read` | All | The one academic year | 404 |
| POST | `/academic/years` | `academic_years:write` | — | The created academic year | 400 (*"Give the dates the year runs between, as YYYY-MM-DD."*), 409 (*"<year> is already an academic year."*) |
| POST | `/academic/years/:id/activate` | `academic_years:write` | — | The newly running academic year. The previous one is retired **in the same transaction**, so the college never sees a moment with two active years | 404 (*"That academic year no longer exists."*), 409 (*"<year> is already the running academic year."*) |
| GET | `/academic/batches` | `students:read` | All | The batches. Query: `admissionYearId` | 400, 403 |

**Bodies.** `POST /academic/years` — `year` (`YYYY-MM` or `YYYY-MMMM`),
`startDate`, `endDate` (both ISO dates), `isActive` (optional).

---

### 7.20 Uploads — `/upload`

The three-way ingestion pipeline: CSV, text PDF, and image PDF by OCR — with
review before confirm.

| Method | Path | Permission | Scope | Returns | Errors |
|---|---|---|---|---|---|
| GET | `/upload/jobs` | `upload:read` | The caller's own uploads and their branch's | A paginated list of upload jobs | 400, 403 |
| GET | `/upload` | `upload:read` | The caller's own uploads and their branch's | A paginated list of upload jobs | 400, 403 |
| GET | `/upload/jobs/:jobId` | `upload:read` | The job's owner or their branch | The job, with its status and progress | 403, 404 |
| POST | `/upload` | `upload:create` | The caller's branch | The queued job | 400, 403, 429 (10/hour) |
| POST | `/upload/file` | `upload:create` | The caller's branch | The queued job. `multipart/form-data`, field `file`, max 50 MB | 400, 403, 429 (10/hour) |
| POST | `/upload/jobs/:jobId/confirm` | `upload:process` **or** `upload:process_own_subject` — **any of** | Writes marks: a teacher's own allocations only; **the exam cell may not overwrite a teacher's subject** | The rows that were written | 400, 403, 404 |
| DELETE | `/upload/:id` | `upload:process` | The job's owner | Nothing (204) | 403, 404 |

**Query parameters.** `GET /upload/jobs` — `page`, `pageSize`, `status`.
`GET /upload` — `page`, `pageSize`, `status`, `uploadedBy`.

**Bodies.**

`POST /upload` — `fileName`, `fileType` (`EXCEL`, `PDF_TEXT` or
`PDF_IMAGE`), `fileUrl`, `fileSize`, `metadata` (optional).

`POST /upload/file` — `multipart/form-data`, field `file`.

`POST /upload/jobs/:jobId/confirm` — `rows` (the extracted rows the reviewer
approved) and `metadata` (optional).

**The confirm path is a write path.** It is guarded on the two **write**
permissions, not on `upload:read`. It used to be guarded on `upload:read` —
a permission to *look* at an upload — which is a guard that does not guard
the thing it protects.

---

### 7.21 OCR — `/ocr`

| Method | Path | Permission | Scope | Returns | Errors |
|---|---|---|---|---|---|
| POST | `/ocr/extract` | `upload:process` | — | The extracted text and tables | 400, 403, 404, 500 |
| GET | `/ocr/jobs/:jobId/status` | `upload:read` | The job's owner, or a college-wide member | The job's latest OCR status | 403, 404 |
| POST | `/ocr/process/:jobId` | `upload:process` | The job's owner, or a college-wide member | The job, re-queued for OCR | 403, 404 |

**Bodies.** `POST /ocr/extract` — `fileUrl` (a URL this server issued, or a
file already in storage), `modelHint` (optional: `text` or `table`).

**The URL is checked before the server visits it.** A `fileUrl` in a request
body is an instruction to fetch something. The URL guard refuses an address
that is not `http`/`https`, that names a blocked host, or that **resolves**
to a loopback, private, link-local, carrier-grade NAT or reserved address.
The resolution check is the half that matters — a public-looking name that
resolves to `10.0.0.1` passes a name-only check.

---

### 7.22 PDF parser — `/pdf-parser`

| Method | Path | Permission | Scope | Returns | Errors |
|---|---|---|---|---|---|
| POST | `/pdf-parser/parse` | `upload:process` | — | The text extracted from the PDF | 400, 403, 404 |

**Bodies.** `POST /pdf-parser/parse` — `fileUrl`.

---

### 7.23 The scheme reader — `/scheme-reader`

Reading a syllabus PDF into subjects. **Nothing is written until the reviewer
confirms.**

| Method | Path | Permission | Scope | Returns | Errors |
|---|---|---|---|---|---|
| GET | `/scheme-reader/availability` | `schemes:read` | — | Whether the automatic reading is available, and — when it is not — the reassurance that the scheme can still be entered by hand | 403 |
| GET | `/scheme-reader/sample` | *public* | — | The sample syllabus PDF, as a download (`Content-Disposition: attachment; filename="sample-scheme.pdf"`). It is the **same document the reader is tested against**, so a user can see the table the reader looks for before uploading their own | 404 (*"The sample document is not available on this system. Download the scheme PDF from the university website instead."*) |
| POST | `/scheme-reader/read` | `schemes:read` | — | The courses read from the document, **for review**. Nothing is written | 400, 403, 404, 503 (the AI provider is unavailable) |
| POST | `/scheme-reader/read-file` | `schemes:read` | — | As above. `multipart/form-data`, field `file`, max 20 MB | 400, 403, 503 |
| POST | `/scheme-reader/confirm` | `subjects:write` | The caller's branch | The counts: subjects and offerings created, updated and skipped | 400, 403, 409 |

**Bodies.**

`POST /scheme-reader/read` — `fileUrl` (a URL this server issued), `fileName`,
`branchId`, `academicYearId`.

`POST /scheme-reader/read-file` — `multipart/form-data`, field `file`, plus
`branchId` and `academicYearId` in the body.

`POST /scheme-reader/confirm` — `branchId`, `academicYearId`, `schemeId`, and
`courses`: the array the reviewer confirmed, each with `courseCode`,
`courseName`, and optionally `courseType`, `semester`, `theoryHours`,
`practicalHours`, `ca`, `mse`, `ese`, `credits`, `options`, `pageNumber`.

**The read response.** It carries the courses, the `warnings` (rows the
reader was unsure about), the `rejected` rows and why they were rejected, and
the `guard` block: `isSafe`, the per-page `verdicts`, `refusedPages`, and
`uncheckedPages`.

**`uncheckedPages` matters.** A page that could not be checked is **not** a
page that was checked and found safe. The reviewer is told which pages to
look at themselves.

**A course row's `ca` / `mse` / `ese` may be `null`** — never `0`. A dash in
the table means "this course has no mid-semester exam", which is not the same
as "this course has a mid-semester exam worth zero marks".

---

### 7.24 Analytics — `/analytics`

Every route narrows to the caller's scope. `academicYearId` is optional
everywhere: when it is omitted the service falls back to the running
academic year.

| Method | Path | Permission | Scope | Returns | Errors |
|---|---|---|---|---|---|
| GET | `/analytics/overview` | `analytics:read` | The caller's scope | The high-level picture: students, subjects, pass %, average % | 400, 403, 429 (30/min) |
| GET | `/analytics/pass-fail` | `analytics:read` | The caller's scope | The detailed pass/fail breakdown, with class buckets | 400, 403 |
| GET | `/analytics/subjects` | `analytics:read` | The caller's scope | The per-subject statistics and difficulty rating | 400, 403 |
| GET | `/analytics/subject-difficulty` | `analytics:read` | The caller's scope | The per-subject difficulty rating | 400, 403 |
| GET | `/analytics/performance-trends` | `analytics:read` | The caller's scope | The year-over-year performance trends | 400, 403 |

**Query parameters.** `branchId`, `schemeId`, `semester`, `academicYearId`.

---

### 7.25 Toppers — `/toppers`

| Method | Path | Permission | Scope | Returns | Errors |
|---|---|---|---|---|---|
| GET | `/toppers/class` | `toppers:read` | The caller's branch set | The class leaderboard. Query: `academicYearId`, `branchId`, `schemeId`, `semester`, `limit`, `rankingRule` | 400 (*"Unsupported ranking rule …"*), 403 |
| POST | `/toppers/class` | `analytics:read` | The caller's branch set | The class leaderboard with an **explicit** ranking rule | 400, 403 |
| GET | `/toppers/subject` | `toppers:read` | The caller's branch set | The subject-wise toppers (raw aggregate mode) | 400, 403 |
| GET | `/toppers/subject-wise` | `toppers:read` | The caller's branch set | The per-subject toppers, with tie handling | 400, 403 |
| POST | `/toppers/subject-wise` | `toppers:read` | The caller's branch set | As above, with the class named in the body | 400, 403 |
| GET | `/toppers/rules` | `analytics:read` | — | The available ranking rules | 400, 403 |

**Query parameters.** `GET /toppers/class` — `academicYearId`, `branchId`,
`schemeId`, `semester`, `limit`, `rankingRule` (`percentage`, `credits` or
`marks`).

**Bodies.** The two POST routes take `branchId`, `schemeId`, `semester`,
`academicYearId` (all required), plus `rule` and `limit` (optional).

---

### 7.26 Dashboard — `/dashboard`

The payload is **role-aware**: the scope and the metrics are decided from the
caller's effective permissions, so a member holding several roles gets the
union of what those roles allow. The `branchId`, `schemeId` and `semester`
parameters only narrow within the caller's own scope — they can never widen
it.

| Method | Path | Permission | Scope | Returns | Errors |
|---|---|---|---|---|---|
| GET | `/dashboard` | `dashboard:read` | The caller's scope: own, class, branch, or college | The whole dashboard — the scope block, the KPI cards and the chart sections | 400, 403, 429 (60/min) |
| GET | `/dashboard/header` | `dashboard:read` | The caller's scope | The scope block — the fastest part of the dashboard | 403, 429 (120/min) |
| GET | `/dashboard/metrics` | `dashboard:read` | The caller's scope | The KPI cards | 400, 403, 429 (120/min) |
| GET | `/dashboard/sections` | `dashboard:read` | The caller's scope | The chart blocks — the heaviest block, isolated so it never holds the metric cards hostage | 400, 403, 429 (120/min) |
| GET | `/dashboard/recent-uploads` | `dashboard:read` | The caller's scope | The latest upload jobs | 403, 429 (120/min) |

**Query parameters.** `branchId`, `schemeId`, `semester`.

**Why the four sub-routes.** The web app requests `header` first so the page
title and scope banner can render while the KPIs and charts are still being
computed, then `metrics`, then `sections`.

---

### 7.27 Audit logs — `/audit-logs`

| Method | Path | Permission | Scope | Returns | Errors |
|---|---|---|---|---|---|
| GET | `/audit-logs` | `audit:read` | The caller's scope — a branch-scoped member sees only their branch's events | A paginated list of audit entries | 400, 403 |
| GET | `/audit-logs/facets` | `audit:read` | The caller's scope | The distinct actions, resources and users in the trail, for the filter dropdowns | 403 |
| GET | `/audit-logs/:id` | `audit:read` | The caller's scope | The one audit entry | 403, 404 |

**Query parameters.** `GET /audit-logs` — `page`, `pageSize`, `userId`,
`action` (a comma-separated list is allowed), `resource` (a comma-separated
list is allowed), `fromDate`, `toDate`, `search`, `ipAddress`.

**What is recorded.** Every academic mutation, with who / what / when / why.
The `action` values are `CREATE`, `UPDATE`, `DELETE`, `BULK_IMPORT`,
`CONFIRM`, `CORRECTION`, `GRANT`, `REVOKE`, `DEACTIVATE`, `ARCHIVE` (plus
`LOGIN` for sign-ins). The `resource` values are `student`, `subject`,
`subject_offering`, `mark`, `branch`, `scheme`, `teacher_allocation`,
`class_teacher_assignment`, `upload_job`, `user`, `report`,
`academic_year`, `examination`.

---

### 7.28 Invitations — `/invites`

| Method | Path | Permission | Scope | Returns | Errors |
|---|---|---|---|---|---|
| GET | `/invites` | `invites:read` | The caller's branches, **plus the ones they raised** | A paginated list of invitations, newest first | 400, 403 |
| GET | `/invites/counts` | `invites:read` | The same set as the list | The invitation counts per status | 403 |
| POST | `/invites` | `invites:write` | — | The created invitation, with the acceptance URL so it can be copied manually | 400 (*"You cannot invite yourself"*, *"That role cannot be assigned through an invitation"*), 403 (*"You cannot invite someone into a branch you do not work in."*), 409 (*"An account with this email already exists"*), 429 |
| POST | `/invites/:id/resend` | `invites:write` | The invitation's branch | A freshly issued invitation and a new email | 400 (*"This invitation has already been accepted"*), 403, 404, 429 |
| POST | `/invites/:id/revoke` | `invites:write` | The invitation's branch | The revoked invitation | 400 (*"Only a pending invitation can be revoked"*), 403, 404, 429 |
| GET | `/invites/validate` | *public* | The token | The invitation's details, for the acceptance screen | 400 (*"A token is required"* / *"This invitation has expired"*), 429 |

**Query parameters.** `GET /invites` — `status` (`PENDING`, `ACCEPTED`,
`REVOKED` or `EXPIRED`), `search`, `page`, `pageSize`.
`GET /invites/validate` — `token`.

**Bodies.** `POST /invites` — `email`, `name` (2–100), `roleName` (one of
`ADMIN`, `HOD`, `PRINCIPAL`, `TEACHER`, `STUDENT`), `branchId` (optional, but
**required** for a branch-scoped role and **forbidden** for a non-branch-scoped
one).

**`SUPER_ADMIN` cannot be invited.** The role is set by the system
administrator alone.

---

### 7.29 Notifications — `/notifications`

Every route here acts on the caller's own notifications, so none of them
needs a permission — the ownership is checked instead.

| Method | Path | Permission | Scope | Returns | Errors |
|---|---|---|---|---|---|
| GET | `/notifications` | member-scoped | The caller's own | A paginated list of the member's notifications. Query: `page`, `pageSize`, `unreadOnly` | 400, 403 |
| POST | `/notifications` | `notifications:write` | — | The created notification | 400, 403 |
| POST | `/notifications/:id/read` | member-scoped | The caller's own | The notification, marked as read | 403, 404 |
| POST | `/notifications/read-all` | member-scoped | The caller's own | Nothing. Every notification is marked read | 403 |
| DELETE | `/notifications/:id` | member-scoped | The caller's own | Nothing (204) | 403, 404 |

**Bodies.** `POST /notifications` — `userId`, `type`, `title`, `message`,
`data` (optional).

---

### 7.30 Files — `/files`

| Method | Path | Permission | Scope | Returns | Errors |
|---|---|---|---|---|---|
| GET | `/files/*` | member-scoped | **The file's owner, or the exam cell** | The raw file bytes, with the content type set from the extension | 400 (*"Invalid file path"*), 403 (*"You do not have access to this file."*), 404 (*"File not found"*) |

**The wildcard.** The tail of the path is captured as `:0` — the path without
its leading slash. The file is served from storage, not from a public URL.

---

## 8. Appendix — the routes that need no permission

These are listed so that a reader knows they are a **decision**, not an
oversight.

| Route | Why it needs no permission |
|---|---|
| `POST /auth/login` | *public* — you cannot sign in without signing in |
| `POST /auth/refresh` | *public* — the refresh token itself is the credential |
| `POST /auth/forgot-password` | *public* — you have forgotten your password |
| `POST /auth/reset-password` | *public* — the one-time token is the credential |
| `POST /auth/accept-invite` | *public* — the one-time token is the credential |
| `GET /health`, `/health/liveness`, `/health/readiness` | *public* — a probe must work without a session |
| `GET /invites/validate` | *public* — the token is the credential, and it is rate limited |
| `GET /scheme-reader/sample` | *public* — a browser download link cannot carry a bearer token, and the document is a university publication |
| `GET /auth/me` | *member-scoped* — acts only on the caller's own record |
| `PATCH /auth/profile` | *member-scoped* |
| `POST`/`DELETE /auth/profile/avatar` | *member-scoped* |
| `POST /auth/change-password` | *member-scoped* |
| `POST /auth/logout`, `/auth/logout-all` | *member-scoped* |
| `GET /notifications`, `POST /notifications/:id/read`, `POST /notifications/read-all`, `DELETE /notifications/:id` | *member-scoped* — the caller's own notifications |
| `GET /files/*` | *owner-scoped* — signing in is not enough; the reader must own the file or be the exam cell |

---

## 9. Appendix — things to know when building against this API

### 9.1 A parameter is a filter, never a grant

A `branchId` in a query string or a body **narrows** the result. It never
**widens** it. Asking for a branch outside the caller's scope is a **403**,
not a silent redirect to the caller's own branch. The backend rejects rather
than overrides, because overriding hides a client bug and returns a result
set nobody asked for.

### 9.2 A 404 does not confirm a record's existence

A record the caller may not see returns 404, not 403. A 403 for a record
outside the caller's scope would confirm that the record exists — which is
itself a leak.

The exception is where the scope *is* the point: `GET /branches/:id` and
`GET /subject-offerings/:id` return `null` in the payload for an
out-of-scope record, because the caller has already proven they may read the
collection.

### 9.3 A bulk operation is all-or-nothing

`POST /marks/bulk` is refused **whole** if any row is not allowed.
"47 of 50 saved" is never a state the marks screen can be in — a teacher
half-way through a spreadsheet would not know which half was written.

`POST /students/bulk-import` is the exception: it reports per-row outcomes
(created, skipped, and why each row failed), because a roster is imported
from a spreadsheet the college already has, and the clerk needs to see which
rows to fix.

### 9.4 Nothing is ever hard-deleted

| Thing | What "delete" does |
|---|---|
| A student | Soft delete. The history is kept. |
| A subject | Deactivated. Blocked outright when the subject carries marks. |
| A report | **Archived.** The row stays with the reason and who archived it; the file is released. |
| A member | Deactivated. The allocations, roles and invitations are released; the history is kept. |
| A branch | Blocked when the branch carries records. |
| A mark | Deleted — but only when no report or audit entry may reference it. |
| A `MarkRevision` | Append-only. Deleted only with its mark. |

### 9.5 A correction is not an ordinary write

`POST /marks/correct` is a different operation from `POST /marks`, and the
difference is visible in the API:

- it requires `marks:write`, not `marks:enter_own_subject`;
- it requires a `reason`;
- it is audited as `CORRECTION`, not `CREATE`;
- it writes a `MarkRevision` row that keeps the value it replaced and names
  the teacher whose entry was corrected.

### 9.6 The permission union

`GET /auth/me` returns the caller's **effective permissions** — the union of
every role they hold. Use it to decide what to show. The server decides what
to allow; if the two disagree, the server is right and the client has a bug.

### 9.7 The versioning prefix

Every path in this document is relative to `/api/v1`. The prefix comes from
URI versioning with a default version of `1`, so the URLs are:

```
http://localhost:3001/api/v1/students
http://localhost:3001/api/v1/marks
```

Swagger is generated at runtime from the controllers' decorators and is
mounted at `/api/docs` in development only — so it can never drift from the
code, and a missing checked-in `swagger.json` can never take the dev server
down.

### 9.8 A defect that was found and fixed: the frontend called the wrong paths for "My Result"

**Found while writing this document, on 2026-11-16, and fixed the same
day.** The paths in this table are the correct ones, and the frontend's
endpoint constants now match them.

`apps/frontend/lib/api/endpoints.ts` **declared**:

```ts
MY_RESULT:  '/students/my-result',
MY_TOPPERS: '/students/my-toppers',
MY_STUDENT: '/students/my/student',
```

But `MyResultController` is declared with **`@Controller()` — no prefix** —
so the server serves:

| The frontend called | The server actually serves |
|---|---|
| `GET /students/my-result` | `GET /my-result` |
| `GET /students/my-toppers` | `GET /my-toppers` |
| `GET /students/my/student` | `GET /my/student` |

**Consequence.** `GET /students/my-result` fell through to
`StudentsController`'s `@Get(':id')`, so it was treated as a request for a
student whose id is `"my-result"` — which is not a uuid, so it was a 404 or a
422. The student's **My Result** screen and their **class leaderboard** did
not load.

`ENDPOINTS.STUDENTS.MY_STUDENT` was declared but **never called**, so that
one was a latent mismatch rather than a live failure.

**Why it was never caught.** `prisma/verify-matrix.ts` checked the student's
`GET /students/own` and never `/my-result`; and the `route-reachability`
and `route-permissions` parity tests read the *backend's* routes and the
shared catalogue, so they could not see a mismatch in the frontend's own
endpoint constants.

**The fix** was to change the three constants to `/my-result`, `/my-toppers`
and `/my/student` — which matches the controller as written, and which is
the smaller change, because the backend route is the one the permission
matrix, the audit and the **My Result** screen's own name all agree on.

**Verified** against the running application: `GET /my-result` answers with
the student's own result, and `GET /students/my-result` is refused.

