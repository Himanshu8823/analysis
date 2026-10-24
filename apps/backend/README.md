# Result Analysis System - Backend (Nest.js)

Nest.js 10 backend for the DBATU Result Analysis System with strict MVC architecture (Controller → Service → Repository), RBAC decorators, Prisma + PostgreSQL, BullMQ + Redis, Throttler rate limiting, and JWT auth.

This package follows the rules set out in `PROJECT.md` and `CLAUDE.md` at the repository root.

## Tech Stack

- Nest.js 10 (MVC + DTO validation)
- TypeScript 5 (strict mode)
- Prisma 5 + PostgreSQL (Neon Cloud)
- BullMQ + Redis (queues)
- Passport JWT
- class-validator / class-transformer
- helmet, cookie-parser, express-rate-limit, throttler
- exceljs (report generation), pdf-parse (text PDFs), @huggingface/inference (OCR)
- Swagger UI in dev mode

## Setup

1. **Install dependencies**

   ```bash
   pnpm install
   ```

2. **Configure environment**

   ```bash
   cp .env.example .env
   # Fill DATABASE_URL, JWT_SECRET, REFRESH_SECRET, REDIS_*, HF_API_TOKEN, etc.
   ```

3. **Generate Prisma client & run migrations**

   ```bash
   pnpm prisma:generate
   pnpm prisma:migrate    # local dev
   pnpm prisma:deploy     # production
   ```

4. **Seed the database (roles, permissions, schemes, branches, admin user)**

   ```bash
   pnpm prisma:seed
   ```

   Default admin: `admin@dbatu.edu` / `Admin@123` (change after first login).

5. **Run in dev mode**

   ```bash
   pnpm dev
   ```

   The server boots on `http://localhost:3001`. Swagger UI at `/api/docs` (non-production only).

## Architecture

```
src/
├── main.ts                    # bootstrap (helmet, cors, swagger)
├── app.module.ts              # root module (config, throttler, bullmq, feature modules)
├── config/                    # environment-driven config loaders
├── database/                  # PrismaModule (global PrismaClient provider)
├── common/                    # decorators, guards, interceptors, filters, types
└── modules/
    ├── auth/                  # JWT login, refresh, logout, me, strategies
    ├── users/                 # user CRUD
    ├── rbac/                  # roles, permissions, user-roles sub-modules
    ├── branches/              # academic branches
    ├── schemes/               # DBATU schemes (2019, 2022, 2024)
    ├── subjects/              # subjects per scheme/branch/semester
    ├── students/              # student records
    ├── marks/                 # marks + scheme-aware calculator (2019/2022/2024)
    │   └── calculator/        # calculator factory + strategies
    ├── upload/                # file upload tracking + queue dispatch
    ├── pdf-parser/            # text-based PDF parsing
    ├── ocr/                   # OCR via Hugging Face (worker-handled)
    ├── reports/               # Excel multi-sheet generation
    │   └── generators/        # Excel multi-sheet generator
    ├── toppers/               # subject & class topper algorithms
    │   └── algorithms/        # percentage / credits / marks strategies
    ├── analytics/             # overview, pass/fail, subject difficulty, trends
    ├── audit-logs/            # audit trail
    ├── notifications/         # user notifications
    └── health/                # health, liveness, readiness
```

Each feature module follows the strict MVC pattern: `<feature>.module.ts`, `<feature>.controller.ts`, `<feature>.service.ts`, `<feature>.repository.ts`, `dto/*.dto.ts`.

## Marks Calculation Engine

The marks module embeds a scheme-aware calculator factory. Three strategies are registered for DBATU's official schemes:

| Scheme | Pass Rule |
| --- | --- |
| `SCHEME_2019` | CA1 ≥ 6/20, CA2 ≥ 6/20, Mid-Sem ≥ 8/20, Internal (CA1+CA2+Mid) ≥ 30/60, External (Theory) ≥ 45/100, Practical (if any) ≥ 10/25, Aggregate ≥ 50% |
| `SCHEME_2022` | Internal (CT+Mid+Micro) ≥ 20/40, External (Written) ≥ 30/60, Practical ≥ 13/25, Aggregate ≥ 50% |
| `SCHEME_2024` | Internal (CT1+Mid+Quiz) ≥ 20/40, External (Written) ≥ 30/60, Practical ≥ 13/25, Aggregate ≥ 50% |

The factory dispatches the strategy by `scheme.name`. New strategies can be plugged in without changes to the service or controller.

## File Upload Pipeline

1. Client uploads file to storage (presigned URL).
2. Client calls `POST /upload` with the storage URL + metadata (filters).
3. Backend detects file type by magic bytes / URL extension.
4. Job is dispatched to either:
   - `upload-jobs` queue (Excel, CSV, text PDF)
   - `ocr-jobs` queue (image PDF → Hugging Face OCR)
5. Worker sets status to `EXTRACTED` once data is available.
6. Client calls `POST /upload/jobs/:jobId/confirm` to upsert into the marks table.

Rate limit on `POST /upload`: **10 / hour / user**.

## Reports

Excel multi-sheet workbooks via `exceljs`. The default `COMPLETE` report ships with seven worksheets:

1. `Student_Wise_Result` - per-student breakdown across subjects
2. `Scheme_Wise_Marks` - subject catalogue for the scheme
3. `Subject_Analysis` - average, max, min, pass %, difficulty
4. `Student_Analysis` - totals, credits, pass/fail
5. `Class_Toppers` - top 20 by percentage
6. `Pass_Fail_Analysis` - aggregate distribution with class buckets
7. `Charts_Data` - feeding data for the frontend charts

Rate limit on `POST /reports`: **5 / hour / user**.

## OCR

Uses Hugging Face Inference API. Three models are preconfigured (see `src/modules/ocr/hf-models.ts`):

- `TABLE_TRANSFORMER` (`microsoft/table-transformer-structure-recognition`) for tabular docs
- `TROCR_HANDWRITTEN` (`microsoft/trocr-base-handwritten`) for handwritten notes
- `PADDLE_OCR` (`PaddlePaddle/PaddleOCR`) default fallback

Set `HF_API_TOKEN` in `.env` to enable the integration. The `OcrProcessor` worker lives in the same module so admin endpoints (`POST /ocr/process/:jobId`, `GET /ocr/jobs/:jobId/status`) work without a separate worker process for dev/test.

## RBAC + Rate Limiting

- Global guards: `JwtAuthGuard`, `RolesGuard`, `PermissionsGuard`.
- Per-route opt-in via `@Roles(...)`, `@Permissions(...)`, `@Throttle(...)`.
- Caching: Permission lookups are cached in Redis with TTL 5min (in validation layer).
- Default Throttler limits:
  - short: 3 req/sec
  - medium: 100 req/min
  - long: 1000 req/hr

## Cross-Cutting Concerns

- **JWT auth** is enforced globally via `JwtAuthGuard`. Public routes opt out with `@Public()`.
- **RBAC** is enforced globally via `RolesGuard` (role allowlist) and `PermissionsGuard` (cached fine-grained perms).
- **Validation** uses the global `ValidationPipe` (whitelist + forbidNonWhitelisted + transform).
- **Interceptors**: `LoggingInterceptor`, `TransformInterceptor`, `TimeoutInterceptor`.
- **Filter**: `HttpExceptionFilter` produces a stable `{ success, error: { code, message }, timestamp, path }` shape.

## Scripts

| Script | Purpose |
| --- | --- |
| `pnpm dev` | start Nest in watch mode |
| `pnpm build` | build for production (`dist/`) |
| `pnpm start` | run compiled build |
| `pnpm start:prod` | `node dist/main` |
| `pnpm lint` | run ESLint with autofix |
| `pnpm format` | run Prettier |
| `pnpm test` | run unit tests |
| `pnpm test:e2e` | run e2e tests |
| `pnpm prisma:generate` | generate Prisma client |
| `pnpm prisma:migrate` | apply dev migrations |
| `pnpm prisma:deploy` | apply prod migrations |
| `pnpm prisma:seed` | seed RBAC + schemes + branches + admin user |
| `pnpm prisma:studio` | launch Prisma Studio |

## Environment Variables

See `.env.example` for the full list. Required:

- `DATABASE_URL`
- `JWT_SECRET`
- `REFRESH_SECRET`
- `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD`
- `HF_API_TOKEN` (OCR)
- `NEON_PROJECT_ID` / `NEON_API_KEY` (storage)
