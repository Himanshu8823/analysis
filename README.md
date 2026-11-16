# DBATU Result Analysis System

> A full-stack result-analysis platform for DBATU-affiliated colleges — from
> the scheme PDF that defines a course, through the marks a teacher enters,
> to the published result and the reports that go out with it.

---

## What it does

A college runs on this software. When a teacher's marks do not appear, when
a student's result is wrong, or when the exam cell cannot tell which
subjects belong to a semester, the college stops trusting the system.

This product carries the college's whole cycle:

```
set up the college (branches, academic years, schemes)
  → create the subjects, from the scheme PDF
  → import the students
  → allocate the teachers
  → enter or upload the marks
  → publish the result
  → read the analytics, generate the reports
```

**The rule the whole system turns on:** the exam cell defines what a subject
is worth; the teacher writes what a student scored. The exam cell may
*correct* a teacher's mark, but only deliberately, with a written reason,
and with the original value kept on record.

---

## Setup

### Prerequisites

- Node.js >= 18
- pnpm >= 9
- PostgreSQL (Neon Cloud recommended, or local)
- Redis (for the permission cache and the job queues — the app still boots
  without it, and the permission cache falls back to the database)

### Install

```bash
pnpm install
```

### Environment

Each app reads its own `.env` from its app directory:

```bash
cp apps/backend/.env.example apps/backend/.env      # macOS / Linux
copy apps\backend\.env.example apps\backend\.env    # Windows

cp apps/frontend/.env.example apps/frontend/.env
copy apps\frontend\.env.example apps\frontend\.env
```

At minimum, set `DATABASE_URL` in the backend's `.env` to a reachable
PostgreSQL instance, and set `JWT_SECRET` and `REFRESH_SECRET` to long
random strings.

**`GROQ_API_KEY` is optional.** It is only needed for reading a scheme PDF
automatically. Without it the scheme is entered by hand — the AI is an
accelerator, never a dependency.

### Local services

```bash
docker run -d --name ras-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_USER=postgres -e POSTGRES_DB=result_analysis -p 5432:5432 postgres:16
docker run -d --name ras-redis -p 6379:6379 redis:7
```

### Database

```bash
pnpm db:generate   # generate the Prisma client
pnpm db:migrate    # apply the migrations
pnpm db:seed       # seed the roles, permissions, branches, schemes and the first member
```

`pnpm db:studio` opens Prisma Studio.

**The seed creates one account** — the Super Admin — and prints its
password. The other five roles are created through the **invitation flow**,
exactly as a college creates them: the invitation makes the account,
assigns the role, sets the branch scope and sends the email.

### Run

```bash
pnpm dev
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:3001/api/v1 |
| Swagger | http://localhost:3001/api/docs |
| Health | http://localhost:3001/api/v1/health |

### Verify

```bash
pnpm build
pnpm lint
pnpm test
```

Two scripts check the system against the **running** application, which is
the only way to check a permission matrix honestly:

```bash
# Every role, sixteen routes — the authorisation matrix.
pnpm --filter @result-analysis/backend exec ts-node -r tsconfig-paths/register prisma/verify-matrix.ts

# The publication cycle, including every refusal.
pnpm --filter @result-analysis/backend exec ts-node -r tsconfig-paths/register prisma/verify-publication.ts
```

Both need the accounts, which `verify-matrix.ts` creates through the
invitation flow. The invitation email is read from a local mailbox — start
it first:

```bash
pnpm --filter @result-analysis/backend exec ts-node -r tsconfig-paths/register prisma/mail-capture.ts
# then start the backend with SMTP_HOST=127.0.0.1 SMTP_PORT=2525
```

---

## Tech stack

| | |
|---|---|
| **Frontend** | Next.js 14 (App Router), TypeScript (strict), TanStack React Query, Axios, React Hook Form + Zod, Recharts, Tailwind CSS |
| **Backend** | Nest.js 10, TypeScript (strict), Prisma, Passport + JWT, BullMQ, Redis (ioredis), pdfjs-dist, Nodemailer |
| **Data** | PostgreSQL (Neon), S3-compatible object storage (Neon Storage, S3, R2, MinIO) |
| **AI** | GROQ (Llama / Qwen) for reading a scheme PDF — optional, always degradable |
| **Tooling** | pnpm workspaces, Turborepo, ESLint + Prettier, Jest |

---

## Monorepo structure

```
result-analysis-system/
|-- apps/
|   |-- frontend/            # Next.js app (:3000)
|   |-- backend/             # Nest.js app (:3001); Prisma schema in apps/backend/prisma
|   |-- workers/             # BullMQ supervisor — reports queue health, does not consume
|-- packages/
|   |-- shared-types/        # TypeScript types shared by both sides
|   |-- shared-constants/    # The permission catalogue and the screen capabilities
|   |-- design-system/       # Reserved for the Coinbase token package
|-- docs/                    # The documentation below
|-- AGENT-PROMPT.md          # The production-hardening specification
|-- CLAUDE.md                # Project rules
```

---

## Documentation

| Document | What it is |
|---|---|
| **[docs/END_USER_GUIDE.md](./docs/END_USER_GUIDE.md)** | For the college staff. What each screen does, what each button does, what happens on error. |
| **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** | For a developer joining the project. The modules, the authorisation spine, the data model. |
| **[docs/API.md](./docs/API.md)** | Every endpoint: permission, scope, errors. |
| **[docs/AUDIT.md](./docs/AUDIT.md)** | Every screen and every route, with what each returns and what was found. |
| **[docs/GOAL-CHECKLIST.md](./docs/GOAL-CHECKLIST.md)** | The production-readiness scoreboard, line by line, with evidence. |
| **[docs/DECISIONS.md](./docs/DECISIONS.md)** | Every design decision and the reason behind it, plus the known gaps. |
| **[docs/FINAL-REPORT.md](./docs/FINAL-REPORT.md)** | What was done, what was verified, and what was not. |
| **[docs/PROGRESS.md](./docs/PROGRESS.md)** | The work plan and the phase-by-phase state. |

---

## How authorisation works

A member's reach is decided in three places, and none of them is a role
name.

| Layer | Question |
|---|---|
| **Permission** | What kind of action is this? |
| **Scope** | Which records may this action touch? The branch comes from the caller's role assignment, never from a parameter. |
| **Field** | Which parts of the record may be seen? A part the caller may not see is **absent** from the payload, not blank. |

A route that names several permissions and is used by roles with *different*
permissions says "any of"; a route whose permissions are meant to be held
*together* says "all of". The rule is enforced in the **service layer**, so
no background job or future controller can bypass it — and it is checked
against the running application, not only against the source.

---

## Status

The production-hardening work is complete against its specification:
879 tests pass, the build and the lint are clean, and the authorisation
matrix and the publication cycle are verified against the running
application.

The known gaps — the calculator's untested edge cases, the concurrent-edit
guard, the browser walk that this environment could not provide, and the
notifications screen — are listed in
**[docs/GOAL-CHECKLIST.md](./docs/GOAL-CHECKLIST.md)** and
**[docs/FINAL-REPORT.md](./docs/FINAL-REPORT.md)**.
