# Architecture

The system a senior engineer needs to work on this codebase: how it is laid
out, how a request is authorised, how the data is shaped, and where the
places are that will hurt you if you break them.

**Status date:** 2026-11-16
**Read this with:** `docs/DECISIONS.md` (why each decision was taken),
`docs/AUDIT.md` (every route and screen), `docs/API.md` (the HTTP surface).
`CLAUDE.md` holds the project's non-negotiable rules.

---

## How to read this file

| Section | What it covers |
|---|---|
| [1. The shape of the system](#1-the-shape-of-the-system) | The monorepo, what each package is, and why two of them are duplicated |
| [2. The authorisation spine](#2-the-authorisation-spine) | Permission → scope → field, and where each is enforced |
| [3. The shared capability layer](#3-the-shared-capability-layer) | How the two sides agree, and the four tests that keep them honest |
| [4. The data model](#4-the-data-model) | The entities, their relationships, and why they are split |
| [5. The module map](#5-the-module-map) | Every backend module, and the queue arrangement |
| [6. The scheme pipeline](#6-the-scheme-pipeline) | PDF → text → model → validation → review → subjects |
| [7. The frontend](#7-the-frontend) | App Router, route groups, the shared class context, caching |
| [8. Cross-cutting concerns](#8-cross-cutting-concerns) | Errors, audit, rate limits, caching, the URL guard |

---

## 1. The shape of the system

### 1.1 The monorepo

A pnpm workspace with Turborepo. `pnpm-workspace.yaml` includes `apps/*` and
`packages/*`. Every package is `private: true`; nothing is published.

```
result-analysis-system/
├── apps/
│   ├── backend/     NestJS + Prisma + BullMQ + Redis   → the API
│   ├── frontend/    Next.js 14 App Router + React Query → the web app
│   └── workers/     BullMQ queue supervisor (read-only) → operations visibility
├── packages/
│   ├── shared-constants/  The permission catalogue, the capability layer,
│   │                      the semester→year derivation, the running-year rule,
│   │                      the scheme-rules conversion.
│   ├── shared-types/      Types and pure functions both sides need:
│   │                      UserRole, SchemeCourse, ApiResponse, canGrantRole.
│   └── design-system/     **An empty directory containing only a .gitkeep.**
└── docs/                  AUDIT, DECISIONS, PROGRESS, GOAL-CHECKLIST, this file, API.md
```

**Dependency direction.** `apps/backend` and `apps/frontend` both depend on
`packages/shared-constants` (and `shared-types`). The packages depend on
nothing in `apps/`. `apps/workers` depends on neither — it only needs
`bullmq` and `ioredis`.

```
        ┌──────────────────────┐
        │  packages/shared-    │◄────┐
        │     constants        │     │
        │  packages/shared-    │◄────┼──────────────┐
        │       types          │     │              │
        └──────────────────────┘     │              │
                                     ▼              ▼
                            apps/backend     apps/frontend
                            (NestJS API)     (Next.js web)
                                     │
                                     ▼
                            apps/workers
                            (supervisor only — reads, never consumes)
```

### 1.2 Why `shared-constants` exists separately from `shared-types`

They are not duplicates, and the split is deliberate:

| Package | Contains | Imported at runtime by |
|---|---|---|
| `shared-types` | Type declarations and pure functions with no catalogue in them: `UserRole`, `SchemeCourse`, `ApiResponse<T>`, `PaginationMeta`, `canGrantRole`, `grantableRoles`. | frontend, backend (type-only), workers |
| `shared-constants` | The **permission catalogue** (`PERMISSIONS`, `ROLE_PERMISSIONS`), the **capability layer** (`SCREENS`, `SCREEN_CAPABILITIES`, `ACTIONS`, `canAccessScreen`), and the **academic derivations** (`semesterToYear`, `resolveRunningYear`, scheme-rule conversion). | frontend, backend |

The reason they are separate packages rather than two folders of one package:
`shared-types` is imported by the backend **type-only** (`import type { UserRole }`),
so TypeScript erases it and it never reaches the emitted JavaScript.
`shared-constants` is imported by the backend **at runtime** — the permission
catalogue has to be a real value, because the parity tests read it and the
service layer compares against it.

That runtime import is also where the build-layout constraint bites. See
§1.4.

### 1.3 What each app actually is

**`apps/backend`** — a NestJS application. `src/main.ts` boots it with
helmet, CORS from `CORS_ORIGIN`, URI versioning (`api/v`, default version
`1`), a global `ValidationPipe` with `whitelist: true` and
`forbidNonWhitelisted: true`, three global interceptors, and one global
exception filter. Swagger is mounted at `/api/docs` in non-production only.

**`apps/frontend`** — Next.js 14 App Router. Two route groups, `(auth)` and
`(authenticated)`, plus `app/providers.tsx` and `app/layout.tsx` at the root.
See §7.

**`apps/workers`** — a **queue supervisor, not a worker**. It opens the four
BullMQ queues read-only and reports their depth, their oldest waiting job and
their recent failures. It never consumes a job. §5.4 explains why, and
`docs/DECISIONS.md` §8 has the full reasoning.

**`packages/design-system`** — **an empty directory with a `.gitkeep` in it.**
Nothing imports it; a grep for `design-system` across `apps/` and `packages/`
returns nothing. The design system in use is Tailwind plus a set of
hand-rolled components under `apps/frontend/components/ui/` (Radix
primitives + `class-variance-authority`), configured in
`apps/frontend/app/globals.css`. `CLAUDE.md` names
`npx getdesign@latest add coinbase` as the source of truth for tokens;
this package is where that would land, and it is currently empty.

### 1.4 The `dist/main.js` build-layout constraint

This is the constraint that shapes the whole shared-constants strategy, so it
is worth stating precisely.

`apps/backend/package.json` runs `start:prod` as `node dist/main`. The Nest
build emits `dist/main.js` **only if the TypeScript root directory is
`apps/backend`**. If a backend source file imports a *runtime value* from
`packages/shared-types/src` or `packages/shared-constants/src`, TypeScript
infers a common root directory of the **monorepo root**, and the output
becomes `dist/apps/backend/src/main.js` instead. The start script then fails
with "cannot find module".

This is documented in three places in the code itself:

- `apps/backend/src/common/constants/roles.ts` — "Importing a value from
  `packages/shared-types/src` would make TypeScript infer the monorepo root
  as the common root directory, which changes the build output layout from
  `dist/main.js` to `dist/apps/backend/src/main.js` and breaks `start:prod`."
- `packages/shared-constants/src/running-year.ts` — the same note for the
  running-year rule.
- `docs/DECISIONS.md` §14.2 — the same note for the grant rule.

**The workaround.** The backend imports the workspace packages through their
**built `dist/`** (via `tsconfig.json` paths and Jest's `moduleNameMapper`),
and never imports from `src/`. Where a *rule* must exist in both places at
runtime, it is **duplicated** — once in the package, once in the backend —
and a **parity test** proves the copies agree. §3.3 lists them.

**A consequence worth knowing.** The backend's Jest resolves
`@result-analysis/shared-constants` to `packages/shared-constants/dist/index.js`.
If you edit `packages/shared-constants/src/*.ts` without rebuilding the
package, the backend's tests run against the **old** build. This is not
hypothetical: it happened during the writing of this document — the
`capabilities-parity` test failed on a new screen until
`packages/shared-constants` was rebuilt. `pnpm build` builds the package
first (Turbo's `dependsOn: ["^build"]`); running a single Jest suite in
isolation does not.

### 1.5 The backend's structure

```
apps/backend/src/
├── main.ts                 bootstrap: helmet, CORS, versioning, pipes, filter
├── app.module.ts           global guards and interceptors, module wiring
├── common/
│   ├── ai/                 GROQ client, document guard, scheme reader service
│   ├── constants/          roles, injection tokens, scheme vocabulary + 4 parity specs
│   ├── decorators/         @Permissions, @AnyPermission, @Public, @CurrentUser, @Audited
│   ├── filters/            HttpExceptionFilter — the single error shaper
│   ├── guards/             JwtAuthGuard, PermissionsGuard, ForcePasswordChangeGuard
│   ├── interceptors/       Transform, Timeout, Logging, Audit
│   ├── interfaces/         CacheService contract
│   ├── pdf/                positional PDF renderer, table extractor, course extractor
│   ├── services/           AuthorisationService, ScopeService, UrlGuardService, AuditService
│   ├── utils/              academic, academic-year, running-year, query-params
│   ├── validators/         IsEntityId, ImageFile
│   └── types/              JwtPayload
├── config/                 database, auth, redis, storage, email, ai
├── database/               PrismaModule
└── modules/                28 feature modules (see §5)
```

**The global guard chain**, in the order `AppModule` registers them:

| Order | Guard | What it does |
|---|---|---|
| 1 | `ThrottlerGuard` | Rate limiting, per route via `@Throttle` |
| 2 | `JwtAuthGuard` | Verifies the bearer token; `@Public()` skips it |
| 3 | `ForcePasswordChangeGuard` | Blocks every route while `mustChangePassword` is true, except `@AllowPasswordChange()` routes |
| 4 | `PermissionsGuard` | Reads `@Permissions` / `@AnyPermission` metadata and checks it |

**The global interceptors**, applied in `main.ts` plus one container-bound:

| Interceptor | Purpose |
|---|---|
| `LoggingInterceptor` | Request logging |
| `TransformInterceptor` | Wraps every success in `{ success: true, data, timestamp }` |
| `TimeoutInterceptor` | Per-route timeout; a route may declare a longer one with `@RequestTimeout(ms)` |
| `AuditInterceptor` | Writes the audit row for a route decorated with `@Audited(...)`. Registered through the container so it ends up **outermost** — the audit write is awaited before the response is sent. |

---

## 2. The authorisation spine

### 2.1 The three layers

A member's reach is decided in three places. They are not interchangeable,
and a route that enforces only one of them leaks.

| Layer | Question it answers | Where it lives |
|---|---|---|
| **Permission** | *What kind of action is this?* | `@Permissions(...)` / `@AnyPermission(...)` on the route; `PermissionsGuard` |
| **Scope** | *Which records may this action touch?* | `ScopeService`, `AuthorisationService`, `MarksScopeService` |
| **Field** | *Which parts of the record may be seen?* | The service assembles the response; a part the caller may not see is **absent from the payload**, not blank |

**The rule that ties them together:** a record the member may not see must not
appear *anywhere* — not in a list, not in a response, not in a column the
frontend hides. A visible-but-403'd screen is already a leak: it tells the
member the record exists.

### 2.2 Layer 1 — permission

**The decorator.** `apps/backend/src/common/decorators/permissions.decorator.ts`

```ts
@Permissions('marks:read', 'marks:write')        // ALL of them (default)
@AnyPermission('upload:process', 'upload:process_own_subject')  // AT LEAST ONE
```

`@Permissions` writes `PERMISSIONS_KEY` metadata. `@AnyPermission` writes the
same key **and** `PERMISSIONS_MODE_KEY = 'some'`. The guard reads the mode
from the route's own metadata, so which rule applies is visible at the call
site without knowing the guard's implementation.

**The difference matters, and it was a bug.** `GET /marks` named
`marks:read` and `marks:enter_own_subject`. Under the "all of" rule the HOD
(who holds the first) and the Principal (who holds the first) were both
refused — while the Marks screen sat in both their sidebars. Nine further
instances were found and fixed at the same time.

**The rule that follows:** *a route that two roles use through **different**
permissions must say "any of".* A route whose permissions are meant to be
held **together** keeps "all of". `route-reachability.spec.ts` enforces this
mechanically.

**The guard.** `apps/backend/src/common/guards/permissions.guard.ts`

- Reads the required permissions from the route metadata. If there are none,
  it returns `true` — a route with no permission decorator is open to any
  signed-in member. `route-permissions.spec.ts` lists every such route
  explicitly (public, member-scoped, or owner-scoped) so an accidental
  omission fails the test.
- Resolves the caller's effective permissions: **the union of every role they
  hold**.
- On a cache miss — or when Redis is unavailable entirely — falls back to the
  database. A Redis outage downgrades performance, never authorisation. (The
  previous implementation returned `true` on a miss, which silently disabled
  every permission check in the system.)
- On refusal, throws `ForbiddenException` with the sentence *"You do not have
  access to this. Ask the college administrator if you need it."* — never
  "Insufficient permissions".

**The permission cache.**

| Key | Shape | TTL |
|---|---|---|
| `cache:rbac:version` | A global counter | none |
| `cache:user:permissions:<userId>:v<version>` | JSON array of permission strings | 300 s |

Any RBAC mutation **bumps the global version**, which orphans every
previously cached permission set in O(1) — no need to walk every affected
user. `cache.incr` returns 0 when Redis is down, so the version collapses to
`v0`, a valid but unversioned key; the TTL then bounds staleness.

### 2.3 Layer 2 — scope

**`ScopeService`** — `apps/backend/src/common/services/scope.service.ts`

The scope comes from the caller's `UserRole` rows, resolved at request time.
It is **not** read from the JWT, because a member may hold several roles at
once and the JWT carries one.

Two resolvers, and the distinction is load-bearing:

| Method | Answers | Returns | Use for |
|---|---|---|---|
| `resolveBranchScope(userId, requested?)` | *one* branch id | `string \| undefined` | a write that acts on a single record |
| `resolveBranchFilter(userId, requested?)` | a **set** of branch ids | `string[] \| undefined` | **any list read** |

The rules in both:

- **College-scoped** (every `UserRole` row has `branchId = null`): no branch
  filter. `resolveBranchFilter` returns `undefined` when no branch is named,
  or `[requested]` when one is.
- **Branch-scoped**: a request for a branch outside the scope is **rejected
  with a 403**, never silently redirected. Overriding hides a client bug and
  returns a result set nobody asked for.
- **Scoped to several branches**: `resolveBranchFilter` returns the whole set
  (or the requested one, if it is inside the set).

**Why the set form is not optional.** `resolveBranchScope` cannot express
"the member works in two branches". Asked for one branch with no name given,
it answers `undefined` — which a list read reads as "no filter" — and the
member sees the whole college. The failure is silent: the request succeeds
and returns too much.

This was not hypothetical. The reports list, the reports readiness check and
the subjects list all used the single-id resolver and all leaked.
`scope.service.spec.ts` now pins the behaviour.

**The empty-set rule.** `undefined` and `[]` mean opposite things to a
filter:

- `undefined` — no branch filter at all. Every branch is in play.
- `[]` — **no branch at all**. Nothing is in play.

The natural Prisma spelling of both is "no filter":

```ts
if (branchIds && branchIds.length > 0) where.branchId = { in: branchIds };
```

That one line treats an empty set as "everything", which is the opposite of
what it means. A teacher with no allocations — a real case, on the first
morning of a term — would have been shown the whole college. `buildStudentWhere`,
`buildOfferingWhere`, `resultPublicationStatus`, `performanceTrends` and
`branchNames` all follow the rule now.

**`AuthorisationService`** — `apps/backend/src/common/services/authorisation.service.ts`

The service-layer spine. It is the place every authorisation decision is
made, and it deliberately reads permissions through
`PermissionsCacheRepository` so it uses *exactly* the same cache-and-fallback
path as the guard. Two sources of truth for a member's permissions is how a
frontend and a backend end up disagreeing.

Its methods:

| Method | Answers |
|---|---|
| `permissionsOf(userId)` | The caller's effective permissions (the union of their roles) |
| `has(userId, permission)` | Whether the caller holds one |
| `assertAnyPermission(userId, permissions[])` | Refuses unless the caller holds at least one |
| `branchScope(userId)` | The caller's branch ids |
| `resolveBranchFilter(userId, requested?)` | The branch set for a list read |
| `resolveBranchScope(userId, requested?)` | The single branch for a single-record read/write |
| `assertBranchWritable(userId, branchId, label)` | **Refuses a write into another branch.** Unlike `resolveBranchScope`, a college-scoped caller is *not* allowed through — writing a student into another branch is a different act from reading one |
| `allocatedOfferingIds(teacherId, academicYearId)` | The offerings the teacher is allocated to |
| `isAllocated(teacherId, offeringId, yearId)` | Whether one allocation exists |
| `allocatedTeacher(offeringId, yearId)` | The teacher who currently holds the offering |
| `classesTaughtBy(userId)` | The classes the member is the class teacher of |
| `isClassTeacherOf(userId, context)` | Whether the member is that class's teacher |
| `branchOfStudent(studentId)` | The student's branch, or `null` |
| `assertBranchVisible(userId, recordBranchId)` | Refuses a read of a record outside the scope |
| `assertExists(record, message)` | 404 for a missing record — **a missing record and a forbidden one must not be confused**: a 404 for a record the caller may not see would confirm it exists |

### 2.4 Layer 2 in the marks module — `MarksAuthorisationService` and `MarksScopeService`

The marks module has its own two services, because the rules there are the
sharpest in the system.

**`MarksAuthorisationService`** — `apps/backend/src/modules/marks/marks.authorisation.service.ts`
— decides who may **write** a mark.

| Right | Permission | Who holds it | What it means |
|---|---|---|---|
| Exam-cell write | `marks:write` | ADMIN | May write any offering in scope, but **not** one a teacher holds an allocation for, unless it is an explicit, audited **correction** |
| Teacher write | `marks:enter_own_subject` | TEACHER | May write **only** the offerings the HOD allocated to them, for that academic year |

Class-teacher status grants nothing here.

`assertMayWrite(userId, offeringId, yearId, { isCorrection? })` returns
`{ overriddenTeacher }` — the teacher whose allocation the write overrides —
so the refusal message can name them and the revision row can record them.
The refusals are:

- not allocated → *"You are not allocated to Computer Networks, so you cannot
  enter its marks."*
- exam cell over a teacher's subject → *"Computer Networks is entered by
  <teacher>. To change it, use 'Correct marks' and give a reason — the change
  is recorded against your name."*
- a teacher attempting a correction → *"Only the examination cell can correct
  marks that a teacher has entered."*

`assertMayWriteBulk` refuses a batch **as a whole**. "47 of 50 saved" is never
a state the marks screen can be in — a teacher half-way through a spreadsheet
would not know which half was written.

**`MarksScopeService`** — `apps/backend/src/modules/marks/marks-scope.service.ts`
— decides what a caller may **read**.

| Caller | May read |
|---|---|
| Teacher | The marks of the subjects they were allocated, plus their own class's aggregate statistics. **Not** the whole branch's mark sheet |
| Class teacher | Their own class's aggregate statistics and class toppers — only for the class they are assigned to |
| HOD | Their branch |
| Principal / Super Admin / exam cell | Their scope |
| Student | Only their own marks, through the separate `marks:read_own` path. The general path is unreachable — they hold neither `marks:read` nor `marks:enter_own_subject` |

A teacher with no allocation at all sees nothing: `resolveMarkScope` returns
`subjectOfferingId: '__no_allocations__'`, a sentinel that matches no row.
The comment in the code says it plainly: *"A teacher with no allocation at
all sees nothing, rather than everything."*

### 2.5 Layer 3 — field

Field-level gating happens **in the service**, and the rule is **omission,
not blanking**.

`apps/backend/src/modules/students/student-profile.service.ts` assembles the
student profile from sections, and each section is included only if the caller
holds the permission behind it:

| Section | Needs | A teacher | An HOD | The Principal | The exam cell | A student |
|---|---|---|---|---|---|---|
| Identity and contact | `students:read` | ✓ | ✓ | ✓ | ✓ | ✓ (own) |
| Sensitive identity (national id, blood group) | `students:read_sensitive` | — | — | — | ✓ | ✓ (own) |
| Guardians | `students:read_guardian` | — | ✓ | ✓ | ✓ | ✓ (own) |
| Marks | the caller's allocation | own subjects only | branch | branch | branch | own |
| Result history | the caller's allocation | own subjects only | branch | branch | branch | own |
| Activity trail | `audit:read` | — | — | ✓ | ✓ | — |

**A section the caller may not see is absent from the payload.** A blank
field is a hint that something is there; an absent one is not.
`student-profile.permissions.spec.ts` asserts this against a teacher's and a
Principal's responses.

### 2.6 Why enforcement is in the service layer

Every authorisation decision is made in a service, not only in a controller
decorator.

**The reason, from the code's own history.** `MarksService.assertTeacherAllocated`
existed, was correct, and was called by **nothing**. The guard was theatre:
any teacher could write, overwrite or delete a mark for **any** subject in the
college, by id. A controller decorator alone is bypassable by any code path
that calls the service directly — a background job, a queue processor, a
future controller.

So the rule now is:

- The **decorator** is the fast path. It answers "may this member perform
  this *kind* of operation?" before the request reaches the service.
- The **service** is the authority. It answers "may this member perform this
  operation *on this record*?" — the rules a decorator cannot express:
  "only for the subjects you were allocated", "only for your own class",
  "only within your branch".

Every mark write path — single create, bulk create, update, delete, and the
upload-confirm path — passes through `MarksAuthorisationService`. The upload
path was the last to be fixed: it duplicated the allocation rule and omitted
the correction rule, so an exam-cell upload that covered a teacher's subject
silently overwrote the teacher's marks with no reason and no correction audit.
`UploadModule` now imports `MarksModule` and the exam-cell branch asks the
shared service.

### 2.7 The request flow

```
Request
  │
  ├─ ThrottlerGuard ────────── rate limit exceeded? → 429 + Retry-After
  │
  ├─ JwtAuthGuard ──────────── no/invalid token? → 401
  │                             @Public() routes skip this
  │
  ├─ ForcePasswordChangeGuard ─ password change pending? → 403
  │                             except @AllowPasswordChange() routes
  │
  ├─ PermissionsGuard ──────── permission not held? → 403
  │      reads @Permissions / @AnyPermission metadata
  │      resolves the caller's permission union (Redis → DB fallback)
  │
  ├─ AuditInterceptor ───────── writes the audit row for @Audited routes
  │      (outermost — awaited before the response)
  │
  ├─ TransformInterceptor ───── wraps the success in { success, data, timestamp }
  │
  ├─ TimeoutInterceptor ─────── the route exceeded its timeout → 408
  │
  └─ Controller → Service
        │
        └─ Service: the SCOPE and FIELD layers live here
             AuthorisationService / ScopeService /
             MarksAuthorisationService / MarksScopeService /
             StudentProfileService …
             │
             └─ Repository → Prisma → Postgres
```

---

## 3. The shared capability layer

### 3.1 The idea

**"If a member cannot use a thing, they must not be shown the thing."** Not a
disabled button, not a nav link that 403s, not a table the API will refuse.

One catalogue answers "may this member do X?" for **both** sides:

- the **backend** enforces it in the service layer;
- the **frontend** hides the screen, the button or the column.

If the two sides answer differently for the same question, that is a bug.

### 3.2 The catalogue

`packages/shared-constants/src/capabilities.ts` holds three things:

**`SCREENS`** — every screen by route path. 35 entries, including the ones
with no rule (`MY_ACCOUNT`, `CHANGE_PASSWORD` have an **empty** permission
list, meaning "open to every authenticated member"). Naming them matters: a
screen the catalogue does not name is a screen the guard cannot reason about.

**`SCREEN_CAPABILITIES`** — 35 entries pairing a path with:
- `label` — the navigation label;
- `permissions` — **at least one** of these is enough;
- `requiresAll` — all of these, on top (rarely used);
- `group` — `'workspace' | 'admin'`;
- `icon`.

**`ACTIONS`** — the actions a member may take and the permission each one
needs. The action names *are* the permission strings, so a caller passes the
same value in both worlds without a translation table.

Three helpers: `canAccessScreen(held, screen)`, `canPerform(held, action)`,
`accessibleScreens(held)` / `inaccessibleScreens(held)`.

**Ordering matters inside the catalogue.** The catalogue is scanned in order
and the **first** match wins, so every static path comes before every
parameterised one that could shadow it. `/students/:id` matches any single
segment after `/students/`, so it also matches `/students/import` — which is
why `/students/new`, `/students/:id/edit`, `/students/import` and
`/students/bulk-provision` all precede `/students/:id` in the array.

### 3.3 The four parity tests

These are the mechanism that keeps the two sides, and the two copies of each
rule, in step. All four live in `apps/backend/src/common/constants/` and all
four read the **source** rather than importing it — reading is enough to
compare the *rule*, and it keeps the Nest dependency graph out of the test
run.

| Test | What it compares | What it catches |
|---|---|---|
| `capabilities-parity.spec.ts` | The shared catalogue against the frontend's `NAV_ITEMS` (`lib/constants/index.ts`) and the sidebar's `ADMIN_ITEMS` (`components/layout/AppSidebar.tsx`) — **every** screen, not a sample | A screen the member is offered and cannot open; a screen in the catalogue that the navigation forgets; a permission no role grants; a permission nobody holds |
| `roles-parity.spec.ts` | The backend's `canGrantRole` (`common/constants/roles.ts`) against the shared copy (`shared-types`) — over **every** combination of held roles against every candidate role (377 assertions from a generated matrix) | The two copies of the grant rule drifting; `SUPER_ADMIN` being offered; a role being offered to a member who holds no role |
| `route-permissions.spec.ts` | Every controller's `@Permissions(...)` against the shared catalogue | A route naming a permission the catalogue does not define (a typo — a route nobody can open); a route that is not permission-guarded and is not on the explicit exemption list; a catalogue permission no route uses and that is not named as frontend-only or service-layer-only |
| `route-reachability.spec.ts` | Every route against every role's permission set | A route **no** role can open (a dead screen); a route that names several permissions under "all of" when **different** roles hold them separately (the `GET /marks` bug); a role that holds one of a route's permissions and is refused by the "all of" rule |

**Verified on 2026-11-16:** all four suites pass — **370 tests, 0 failures.**

### 3.4 The deliberate duplication, and why

There are three places a rule genuinely has to exist twice:

| Rule | Copy A | Copy B | Parity test |
|---|---|---|---|
| Who may grant a role | `packages/shared-types/src/index.ts` → `canGrantRole` | `apps/backend/src/common/constants/roles.ts` → `canGrantRole` | `roles-parity.spec.ts` |
| Which academic year is running | `packages/shared-constants/src/running-year.ts` | `apps/backend/src/common/utils/running-year.ts` | `running-year-parity.spec.ts` |
| Which screens a member may open | `packages/shared-constants/src/capabilities.ts` | the frontend's `NAV_ITEMS` + `ADMIN_ITEMS` | `capabilities-parity.spec.ts` |

**Why the duplication is necessary.** The backend cannot import a runtime
value from a workspace package's `src/` without changing the build output
layout (§1.4). A **type-only** import is erased and is fine; a **value**
import is not.

**Why it is safe.** Two copies of a security rule *will* drift — that is a
matter of time, not of carefulness. So each duplication is paired with a test
that proves the copies agree, and each test enumerates the **whole space**
rather than a sample. A new role added to one side without the other fails
the test instead of silently diverging.

**The rule that follows:** *two copies of a rule that must agree need a test
that proves they agree.*

### 3.5 The frontend's use of the catalogue

**`lib/auth/screen-capabilities.ts`** — `canOpenScreen(pathname, held)`
matches a path against the catalogue, returning `{ known, allowed, screen }`.
`known: false` means the catalogue does not name the path; the guard leaves
it alone (the catalogue covers the screens that carry data).

**`AppShell`** (`components/layout/AppShell.tsx`) holds the guard, in the
shell rather than in each page — *a guard that each page has to remember to
apply is a guard that some page will forget*. A refusal **replaces** the
screen with `<NoAccess/>` rather than redirecting: the member asked for this
path, and answering them on this path with an explanation and a way back is
the difference between a decision and a dead end.

**`RequirePermission`** (`components/auth/RequirePermission.tsx`) is the
per-page guard, for pages that need a rule the catalogue does not carry. It
applies **both** rules and takes the stricter: the page's own `permissions`
and the catalogue's answer. A disagreement means one of them is loose, which
is worth honouring.

**The sidebar** filters `ADMIN_ITEMS` by `required.some(p => held.has(p))`,
where `held` is the union of all the member's role permissions.

---

## 4. The data model

`apps/backend/prisma/schema.prisma` — PostgreSQL, 21 models. Every table is
`@map(...)`-ed to snake_case.

### 4.1 The shape

```
                                 ┌──────────────┐
                                 │     User     │
                                 │  (a member)  │
                                 └──────┬───────┘
                    ┌───────────────────┼───────────────────┬──────────────┐
                    │                   │                   │              │
             ┌──────┴──────┐    ┌───────┴───────┐   ┌───────┴───────┐  ┌───┴────┐
             │  UserRole   │    │ RefreshToken  │   │  AuditLog     │  │Student │
             │ (role +     │    │ PasswordReset │   │               │  │(profile│
             │  branch)    │    │  Notification │   └───────────────┘  │ link)  │
             └──────┬──────┘    └───────────────┘                     └───┬────┘
                    │                                                       │
                    │ role                          branchId              userId
                    ▼                                                       │
             ┌──────────────┐                                   ┌─────────┴────────┐
             │     Role     │                                   │      Student      │
             └──────┬───────┘                                   └─────────┬────────┘
                    │ rolePermissions                                   │
                    ▼                                                   │ branch/scheme/batch/year
             ┌──────────────────┐   roleId                             │ semester
             │ RolePermission   │◄──────────┐                        │
             └────────┬─────────┘           │                        │
                      │ permissionId        │                        │
                      ▼                    │                        │
             ┌──────────────────┐           │                        │
             │   Permission     │           │                        │
             └──────────────────┘           │                        │
                                           │                        │
  ACADEMIC STRUCTURE                       │                        │
                                           │                        │
   ┌──────────┐   ┌──────────┐             │                        │
   │  Branch  │   │  Scheme  │             │                        │
   └────┬─────┘   └────┬─────┘             │                        │
        │              │                   │                        │
        │   ┌──────────┴──────────────┐    │                        │
        │   │      SubjectOffering    │    │                        │
        │   │  subject + branch +     │    │                        │
        └──▶│  semester + scheme +    │    │                        │
   branchId │  academicYear          │    │                        │
            └────┬───────────┬────────┘    │                        │
                 │           │             │                        │
                 │           │             │                        │
        ┌────────▼─────┐  ┌──▼──────────────▼───┐                   │
        │     Mark     │  │  TeacherSubject     │                   │
        │  (a score)   │  │ teacher + offering  │                   │
        │             │  │  + academicYear     │                   │
        │   ┌─────────▼──▼──┐                  │                   │
        │   │ MarkRevision  │                  │                   │
        │   │ (append-only) │                  │                   │
        │   └───────────────┘                  │                   │
        └──────────────────────────────────────┘                   │
                                                                   │
   ┌──────────────┐   ┌───────────────┐                            │
   │  AcademicYear│   │     Batch     │                            │
   └──────────────┘   └───────┬───────┘                            │
                               │                                    │
                               ▼                                    ▼
                          ┌────────────────┐            ┌──────────────────┐
                          │    Student     │◄──────────►│ StudentEnrollment│
                          │ (where they    │            │ (where they WERE)│
                          │  are now)      │            └──────────────────┘
                          └───────┬────────┘
                                  │
   ┌──────────────┐  ┌───────────┴───┐  ┌──────────────┐
   │ Examination  │  │ClassTeacher   │  │   Report     │
   │ PENDING →    │  │  Assignment   │  │ (archived)   │
   │ PUBLISHED    │  │ (one per      │  └──────────────┘
   └──────────────┘  │   class)      │  ┌──────────────┐
                     └───────────────┘  │  UploadJob   │
                                       └──────────────┘
```

### 4.2 The entities that need explaining

**`Subject` vs `SubjectOffering`** — the split the requirements document
wrongly claimed did not exist.

- `Subject` is the **identity**: `code` (unique), `name`, `credits`,
  `maxMarks`, `passingMarks`, `components` (JSON). It has no branch, no
  semester, no scheme, no year. One row per subject, created once.
- `SubjectOffering` is the **assignment**: "this subject runs in this branch,
  this semester, this scheme, this academic year". Unique on
  `(subjectId, branchId, semester, schemeId)`.

**Why the split.** The same subject is taught in several branches, in several
semesters, under several schemes, in several years. If `Subject` carried the
branch, a subject taught in two branches would have to be two rows — and then
"Computer Networks" would exist twice, with two sets of credits and two sets
of pass marks, and nothing could tie them together. The split also puts the
row marks hang off in the right place: a mark is recorded against an
*offering*, because a mark means "this student, in this class, in this
subject, in this year" — and each offering has its own class of students.

Note the `year` column that `SubjectOffering` used to carry is **gone**,
removed by migration `20261102000000_drop_redundant_year_columns` (see
§4.4). The year is derived from the semester.

**`Student` vs `StudentEnrollment`** — the same idea, applied to a student's
history.

- `Student` records where the student is **now**: `branchId`, `semester`,
  `schemeId`, `batchId`, `academicYearId`.
- `StudentEnrollment` records a semester they were **in**: unique on
  `(studentId, semester, academicYearId)`, with `isCurrent` marking the live
  one.

**Why.** Without it, advancing a student meant overwriting `semester`, and
the earlier semester's subjects and result fell out of the picture entirely.
A Sem 5 student's Sem 1 marks must stay attached to the Sem 1 they were
earned in, so the profile screen can show the whole journey rather than only
the current semester.

**`Student` — the widened model.** Migration
`20261115000000_widen_student_model` added the real-world fields §2.8.1 of the
spec lists:

- *Personal* — `dateOfBirth`, `gender` (`Gender` enum).
- *Contact* — `phone`, `alternateEmail`, `address`, `city`, `state`, `pincode`.
- *Identity — SENSITIVE* — `photoUrl`, `bloodGroup` (`BloodGroup` enum),
  `nationalId`. These are gated by `students:read_sensitive`.
- *Category and quotas* — `reservedCategory` (`ReservedCategory` enum),
  `feeCategory` (`FeeCategory` enum), `scholarshipRecipient`.
- *Guardians* — one or two, each with name, relation (`GuardianRelation`
  enum), phone, email, occupation. Gated by `students:read_guardian`.
- *Status lifecycle* — `status` (`StudentStatus` enum: `ACTIVE`, `GRADUATED`,
  `DROPPED_OUT`, `ON_LEAVE`), `statusReason`, `statusDate`. This **replaces**
  the old flat `isActive` flag, which could only say "in the system" or "not
  in the system" — it could not say whether a student had finished the course,
  left it, or was away for a term.

**`Mark` and `MarkRevision`.**

`Mark` is unique on `(studentId, subjectOfferingId, examType, academicYearId)`
and carries `marksObtained`, `maxMarks`, `isAbsent`, `isWithheld`, `remarks`,
`createdBy`, `updatedBy`.

`MarkRevision` (migration `20261115000100_add_mark_revisions`) is
**append-only**. Every correction writes a row carrying the value that was
replaced, the value that replaced it, the reason, the member who made the
correction, and the teacher whose entry was corrected
(`overriddenTeacherId`, `overriddenTeacherName`). Nothing ever updates or
deletes it; it is deleted only if its mark is deleted.

**Why it matters.** "Marks are sacred" means a mark is reproducible and
traceable. A correction that destroys the value it replaced is not traceable;
it is only *asserted*.

**`ClassTeacherAssignment`** — unique on `(branchId, semester, schemeId,
academicYearId)`, which enforces **at most one** class teacher per class.
That is the invariant the revocation lifecycle exists to keep honest.

**`TeacherSubject`** — the allocation. Unique on `(teacherId,
subjectOfferingId, academicYearId)`. The academic year is part of it because
an allocation is granted **for a year** — "the subjects I teach" is only
meaningful within a year.

**`Report`** — carries `isArchived`, `archivedAt`, `archivedBy`,
`archiveReason` (migration `20261115000200_archive_reports`). A report is
**archived, never deleted**: it is a statement about a class's results, and a
statement that existed and then vanished cannot be accounted for.

**`AuditLog`** — `userId`, `action`, `resource`, `resourceId`, `details` (JSON),
`ipAddress`, `userAgent`, `createdAt`. Indexed on `(userId, createdAt)` and
`(resource, resourceId)`.

**`Examination`** — `PENDING → PROCESSING → PUBLISHED` (or `FAILED`), with
`examDate` and `resultPublishedAt`. Unique on `(branchId, semester, schemeId,
academicYearId)`.

**`Invite`** — an account does not exist until the invitation is accepted. Only
the SHA-256 hash of the token is stored, so a database leak yields no usable
invitation links. `status` is `PENDING | ACCEPTED | REVOKED | EXPIRED`; a
resend sets `supersededById`, keeping the history so a stale link is not
mistaken for a live one.

### 4.3 Referential integrity

`onDelete` is chosen per relation, not left to default:

| Relation | Behaviour | Why |
|---|---|---|
| `UserRole → User`, `Role` | `Cascade` | A member's role assignments die with the member |
| `RolePermission → Role`, `Permission` | `Cascade` | A grant dies with the role or the permission |
| `RefreshToken → User` | `Cascade` | — |
| `SubjectOffering → Subject`, `Branch`, `Scheme` | `Cascade` | An offering cannot outlive its subject or its class context |
| `SubjectOffering → AcademicYear` | **`SetNull`** | Deleting a year must not delete the offerings that reference it |
| `Student → User` (`studentProfile`) | **`SetNull`** | Deleting the login must not delete the student |
| `Mark → Student`, `SubjectOffering` | `Cascade` | — |
| `MarkRevision → Mark` | `Cascade` | The revision dies only with its mark |
| `Invite → Branch` | **`SetNull`** | Deleting a branch must not delete the invitation history |
| `Invite → Invite` (`supersededBy`) | **`SetNull`** | — |

Nothing is ever hard-deleted at the application layer. A subject with marks
is deactivated; a student with marks is archived; a report is archived; a
member is revoked but kept.

### 4.4 Semester, year and academic year

**Semester is the operating unit.** Year of study is a grouping *above* it:
Sem 1–2 → Year 1, 3–4 → Year 2, 5–6 → Year 3, 7–8 → Year 4.

The derivation lives in **one** place:
`packages/shared-constants/src/academic.ts` → `semesterToYear(semester)`
(rejects an unknown semester by returning `undefined`) and
`yearForSemester(semester)` (clamps, for display). `validateYearSemester`
returns a sentence explaining a mismatch — the message is written for the
person filling in the form.

**The redundant columns are gone.** `SubjectOffering.year` and
`Student.currentYear` were dropped by migration
`20261102000000_drop_redundant_year_columns`, after being backfilled into the
derived value. The bug the removal exposed: the scheme reader wrote
`year: semester` — the *semester number* (1–8) into the *year* column (1–4).
A semester-5 subject was stored as "year 5", which is not a year at all. It
went unnoticed because nothing read the column back to check it, and because
the column was redundant in the first place: **a column nothing reads is a
column nothing validates.**

**The academic year is the running year.**
`packages/shared-constants/src/running-year.ts` → `resolveRunningYear`:

1. **The date decides.** A year whose `startDate <= today <= endDate` is
   running. Nothing else is consulted — not a flag, not a count.
2. **The `isActive` flag is a label, not a decision.** It is kept for display
   and for the seeded data, but it never overrides the dates. A flag that
   contradicts the dates is a data-entry mistake, and the dates win.
3. **One year at a time.** If two years' ranges overlap, the one that started
   *later* wins.
4. **No match has a defined answer, not a silent one** — see the file for the
   gap cases.

### 4.5 The RBAC model

`User → UserRole → Role → RolePermission → Permission`

- `UserRole` carries an **optional `branchId`** — the branch scope. A member
  with one branch-scoped role row per branch is scoped to all of them.
  Unique on `(userId, roleId, branchId)`.
- `Permission` is `name` (unique, e.g. `students:read`), `resource`,
  `action`, with `@@unique([resource, action])`.
- A member may hold **several roles at once**; the **union** of their
  permissions is what the guard sees.

There are **48 permissions** in the catalogue and in the seed, and they match
exactly (verified by comparing `packages/shared-constants/src/index.ts` with
`apps/backend/prisma/seed.ts`). The seed is **declarative**: it deletes stale
role→permission grants that are no longer listed, so re-seeding cannot leave
Super Admin with `marks:write`.

---

## 5. The module map

28 feature modules under `apps/backend/src/modules/`. Each follows the same
shape: `*.controller.ts` → `*.service.ts` → `*.repository.ts` (+ `dto/`).

### 5.1 The academic modules

| Module | What it does |
|---|---|
| `auth` | Login, refresh with rotation, logout / logout-all, `me`, profile, avatar, accept-invite, change-password. JWT + Passport. |
| `password-reset` | Forgot-password and reset-password. `@Controller('auth')` — the same prefix as `AuthController`, with non-overlapping paths. Only the SHA-256 hash of the token is stored. |
| `users` | The member directory. `member-revocation.service.ts` implements the revocation lifecycle; `member-impact.service.ts` produces the consequence preview. |
| `rbac` | Roles, permissions, and the `user-roles` controller (add/remove a member's roles and branch scope). `permissions-cache.repository.ts` is the single read path for a member's permissions. |
| `invites` | The invitation lifecycle. `PENDING → ACCEPTED / REVOKED / EXPIRED`, with superseded-vs-revoked distinguished. |
| `branches` | The branches. |
| `academic` | Academic years and batches. `POST /academic/years` and `/activate` exist so a college can open a year without a developer; activation retires the previous year **in the same transaction**. |
| `schemes` | The schemes and their pass rules. `Scheme.rules` is JSON in the shape the calculators read (the 2019 / 2022 / 2024 shapes). |
| `subjects` | The subject catalogue and the subject offerings. |
| `allocations` | Teacher allocations and class-teacher assignments — two duties, two permission sets. `GET /class-teacher-assignments/needs-teacher` keeps the gap visible. |
| `examinations` | A class's examination and the publication of its result. `POST /:id/publish` is refused unless every student's result is in; `DELETE /:id/publish` returns a published result to being worked on. |
| `students` | The roster, the profile, bulk import, login provisioning, and the student-self (`my-result`, `my-toppers`) routes. `student-profile.service.ts` does the field-level gating. |
| `marks` | Mark entry, bulk entry, correction, and the scheme-aware calculators. `calculator/` holds the three calculators (2019 / 2022 / 2024) behind a `CalculatorFactory`. |
| `class-overview` | The class overview of the signed-in class teacher. Addressed by the member's own assignment id, so a class they do not teach is not addressable. |
| `reports` | Report generation, the readiness check, the Excel generator, and the archive flow. |
| `upload` | The three-way ingestion pipeline: CSV / text-PDF / image-PDF OCR, with review-before-confirm. |
| `ocr` | OCR extraction through Hugging Face inference. |
| `pdf-parser` | Text extraction from a text-layer PDF. |
| `scheme-reader` | Reading a syllabus PDF into a reviewable set of courses, and writing the reviewed courses as subjects. |
| `toppers` | Class and subject leaderboards, with pluggable ranking strategies (`percentage`, `credits`, `marks`). |
| `analytics` | The college's academic picture: overview, pass/fail, subject statistics, difficulty, performance trends. |
| `dashboard` | A **role-aware** dashboard. The scope and the metrics are decided from the caller's effective permissions — own, class, branch, or college. |
| `audit-logs` | The audit trail, with a facets endpoint for the filter dropdowns. |
| `notifications` | Per-member notifications. |
| `health` | Liveness, readiness and a full health check (database + cache). |
| `email` | The mailer, its templates, and the `email-jobs` processor. |
| `storage` | S3-compatible object storage, and the `files/*` route that serves stored files with an owner check. |
| `cache` | The Redis-backed cache. |

### 5.2 The calculators

`apps/backend/src/modules/marks/calculator/` holds `scheme-2019.calculator.ts`,
`scheme-2022.calculator.ts`, `scheme-2024.calculator.ts` and a
`CalculatorFactory.fromScheme(scheme)`.

**The calculators are the specification.** Their expectations are never
changed to fit a new input — a new input is adapted to the calculator. They
are covered by tests for every scheme and every edge case: absent, withheld,
partial, zero-credit, practical-only, CC-option.

**A subject with no marks at all is *pending*, not *failed*.** Scoring it as
a zero would report every half-entered class as a class where everybody
failed. (`scheme-2024.calculator.ts:83`.)

### 5.3 The queue arrangement

Four BullMQ queues, all sharing the cache's Redis instance (including
`REDIS_DB`):

| Queue | Processor | Job |
|---|---|---|
| `upload-jobs` | `upload/processors/upload.processor.ts` | Parse an uploaded statement |
| `ocr-jobs` | `ocr/ocr.processor.ts` | OCR a scanned PDF |
| `reports-jobs` | `reports/reports.processor.ts` | Generate a report file |
| `email-jobs` | `email/email.processor.ts` | Send an email |

**All four `@Processor` classes live inside the backend**, and `AppModule`
imports every one of those modules, so the backend's own process consumes all
four queues.

### 5.4 Why the standalone worker does not consume them

`apps/workers` is a **supervisor**, not a second consumer.

**The conflict.** `PROJECT.md` §Phase 4 describes a separate worker process
that consumes the queues, with the backend only enqueueing. The
implementation is the opposite. `apps/workers` was a placeholder whose
handler acknowledged every job without doing any work, and it subscribed to
queue names (`reports`, `ocr`) that matched **none** of the four the backend
enqueues under.

**Why this was a live bug, not a cosmetic mismatch.** With BullMQ, two
consumers of the same queue compete for its jobs. A placeholder consumer that
acknowledges a job without performing it does not leave that job to be
retried — it marks it **done**. So a second, non-empty worker on the same
queue silently discards uploads and reports: the job disappears from the
queue, the backend's processor never sees it, and the upload sits at
`PENDING` forever with no error anywhere.

**What was decided.** The backend keeps the processors; the standalone worker
stops competing for them. The processors depend on backend services —
`UploadService` and `StorageService` for the upload parser, Prisma for the
reports and OCR writers. Moving them into `apps/workers` would mean giving
the worker its own Prisma client, its own storage client and its own copy of
the upload parsing code, and then keeping two copies of that code in step
forever. That is a larger surface for drift than the race it removes.

The worker's handlers are now **honest**: it refuses to acknowledge a job it
has not performed. What it does instead is hold the queues open and report
their depth, their stalled jobs and their recent failures — it is the process
an operator watches when the queues are not draining.

**The rule:** *a queue may have **one** consumer. A handler that acknowledges
work it did not do is worse than no handler at all, because it converts a
visible failure into invisible data loss — and this system treats marks as
sacred.*

---

## 6. The scheme pipeline

### 6.1 The flow

```
Upload syllabus PDF
   │
   ├─► [DETERMINISTIC] PDF read locally (pdfjs-dist) with positions
   │        │
   │        ├─ the page's runs are grouped into ROWS (19pt tolerance)
   │        ├─ the columns are found from the DATA ROWS only
   │        ├─ every cell is kept, empty cells included
   │        └─ the region is reduced to a compact, positional text slice
   │
   ├─► [MODEL] GROQ reads the slice  (temperature 0, reasoning off)
   │        │
   │        ├─ the guard (llama-prompt-guard) checks each page FIRST
   │        ├─ the reader returns a positional array of 11 values per course
   │        └─ pages too large for the cap are split, never truncated
   │
   ├─► [DETERMINISTIC] Backend validation
   │        ├─ schema check on every returned row
   │        ├─ the components must sum to 100
   │        ├─ the totals row must not appear as a course
   │        └─ a row that fails is reported, not dropped silently
   │
   ├─► [HUMAN] The reviewer sees an editable table
   │        ├─ every field editable
   │        ├─ rows can be deleted and added
   │        ├─ the rows that failed validation are shown with the reason
   │        └─ the pages that could not be checked are named
   │
   └─► [DETERMINISTIC] POST /scheme-reader/confirm
            └─► subjects + subject offerings + the scheme's pass rules
```

**Nothing derived from a model output is persisted without a human reviewing
it.** A malformed model response is rejected by validation and never reaches
the database.

### 6.2 What is deterministic and what is the model

| Stage | Owner | Why |
|---|---|---|
| Reading the PDF's text and positions | **Deterministic** (the code) | The file never leaves the machine. Reading geometry is not a judgement call |
| Locating the table region and reducing it to a slice | **Deterministic** (the code) | Format-independent selection: find the region, keep the heading above it and the caption below it |
| Reading the table's meaning from the slice | **The model** | Merged cells, wrapped names and a semester that is a heading rather than a column are reading comprehension |
| Validating the returned rows | **Deterministic** (the code) | A misread is caught by a rule, not by hope |
| Writing subjects and offerings | **Deterministic** (the code) | Only from what the reviewer confirmed |

**The rule: *the code selects; the model interprets.*** See `docs/DECISIONS.md`
§9 for the full reasoning, including why a deterministic-per-university parser
was built, tested against the university's own PDF, and then abandoned.

### 6.3 Where the human review sits

**Between validation and the database.** The reading routes
(`POST /scheme-reader/read`, `POST /scheme-reader/read-file`) write
**nothing**. They return a `SchemeReadResponse` — the courses, the warnings,
the rejected rows, the guard's verdicts, the pages that could not be checked.
The review screen at `app/(authenticated)/admin/schemes/read/page.tsx` shows
them in an editable table. Only `POST /scheme-reader/confirm` writes, and it
writes from **the reviewer's body**, not from the reader's output.

`writeSubjects` takes the courses in the **DTO's shape**, not the reader's,
*because the reviewer's screen posts back exactly what it showed — and the
reviewer may have corrected a value on the way.*

### 6.4 The AI is an accelerator, never a dependency

- The key is `GROQ_API_KEY`, read from config. Never hard-coded, never logged.
- A missing key means `isReadingAvailable` is false;
  `GET /scheme-reader/availability` returns
  `"Automatic reading is not available on this system. You can still enter the scheme by hand."`
- The key is **not validated at boot** — a missing key must not stop the
  college from using the rest of the product.
- Every scheme can still be entered by hand, through the same review table.

### 6.5 Living within the provider's limits

Discovered by reading the provider's own error bodies during a live run, not
guessed:

| Model | Limit | Value on this key |
|---|---|---|
| `qwen/qwen3.8-27b` (reader) | output tokens per minute | 1000 |
| `meta-llama/llama-prompt-guard-2-86m` (guard) | requests per minute | 30 |

Four decisions follow:

1. **The answer is capped, and the cap is a config value.**
   `GROQ_MAX_OUTPUT_TOKENS` defaults to **450** — half the provider's limit,
   so two calls fit inside a one-minute window. A page whose table is larger
   than the cap is **read in pieces** rather than cut short: truncation is the
   worst outcome, because the courses that did not fit would simply be
   missing and nothing would say so.
2. **A page is split by courses, not by characters.** `splitPage()` cuts on
   line boundaries and **repeats the page's first line on every piece** — the
   first line is the column header, and without it the model is reading a
   table with no column names. The pieces are sized by how many *course rows*
   they carry (`rowsPerPiece = maxOutputTokens × 0.66 ÷ TOKENS_PER_COURSE`),
   with `GROQ_MAX_INPUT_CHARS_PER_CALL` (default **1200**) as a second bound.
3. **Reasoning is switched off** (`reasoning_effort: 'none'`), because
   reasoning tokens are drawn from the *same* `max_completion_tokens` budget
   as the answer. The reader's task is copying a table, not solving a problem.
4. **Calls are paced.** `GROQ_MIN_GAP_MS` (default **31000**) between reader
   calls; `GROQ_GUARD_MIN_GAP_MS` (default **2100**) between guard calls. Both
   are set to zero in the unit tests.

### 6.6 The guard's silence is never treated as safety

The single most important decision in the pipeline, and it came from a real
bug.

When the guard could not reach the provider, it caught the error and returned
a score of **zero** — the score for "safe". A page that was never defended
was therefore reported to the reviewer as checked and clean. On a
prompt-injection guard, that is the one failure mode that must not exist.

The guard now distinguishes three outcomes:

| Outcome | Meaning | What the reviewer sees |
|---|---|---|
| checked and safe | the page was read and no instruction was found | "Safe" |
| refused | the page tried to change how the document was read | "Refused" |
| **not checked** | the provider could not be reached | **"Partly checked"** + a warning naming the pages |

The unchecked pages are listed by number in `uncheckedPages`, and the review
screen says *"Pages 3, 7 could not be checked. Look at those pages yourself."*

**The rule:** *never let a failure to check be reported as a successful
check.*

---

## 7. The frontend

### 7.1 Next.js App Router

Next.js 14, App Router, TypeScript. The route tree is small and explicit.

```
apps/frontend/app/
├── layout.tsx           root: fonts, metadata, <Providers>
├── page.tsx             / — redirects by session
├── globals.css          the Tailwind theme: the design tokens
├── providers.tsx        QueryClientProvider + Toaster
├── error.tsx            the global error boundary
│
├── (auth)/              PUBLIC — no session required
│   ├── layout.tsx       a different shell: centred card, no sidebar
│   ├── login/
│   ├── forgot-password/
│   ├── reset-password/
│   └── accept-invite/
│
└── (authenticated)/     AppShell — sidebar, header, class context, guard
    ├── layout.tsx       renders <AppShell>{children}</AppShell>
    ├── loading.tsx      route-level loading state
    ├── error.tsx        route-level error boundary
    │
    ├── dashboard/  my-result/  my-account/  change-password/
    ├── students/         (list, new, [id], [id]/edit, import, bulk-provision)
    ├── marks/            (entry, correct)
    ├── upload/  upload-history/
    ├── class-overview/  reports/  toppers/  analytics/
    └── admin/            (members, roles, schemes, subjects, assignments,
                           branches, academic-years, publications, audit-log)
```

**Route groups.** `(auth)` and `(authenticated)` are groups, not path
segments — they do not appear in the URL. They exist to give each area its
own layout: the auth area is a centred card, the authenticated area is the
app shell.

### 7.2 The shell

`components/layout/AppShell.tsx` does four things, in this order:

1. **Session check.** `hasSession` starts as `null` ("not checked yet") and
   becomes `true`/`false` in an effect. Reading `localStorage` during the
   render would make the server render and the first client render disagree,
   and React would throw the tree away and start again. `null` is distinct
   from `false` because on a hard reload the query cache is empty, so `user`
   is briefly `undefined` — treating that as "signed out" bounced every
   reload back to `/login`.
2. **Redirects.** No session → `/login`. A failed `me` request → `/login`.
   `mustChangePassword` → `/change-password` (the page itself is exempt, or
   the redirect would loop).
3. **The route guard.** `canOpenScreen(pathname, held)`. A refusal replaces
   the screen with `<NoAccess/>`.
4. **The class context provider.** Mounted inside the shell so it survives a
   navigation.

### 7.3 The shared class context

`apps/frontend/lib/context/class-context.tsx`

The class a member is working on: `branchId`, `schemeId`, `semester`,
`academicYearId`.

**Why it exists.** A college's exam cell does the same job across a dozen
screens — enter marks for CS Sem 5 this year; check the readiness for that
same class; upload the statement for that same class. Before this, each of
those screens kept its own four dropdowns and its own state, so the person
had to pick the same class again on every screen, and it was easy to check
the readiness of one class and generate the report for another.

**Four properties, each deliberate:**

| Property | Why |
|---|---|
| Held in one provider mounted in `AppShell` | It survives a navigation |
| Persisted to `localStorage` (`result-analysis.class-context`) | The exam cell's work spans days — marks on Monday, the statement on Wednesday, the report on Friday |
| **Read in an effect, never during render** | `localStorage` exists only in the browser; reading it while rendering causes a hydration mismatch |
| **Inert outside the provider** | `useClassContext()` returns an empty context rather than throwing, so a component rendered in isolation renders instead of crashing |

**The stored class is a *starting point*, never a grant.** The server still
decides what the member may read. If the member's branch scope changes and
the stored context names a branch they may no longer work in, the branch is
cleared rather than kept — keeping it would send a request the server will
refuse, and the refusal would look like the system being broken.

**Some screens are the context; some default to it:**

| Screen | Relationship to the context |
|---|---|
| Marks, Reports, Upload | **Are** the context. The work is *about* one class. |
| Analytics, Toppers | **Default** to it, and can widen. A widened selection does **not** overwrite the shared context |

The second kind starts from the shared class — so the charts are about the
right class on arrival — but its dropdowns still offer the wider choice, and
widening a chart must not silently change which class the marks screen is
about.

`components/context/ClassContextBar.tsx` renders the context as one row of
controls, so it is visible and changeable in one place.

### 7.4 React Query: caching and invalidation

`lib/query/queryClient.ts`:

```ts
{
  staleTime: 60 * 1000,        // 1 minute
  gcTime: 10 * 60 * 1000,      // 10 minutes
  retry: (failureCount, error) => {
    if (status >= 400 && status < 500) return false;   // never retry a 4xx
    return failureCount < 2;
  },
  refetchOnWindowFocus: false,
  refetchOnReconnect: true,
}
```

Mutations never retry.

**`lib/query/queryKeys.ts`** is the key factory. **A list key embeds the
active filters**, so invalidating a list means matching on the *hash* of the
nested filter object — and a bare `['invites']` prefix will not match it.
`lib/query/invalidationRules.ts` therefore invalidates list prefixes and
detail keys **explicitly**, by name:

```ts
qc.invalidateQueries({ queryKey: ['invites', 'list'] });
qc.invalidateQueries({ queryKey: queryKeys.invites.counts() });
```

Both are named explicitly so a change to the key factory cannot silently
stop the list from refreshing.

**The invalidation rules**, and what each one knows:

| Rule | Invalidates | Why it knows |
|---|---|---|
| `onInviteSent` / `onInviteRevoked` / `onInviteResent` | invitation list + counts + members | An invitation changes the member list |
| `onMemberUpdated` | members | — |
| `onMemberRolesChanged` | that member's roles, that member's detail, members | A member's role chips and the list's role filter counts come from the same rows |
| `onRolesChanged` | roles, that role's permissions + detail, permissions, members | A role's permission set changed, so every cached view of it is stale |
| `onStudentCreated` | students, analytics overview | — |
| `onMarksUpdated` | that student's marks, marks, subject-wise toppers, class toppers, analytics overview, reports | A score moves six things |
| `onSchemeUpdated` | that scheme, schemes, subjects, marks, analytics overview | A scheme's rules change what every mark means |
| `onBranchChanged` | branches, students, subjects | The list renders the branch code and name beside each record |
| `onReportGenerated` | reports | — |
| `onSubjectChanged` | subjects, subjects list, subject offerings | The catalogue and the offerings are two views of one structure |
| `onTeacherAllocationChanged` | teacher allocations, subjects, subject offerings | A removed offering must not linger in the picker |
| `onClassTeacherAssignmentChanged` | class-teacher assignments, **needs-teacher** | Appointing somebody fills a gap; removing them opens one |

### 7.5 The API client and the failure classifier

`lib/api/client.ts` — an Axios instance on
`NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'`, 30-second timeout,
`withCredentials: true`.

**The request interceptor** attaches `Authorization: Bearer <accessToken>`.

**The response interceptor** handles the refresh flow: on a 401 (and not
already retried, and not on `/auth/login`, `/auth/refresh`,
`/auth/accept-invite`), it calls `POST /auth/refresh` with the stored
refresh token. Because the backend **rotates** the refresh token, the
rotated one is stored too — otherwise the next refresh is rejected.
Concurrent requests during a refresh are queued and replayed when it
completes. If the refresh fails: `signOut()` and redirect to `/login`.

**`lib/api/interceptors.ts`** sorts every failure into exactly one kind:

| Kind | Trigger | Retry offered? | Label shown |
|---|---|---|---|
| `network` | no status, `ERR_NETWORK`, or `ECONNABORTED`/timeout | yes | "We could not reach the server" |
| `session-expired` | 401 | no | "Your session has ended" |
| `no-access` | 403 | no | "You do not have access to this" |
| `not-found` | 404 | no | "This record no longer exists" |
| `invalid` | 400 or 422 | no | "Please check the form" |
| `conflict` | 409 | no | "That already exists" |
| `too-many` | 429 | yes | "Too many attempts" |
| `server-error` | 5xx, or anything else | yes | "Something went wrong on our side" |

**The network case is decided first** and is deliberately **not** a server
error: nothing went wrong on the server's side, because the server was never
asked — and telling a member otherwise sends them looking for a fault in the
application.

### 7.6 Responsiveness

Three breakpoints, exactly: mobile `< 768px`, tablet `768–1023px`, desktop
`>= 1024px`. Tailwind's default / `md:` / `lg:`.

`AppShell` states the contract in its own header: mobile is an off-canvas
sidebar sheet driven by `SidebarProvider`; tablet is a pinned sidebar at
16rem; desktop is a pinned sidebar with wider gutters and a readable
max-width (`max-w-[1200px]`).

`apps/frontend/__tests__/lib/responsive.spec.ts` asserts the **contract** by
reading the source: no screen carries a fixed pixel width that could overflow
a phone, every table is scrollable / stacked on mobile / built from the
shared `DataTable`, and every icon-only button has a 44-pixel touch target.

**This is a code-inspection check, not a rendering check.** It cannot catch a
layout that is technically correct and still looks wrong. The browser walk at
three breakpoints has not been done — Chrome DevTools MCP could not connect in
this environment (`docs/DECISIONS.md` §18, `docs/PROGRESS.md` R7.1).

---

## 8. Cross-cutting concerns

### 8.1 Error shaping — one filter

`apps/backend/src/common/filters/http-exception.filter.ts` is the **single
place** an error response is shaped. It is registered globally in `main.ts`.

**The envelope, always the same shape:**

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have access to this. Ask the college administrator if you need it."
  },
  "timestamp": "2026-11-16T09:41:07.123Z",
  "path": "/api/v1/marks"
}
```

A rate-limit response adds `error.retryAfter` and a `Retry-After` header.

**Three cases, and the third is the important one:**

| Case | Status | What the client is told |
|---|---|---|
| An `HttpException` | its own | Its own message — it was written for the person reading it |
| A body the server could not parse | 400 | "That request could not be read. Please try again." |
| **Anything else** | **500** | **"Something went wrong on our side. Please try again."** |

In the third case the **original exception message is logged server-side and
replaced** with a friendly sentence for the client. The filter used to pass
`exception.message` through for any non-HTTP error, so a Prisma error
surfaced its table and column names to the browser — both an information leak
and unreadable for a college clerk.

**The code** is derived from the status, not left as a catch-all:
`BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`,
`UNPROCESSABLE_ENTITY`, `TOO_MANY_REQUESTS`, `REQUEST_TIMEOUT`,
`SERVICE_UNAVAILABLE`, `INTERNAL_ERROR` for any 5xx, and `HTTP_<n>` for a
status with no code of its own. A permission refusal and a server crash are
different things, and a client that cannot tell them apart can only show one
message for both.

**Proof.** `http-exception.filter.spec.ts` asserts, for a Prisma error, a
foreign-key error, a missing-file error and a connection-string error, that
none of the table names, column names, file paths or credentials appear in the
response body — while the response still carries a sentence the member can act
on.

**The success envelope** is produced by `TransformInterceptor`:
`{ success: true, data, timestamp }`.

### 8.2 Audit

`@Audited(resource, action, options)` marks a route as an auditable mutation.
`AuditInterceptor` reads the metadata **after the handler resolves
successfully** and writes one row.

**The verbs** (`AuditAction`): `CREATE`, `UPDATE`, `DELETE`, `BULK_IMPORT`,
`CONFIRM`, `CORRECTION`, `GRANT`, `REVOKE`, `DEACTIVATE`, `ARCHIVE`.

**The resources** (`AuditResource`): `student`, `subject`, `subject_offering`,
`mark`, `branch`, `scheme`, `teacher_allocation`, `class_teacher_assignment`,
`upload_job`, `user`, `report`, `academic_year`, `examination`.

**The options**: `resourceIdSource` (`body` | `param` | `response` | `none`),
`resourceIdField`, `details`, `detailsFromBody`, `reasonField`, `skip`.

Two details worth knowing:

- **An array field is recorded as its *length*, never as the array itself**, so
  a bulk import of thousands of rows cannot land in the JSON column.
- **A failed audit write never fails the request.** The mutation has already
  succeeded by then, and refusing to answer would be worse than a missing
  audit row.

The interceptor is registered through the container (`{ provide:
APP_INTERCEPTOR, useClass: AuditInterceptor }`) rather than
`useGlobalInterceptors`, so Nest applies it during `NestFactory.create()` and
it ends up **outermost** — outside the `TransformInterceptor` and the request
timeout — and the audit write is awaited before the response is sent.

Coverage spans 40+ `@Audited` sites.

### 8.3 Rate limiting

`ThrottlerGuard` is registered as a global guard (first in the chain), so
**every** route is limited by the base tiers:

| Tier | Window | Limit |
|---|---|---|
| `short` | 1 second | 3 |
| `medium` | 1 minute | 100 |
| `long` | 1 hour | 1000 |

Per-route overrides use `@Throttle({ default: { limit, ttl } })`:

| Route | Limit | Window |
|---|---|---|
| `POST /auth/login` | 5 | 15 min |
| `POST /auth/accept-invite` | 10 | 15 min |
| `POST /auth/refresh` | 20 | 15 min |
| `POST /auth/profile/avatar` | 20 | 1 hour |
| `POST /auth/forgot-password` | 5 | 15 min |
| `POST /auth/reset-password` | 10 | 15 min |
| `GET /invites/validate` | 10 | 15 min |
| `POST /upload`, `POST /upload/file` | 10 | 1 hour |
| `POST /reports` | 5 | 1 hour |
| `POST /scheme-reader/read`, `POST /scheme-reader/read-file` | 10 | 1 hour |
| `GET /analytics/overview` | 30 | 1 min |
| `GET /dashboard` | 60 | 1 min |
| `GET /dashboard/header`, `/metrics`, `/sections`, `/recent-uploads` | 120 | 1 min |

The **shape** of the limits is the point: the expensive, abusable operations
(getting a token, generating a report, uploading a file, reading a syllabus)
get small per-hour budgets; the cheap reads get generous per-minute ones.

`packages/shared-constants/src/index.ts` also exports a `RATE_LIMITS` map
(`LOGIN`, `UPLOAD`, `REPORT_GENERATE`, `GENERAL_API`, `ANALYTICS`). It is
documentation of the intent; the enforced values are the `@Throttle`
decorators and the three tiers in `AppModule`.

### 8.4 Caching

Two caches, both Redis, both accelerators.

**The RBAC permission cache.** Keyed `cache:user:permissions:<userId>:v<version>`
with a 300-second TTL, versioned by the global counter so a role change
orphans every cached set in O(1). On a miss — or when Redis is unavailable
entirely — the guard falls back to the database. **A Redis outage downgrades
performance, never authorisation.**

**The Redis cache service.** `modules/cache/cache.service.ts`. When Redis is
unreachable every operation degrades to a no-op (`get` returns `null`, writes
are dropped) so the API keeps serving correct results straight from Postgres
— slower, but never broken. The client uses `enableOfflineQueue: false` and
`maxRetriesPerRequest: 2` so a dead Redis fails fast instead of queueing
commands forever.

`packages/shared-constants/src/index.ts` also declares `CACHE_KEYS` and
`CACHE_TTL` for the branch list, the scheme list, the scheme rules and the
subjects-by-context list. These are the intended keys; the enforced cache is
the RBAC one.

**On the frontend**, React Query holds the view state — `staleTime` 1 minute,
`gcTime` 10 minutes.

### 8.5 The URL guard — the server's own address check

`apps/backend/src/common/services/url-guard.service.ts`

A `fileUrl` in a request body is an instruction: *go and fetch this*. Left
unchecked, that address can be anything — the cloud metadata service
(`169.254.169.254`, which hands out the instance's credentials), a database
on the same network, or the machine the server runs on. The answer comes back
to the caller, so the server becomes a proxy for whatever it can reach.

`UrlGuardService.assertFetchable(fileUrl)` refuses an address that:

- is not `http` or `https`;
- names a host on the blocked list (`localhost` and its spellings, the
  metadata host names);
- **resolves** to a loopback, private, link-local, carrier-grade NAT or
  reserved address.

**The resolution check is the half that matters.** A name-only check is
refused by every attacker worth their salt: a public-looking name that
resolves to `10.0.0.1` passes a name check and reaches the inside of the
network. The resolver is injected under a `URL_RESOLVER` token, so the
service is testable without a live DNS.

**Where it is applied.** At every point where the server fetches a URL it
did not itself publish: the upload job, the OCR extraction, the PDF parser,
the two queue workers, and the scheme reader. The scheme reader already had
an origin allowlist, but it built the allowlist *out of the URL being
checked* — which allows every URL, because the URL is on the list by
definition. Its allowlist now comes from the configuration only.

**The rule:** *a file the user wants read is uploaded. The server follows a
link only to an address it is willing to reach.*

### 8.6 The revocation lifecycle

`apps/backend/src/modules/users/member-revocation.service.ts`

| Action | Access | History | Allocations | Tokens |
|---|---|---|---|---|
| **Deactivate** (`DELETE /users/:id`) | Revoked immediately | Preserved | Released, with the class flagged as needing a teacher | Revoked immediately |
| **Restore** (`POST /users/:id/restore`) | Restored | Preserved | **Not** given back automatically | New sign-in required |

**Revoking runs in one transaction** (`prisma.$transaction`): the account is
deactivated, the sessions are revoked, the pending invitations are withdrawn,
the subject allocations and class-teacher assignments are released, and the
roles are removed. **The history is kept** — `Mark`, `AuditLog`, `Report` and
`Invitation` rows all reference members, and a hard delete would destroy the
audit trail that makes a result traceable.

**The consequences are shown before they happen.** `GET /users/:id/revocation-impact`
returns a preview and a list of plain-language consequences:

> This will remove 3 subject allocations and 1 class teacher assignment.
> Computer Science · Semester 5 will have no class teacher.

The member edit screen fetches it, shows it, requires a reason, and only then
confirms. The frontend's `RevocationImpactDialog` does this; the old raw
`window.confirm` — which wrongly said a soft delete "permanently deletes" —
is gone.

**Revoking a class teacher leaves the class visibly unassigned.** The class
is flagged "class teacher required" everywhere it appears, through
`GET /class-teacher-assignments/needs-teacher`. It is not auto-reassigned: an
automatic reassignment silently grants someone authority over a class.

**Reassignment is a replacement, never an overwrite.** `POST
/class-teacher-assignments` refuses an unconfirmed replacement with a **409**
naming the current class teacher, and `CreateClassTeacherAssignmentDto.replacesExisting`
is the explicit flag. The backend replaces in one transaction, so the class is
never left without a teacher because a second step failed.

### 8.7 The role-grant rule

`canGrantRole(heldRoles, roleToGrant)` — a member may hand out a role that
carries **strictly less** authority than the strongest role they hold.

- `SUPER_ADMIN` is **never** granted through the ordinary screens. It is set
  by the system administrator alone.
- A **staff** role (Admin, HOD, Principal, Teacher) may be granted only if it
  is strictly below the grantor's own. The comparison is strict, so nobody
  appoints a peer: an Admin may not appoint another Admin, and a Principal
  may not appoint another Principal. Without the strictness, every office
  would be self-perpetuating.
- The **Student** role is appointed rather than granted as staff, and may be
  handed out from the Principal level up. Appointing a student is not a
  teacher's act — and the permission matrix agrees: the Teacher role carries
  no `rbac:write` and no `invites:write` at all.

**A member who holds several roles is judged by the strongest of them.**
Judging by the weakest would let a Principal who also teaches appoint a
Student, which is not what their office means.

**A branch-scoped member may not appoint into a branch they are not in.**
Holding the `HOD` role in Computer Science is authority over Computer
Science, not over Mechanical Engineering. This is checked separately from the
rank rule, because it is a different question: the rank rule asks *how much*
authority, this one asks *over whom*.

`canGrantRole` is the **single place** that answers "may this member hand
out this role", and both the role-assignment screen and the invitation flow
ask it. Neither flow decides for itself.

---

## Appendix A — Where to look when something breaks

| Symptom | Start here |
|---|---|
| A member sees a screen they cannot use | `packages/shared-constants/src/capabilities.ts`, then `AppShell`'s guard, then `route-reachability.spec.ts` |
| A member cannot see a record they should | `ScopeService.resolveBranchFilter` (the **set** form), then the module's own scope service |
| A teacher cannot enter marks | `MarksAuthorisationService.assertMayWrite`, then `TeacherSubject` rows |
| An exam cell cannot correct a mark | `MarksAuthorisationService` with `{ isCorrection: true }`; the rule needs `marks:write` |
| The error message is a developer phrase | `HttpExceptionFilter` — the third case replaces the message |
| A bulk write half-succeeded | `assertMayWriteBulk` refuses the batch whole; there is no partial state to fix |
| The frontend and the backend disagree about a permission | `route-permissions.spec.ts` and `capabilities-parity.spec.ts` — and check that `packages/shared-constants` was **rebuilt** |
| The queue is not draining | `apps/workers` (the supervisor reports depth and failures); the processors are in the backend |
| A syllabus PDF read wrong | `common/pdf/document-renderer.ts` — the geometry. §11 of `docs/DECISIONS.md` |
| The AI says the page was "safe" | `common/ai/document-guard.service.ts` — check `uncheckedPages` |

## Appendix B — Known gaps

Recorded in full in `docs/DECISIONS.md` §18 and `docs/AUDIT.md` §6.

| # | Gap | Why it is open |
|---|---|---|
| 1 | **The browser walk.** Every screen was checked by reading its source, not by looking at it at three breakpoints. | Chrome DevTools MCP could not connect in this environment. The responsive *contract* is checked by a test, but it cannot catch a layout that is technically correct and still looks wrong. |
| 2 | **A student without a linked login.** | The provisioning flow exists for one student and for a class, but a student whose email was never recorded cannot be provisioned, and the screen says so. |
| 3 | **Redis was not connected** in the verification environment. | The permission cache falls back to the database, so authorisation is unaffected — but the cache path was not exercised. |
| 4 | **The frontend calls the wrong paths for "My Result".** `ENDPOINTS.STUDENTS.MY_RESULT` is `/students/my-result` and `MY_TOPPERS` is `/students/my-toppers`, but `MyResultController` is declared with `@Controller()` — no prefix — so the server serves `/my-result` and `/my-toppers`. The requests fall through to `StudentsController`'s `@Get(':id')` and fail. | Found while writing `docs/API.md` on 2026-11-16. Unfixed. `verify-matrix.ts` checks the student's `GET /students/own` and never `/my-result`, and the parity tests read the *backend's* routes — so neither can see a mismatch in the frontend's own endpoint constants. See `docs/API.md` §9.8. |
| 5 | **`packages/design-system` is an empty directory.** It contains only a `.gitkeep`, and nothing in `apps/` or `packages/` imports it. The design system actually in use is Tailwind plus the hand-rolled components under `apps/frontend/components/ui/`. | `CLAUDE.md` names `npx getdesign@latest add coinbase` as the source of truth for the tokens; this package is where that would land, and it is empty. |

**Note on the examinations module.** `AUDIT.md` §6 lists "the examination
lifecycle" as a gap, saying *"no module exposes it"*. That was **stale when
this document was written**: `apps/backend/src/modules/examinations/` exists,
is registered in `AppModule`, has five routes (`examinations:read` /
`examinations:write`), and has a frontend screen at
`app/(authenticated)/admin/publications/page.tsx` wired into the sidebar and
the shared catalogue. `AUDIT.md` should be corrected.
