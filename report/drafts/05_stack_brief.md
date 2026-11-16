# Result Analysis System — Technology Stack, Setup and Deployment Brief

Scope: the repository at its current state (branch `feature/v2-mini`). Everything below is read from the actual manifests and source, not from the planning documents — where the README and the code disagree, the code wins and the discrepancy is flagged.

---

## 1. Technology Stack, Layer by Layer

### Runtime and language
Node.js >= 18 (root `engines` constraint), pnpm >= 9, pinned package manager `pnpm@9.12.3`. TypeScript 5.6.3 at the root, `^5.3.3` in the backend and workers. All three apps compile to CommonJS on the backend/worker and ESM/bundler-resolution on the frontend. Both `tsconfig.json` files set `strict: true`; the backend additionally enables `strictNullChecks`, `noImplicitAny`, `strictBindCallApply`, `noFallthroughCasesInSwitch` and `forceConsistentCasingInFileNames`, with `strictPropertyInitialization` explicitly disabled (required by the Prisma-generated models). Target is ES2022 across the board.

### Backend framework
NestJS 10 (`@nestjs/common` `^10.3.0`, `@nestjs/core` `^10.3.0`, `@nestjs/platform-express` `^10.3.0`). The CLI and schematics are `^10.3.0` / `^10.1.0`. Platform Socket.IO (`@nestjs/platform-socket.io` `^10.3.0`) and `@nestjs/websockets` `^10.3.0` are declared dependencies but are not imported anywhere in the source — the notifications module is HTTP-only. Architecture is Controller → Service → Repository throughout; each module directory carries its own `.controller.ts`, `.service.ts`, `.repository.ts` trio.

### Frontend framework
Next.js `14.2.18` with the App Router, React `18.3.1`, React DOM `18.3.1`. `reactStrictMode: true`, `experimental.typedRoutes: false`, `transpilePackages: []`. The app directory is split into a `(auth)` group and an `(authenticated)` group plus a root layout, a providers file and a global stylesheet. A `middleware.ts` exists but, by explicit design decision documented in-file, performs no route protection — the session lives in `localStorage`, which the edge middleware cannot read; protection is enforced client-side in the authenticated layout.

### Database and ORM
PostgreSQL on Neon Cloud (serverless Postgres). Prisma `^5.8.0` for the CLI and `@prisma/client` `^5.8.0`. The schema uses the `prisma-client-js` generator and a single `postgresql` datasource driven by `DATABASE_URL`. Seven migration folders exist under `prisma/migrations`, latest dated `20261102000000_drop_redundant_year_columns`. Model naming is snake_case-mapped to camelCase fields via `@map`, and UUID primary keys are generated in-application (`@default(uuid())`).

### Queue system
BullMQ `^5.7.0` with `@nestjs/bullmq` `^10.1.0`. Four queues exist: `upload-jobs`, `ocr-jobs`, `reports-jobs`, `email-jobs`. The processors live in the **backend**, not in the worker process — `upload-jobs` (upload processor), `ocr-jobs` (OCR processor), `reports-jobs` (reports processor), `email-jobs` (email processor), each declared with `@Processor(name)` extending `WorkerHost`. No `@Processor` declares an explicit `concurrency`, so every worker runs at BullMQ's default of 1 concurrent job.

### Cache
Redis via `ioredis` `^5.3.2`. The client is configured with `lazyConnect: true`, `enableOfflineQueue: false`, `maxRetriesPerRequest: 2`, and a retry strategy that gives up after 5 attempts with a 200 ms × attempt backoff capped at 2000 ms. The cache is explicitly an accelerator, never a source of truth: if Redis is unreachable every read returns `null` and every write is dropped, so the API keeps serving correct results straight from Postgres. Pattern invalidation uses `SCAN` with `MATCH`/`COUNT 200`, never `KEYS`.

### Auth
Not Better Auth, despite the README claim — the actual implementation is **Passport JWT**. `@nestjs/passport` `^10.0.3`, `passport` `^0.7.0`, `passport-jwt` `^4.0.1`, `@nestjs/jwt` `^10.2.0`. Password hashing is `bcrypt` `^5.1.1`. Access tokens are 15 minutes, refresh tokens 7 days, and refresh tokens are **rotated** on every refresh (the presented one is revoked and a new pair issued). Refresh tokens are stored as bcrypt hashes (cost 10) and verified with `bcrypt.compare`. Invite and password-reset tokens are stored as SHA-256 hashes only — the raw token never touches the database.

### Validation
`class-validator` `^0.14.0` and `class-transformer` `^0.5.1` on the backend, applied through a global `ValidationPipe` with `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true` and `enableImplicitConversion: true`. The frontend uses Zod `3.23.8` with `@hookform/resolvers` `3.9.1` for React Hook Form `7.53.2` form validation.

### Charting
Recharts `2.13.3` on the frontend.

### UI / component library
Shadcn/ui-style components built on Radix UI primitives, all on caret ranges: `react-avatar` `^1.3.1`, `react-collapsible` `^1.2.1`, `react-dialog` `^1.3.1`, `react-dropdown-menu` `^2.2.1`, `react-label` `^2.1.17`, `react-progress` `^1.2.1`, `react-scroll-area` `^1.4.0`, `react-select` `^2.4.1`, `react-separator` `^1.2.0`, `react-slot` `^1.5.0`, `react-switch` `^1.4.1`, `react-tabs` `^1.2.1`, `react-tooltip` `^1.4.1`, `react-visually-hidden` `^1.2.13`. Icons are `lucide-react` `0.460.0`. Styling is Tailwind CSS `3.4.14` + `tailwindcss-animate` `^1.0.7` + `class-variance-authority` `^0.7.1` + `clsx` `2.1.1` + `tailwind-merge` `^3.7.0`. The design tokens are the Coinbase palette, hand-transcribed into the Tailwind config; `packages/design-system` is an empty placeholder directory. The `components.json` file is configured for the "new-york" shadcn style with `rsc: true` and lucide icons. A local component set exists at `components/ui`: avatar, button, card, dropdown-menu, input, search-input, select, separator, sheet, sidebar, skeleton, tooltip, user-avatar.

### PDF generation
**None.** There is no PDF-generation library — no `pdfkit`, no `pdfmake`, no Puppeteer, no Playwright, no headless-Chrome. Report output is Excel only, produced by `exceljs` `^4.4.0`. The `pdf-parse` `^1.1.1` and `pdfjs-dist` `3.11.174` dependencies are for *reading* PDFs (text extraction), and `@napi-rs/canvas` `^1.1.0` is the rasteriser used to render PDF pages to PNG for the AI reader. The README's "multi-sheet Excel reports" claim is accurate; a PDF report capability does not exist.

### Email
`nodemailer` `^10.2.1` over generic SMTP. Delivery is asynchronous through the `email-jobs` BullMQ queue, so the API never blocks on an SMTP round trip. If the queue is unavailable the service falls back to sending inline. Templates live as HTML files under `email/templates` (`invite.template`, `password-reset.template`).

### Data fetching (frontend)
TanStack React Query `5.59.20` with the devtools package at the same version. The QueryClient defaults are: `staleTime` 60 s, `gcTime` 10 min, `refetchOnWindowFocus: false`, `refetchOnReconnect: true`, retry twice with 4xx errors excluded, mutations never retried. Axios `1.7.7` is the HTTP client with `withCredentials: true`, a 30 s timeout, and interceptors that attach the bearer token and handle silent token refresh (single-flight, with `/auth/login`, `/auth/refresh` and `/auth/accept-invite` exempt so a wrong-password 401 does not trigger a refresh loop).

### AI / OCR third-party services — two distinct providers
This is the most important correction to the documentation, which only mentions one provider.

**Hugging Face Inference API** (`@huggingface/inference` `^2.6.4`), used by the OCR module for scanned marks statements. Three models are configured in `ocr/hf-models.ts`: `microsoft/table-transformer-structure-recognition` (max input 50 MB, table detection enabled), `microsoft/trocr-base-handwritten` (max input 10 MB), and `PaddlePaddle/PaddleOCR` (max input 10 MB). Model selection is by content hint: table-like content → Table Transformer, handwriting → TrOCR, otherwise PaddleOCR. Calls use `imageToText` plus `objectDetection` against `microsoft/table-transformer-detection`. Authentication is `HF_API_TOKEN`. The service reports a hard-coded confidence of `0.85`.

**GROQ** (OpenAI-compatible chat completions at `api.groq.com/openai/v1`), used by the scheme reader to read a syllabus PDF into structured course rows. This is a hand-written client over `fetch`, not an SDK. Default reader model `qwen/qwen3.8-27b`; the guard model is `meta-llama/llama-prompt-guard-2-86m`, a prompt-injection guard that inspects a document *before* the reader sees it. The client implements a timeout, exponential backoff with retries only for retryable failures (network, 5xx, 429 — not malformed responses), honours a provider-supplied `try again in Ns` hint capped at 60 s, maps provider status codes onto a small `AiErrorKind` enum, and redacts the API key from every logged body. Authentication is `GROQ_API_KEY`. The design principle is stated explicitly in the code: the AI is an accelerator, never a dependency — if the key is missing the system keeps working because a scheme can be entered by hand.

**No other AI provider** is present. There is no OpenAI, Anthropic, Azure, Google or local-model integration anywhere in the source.

### Object storage
`@aws-sdk/client-s3` `^3.1161.0` against any S3-compatible endpoint — Neon Storage in the intended deployment, but AWS S3, Cloudflare R2 and MinIO all work by changing the endpoint. `AWS_S3_FORCE_PATH_STYLE` exists because Neon Storage and MinIO put the bucket in the path while AWS and R2 put it in the hostname. When no bucket is configured the service falls back to local-disk storage under a configurable directory, and every local path is resolved and checked against the storage root so a crafted filename cannot escape it.

### Logging
`winston` `^3.11.0` with `winston-daily-rotate-file` `^4.7.1` for daily log rotation.

### Testing framework per app
- **Backend**: Jest `^29.7.0` with `ts-jest` `^29.1.2`, `testEnvironment: node`, `rootDir: src`, test regex `.*\.spec\.ts$`. Coverage goes to `../coverage`, collected from all TS files. A separate `test:e2e` script points at `./test/jest-e2e.json`, but **that directory does not exist** — the e2e script is aspirational and will fail as written. `supertest` `^6.3.4` is installed as a dev dependency.
- **Frontend**: Jest `29.7.0` + `ts-jest` `29.2.5` + `jest-environment-jsdom` `29.7.0` + Testing Library (`@testing-library/react` `16.1.0`, `@testing-library/jest-dom` `6.6.3`, `@testing-library/user-event` `14.5.2`). The config uses `next/jest` for SWC-based transforms and a **custom jsdom environment** (`__tests__/helpers/jsdom-without-canvas.ts`) because the native `canvas` package is present but unbuilt on this machine and jsdom throws on startup if it tries to load it. A `canvas-mock.ts` module mapper stubs the optional dependency. The config exports an **async** function because `next/jest` is async — a synchronous export silently produces an invalid config.
- **Workers**: Jest `^29.7.0` with `ts-jest` `^29.1.2`, `testEnvironment: node`, `testRegex: .*\.spec\.ts$`, and the test script uses `--passWithNoTests`.

The README claims "Jest (backend), Vitest (frontend), Playwright (E2E)". Only the Jest part is true; there is no Vitest and no Playwright anywhere in the repo.

### Turborepo
`turbo` `2.3.3` at the root, with `prettier` `3.2.4`, `rimraf` `6.0.1` and `typescript` `5.6.3` as root dev dependencies.

---

## 2. Monorepo Layout

The workspace is `pnpm-workspace.yaml` with `apps/*` and `packages/*` globs. `allowBuilds` whitelists exactly six post-install build scripts: `@nestjs/core`, `@prisma/client`, `@prisma/engines`, `bcrypt`, `msgpackr-extract`, `prisma`.

**`apps/backend`** — NestJS API, port 3001. Holds the Prisma schema and migrations, the seed script, the Swagger setup, roughly 25 feature modules (auth, users, rbac, branches, academic, schemes, subjects, allocations, class-overview, students, marks, upload, scheme-reader, pdf-parser, ocr, reports, toppers, analytics, dashboard, audit-logs, notifications, invites, password-reset, health, cache, storage, email), and the shared common layer (guards, interceptors, filters, decorators, constants, AI clients, PDF renderer, services).

**`apps/frontend`** — Next.js 14 App Router, port 3000. `app/` (route groups), `components/ui/` (shadcn components), `components/` (feature components), `hooks/` (React Query hooks), `lib/` (`api/`, `auth/`, `query/`, `context/`, `services/`, `constants/`, `types/`, `utils/`), `__tests__/`.

**`apps/workers`** — a **read-only BullMQ queue supervisor**, not a job consumer. It watches `upload-jobs`, `ocr-jobs`, `reports-jobs` and `email-jobs` and reports waiting/active/delayed/failed counts, the age of the oldest waiting job, and failed job errors, every 60 s (`WORKER_REPORT_INTERVAL_MS`). It deliberately does not consume the queues, because each processor needs the backend's own services, and a second consumer acknowledging a job it did not perform would turn a visible failure into invisible data loss. It handles SIGINT/SIGTERM cleanly.

**`packages/shared-types`** — TypeScript types and role vocabulary shared by backend, frontend and workers: the `UserRole` union (SUPER_ADMIN, ADMIN, HOD, PRINCIPAL, TEACHER, STUDENT), the role ordering used to decide who may grant which role, `INVITABLE_ROLES` (SUPER_ADMIN excluded by design), `BRANCH_SCOPED_ROLES`, and the `SchemeDocument`/`SchemeCourse`/`SchemeWarning` interfaces the scheme reader produces.

**`packages/shared-constants`** — the shared-constants catalogue: the `PERMISSIONS` catalogue (~50 permission strings), the `ROLE_PERMISSIONS` map binding each role to its permissions, `EXAM_TYPES`, `SCHEMES` (2019/2022/2024), `DEFAULT_ACADEMIC_YEAR` (`2024-25`), `FILE_UPLOAD` limits, `PAGINATION` defaults, `CACHE_KEYS`, `CACHE_TTL` and `RATE_LIMITS`. It also exports the **capability layer** (screens, capabilities, academic derivation) and the academic helpers. The capability layer is imported by *both* sides — the backend to enforce a decision, the frontend to hide what the member may not use — and a backend spec asserts that the two agree.

**`packages/design-system`** — an empty placeholder directory. The Coinbase tokens live directly in the frontend's Tailwind config.

**What is genuinely shared** between backend and frontend: role and permission definitions, the capability/screen catalogue, academic-semester derivation, file-upload limits, pagination defaults, cache-key and TTL conventions, rate-limit constants, and the scheme/type unions. Both Jest configs map the shared packages to their TypeScript sources (frontend) or to their built `dist` output (backend); the backend therefore requires the shared packages to be built before its tests run.

---

## 3. Local Setup Procedure

1. **Install prerequisites.** Node.js 18 or newer and pnpm 9 or newer. A reachable PostgreSQL and a reachable Redis are both required — the backend needs Prisma and BullMQ to boot. The intended database is **Neon Cloud**; there is no local PostgreSQL in this project's workflow. The `scripts.md` file notes that the Neon connection string must use the **direct** (non-pooler) hostname, because a `-pooler.` hostname is IPv6-only and fails with `P1001` on machines without IPv6.
2. **Install dependencies** from the repository root with `pnpm install`. The `pnpm-workspace.yaml` `allowBuilds` list handles the native post-install builds; do not add packages that need their own build script without adding them to that list.
3. **Create the backend environment file** by copying the backend's `.env.example` to `.env` in the same directory. It contains placeholders only — no real values.
4. **Set the backend environment variables** (names and purposes, no values): `NODE_ENV` (development or production), `PORT` (the API port, defaults to 3001), `CORS_ORIGIN` (comma-separated allowed origins, defaults to the frontend's origin), `DATABASE_URL` (the Neon PostgreSQL connection string — required), `JWT_SECRET` and `REFRESH_SECRET` (separate long random secrets of at least 32 characters — required in production), `JWT_EXPIRES_IN` (default 15 minutes), `REFRESH_EXPIRES_IN` (default 7 days), `BCRYPT_ROUNDS` (default 12), `REDIS_HOST`/`REDIS_PORT`/`REDIS_PASSWORD`/`REDIS_DB` (the cache and queue connection, defaults localhost:6379 db 0), the SMTP block — `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_FROM_NAME` — `FRONTEND_URL` (used to build the accept-invite link), `INVITE_TOKEN_TTL_HOURS` (default 168, i.e. seven days), the storage block — `AWS_ENDPOINT_URL_S3`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` (default us-east-2), `AWS_S3_BUCKET`, `AWS_S3_FORCE_PATH_STYLE` — `MAX_FILE_SIZE_BYTES` (default 52428800, i.e. 50 MB), the Hugging Face block — `HF_API_TOKEN`, `HF_MODEL_TABLE`, `HF_MODEL_TEXT` — and the throttle block — `THROTTLE_SHORT_TTL`, `THROTTLE_SHORT_LIMIT`, `THROTTLE_MEDIUM_TTL`, `THROTTLE_MEDIUM_LIMIT`, `THROTTLE_LONG_TTL`, `THROTTLE_LONG_LIMIT`.
5. **Set the additional AI variables** (not present in `.env.example` but read by the code): `GROQ_API_KEY` (scheme reader; the feature degrades gracefully when absent), `GROQ_BASE_URL` (defaults to the GROQ OpenAI-compatible endpoint), `GROQ_MODEL` (defaults to `qwen/qwen3.8-27b`), `GROQ_GUARD_MODEL` (defaults to `meta-llama/llama-prompt-guard-2-86m`), `GROQ_TIMEOUT_MS` (60000), `GROQ_MAX_RETRIES` (2), `GROQ_MAX_INPUT_CHARS` (200000), `GROQ_MAX_OUTPUT_TOKENS` (450), `GROQ_MIN_GAP_MS` (31000), `GROQ_MAX_INPUT_CHARS_PER_CALL` (1200), `GROQ_GUARD_MIN_GAP_MS` (2100). Also `PASSWORD_RESET_TTL_MINUTES` (default 30), `STORAGE_LOCAL_DIR` (default `uploads`), `STORAGE_PUBLIC_BASE_URL`, and `WORKER_REPORT_INTERVAL_MS` (default 60000).
6. **Create the frontend environment file** by copying the frontend's `.env.example` to `.env`. It declares exactly two variables: `NEXT_PUBLIC_API_URL` (the backend's versioned API base, e.g. `http://localhost:3001/api/v1`) and `NEXT_PUBLIC_APP_NAME` (the display name).
7. **Generate the Prisma client** with `pnpm db:generate` (runs `prisma generate` in the backend).
8. **Apply migrations** with `pnpm db:migrate` (which runs `prisma migrate deploy`). The project deliberately never uses `prisma migrate dev` for applying changes, because `deploy` never creates a migration file and is safe to re-run. To author a *new* migration, run `prisma migrate dev --name <change>` from the backend directory, then apply it with `pnpm db:migrate`.
9. **Seed the database** with `pnpm db:seed`. The seed writes the permission rows, the role-to-permission bindings and an admin user, and is the live source of truth the shared-constants package mirrors.
10. **Start everything** with `pnpm dev` from the root — Turborepo fans out to the frontend, the backend and the worker. To run one app at a time use the workspace filter for the frontend, the backend, or the workers package.
11. **Verify** with `pnpm db:studio` to browse data, and open the Swagger UI (development only) and the health endpoint to confirm the API is up.

---

## 4. Ports and Services

| App | Port | Notes |
|---|---|---|
| Frontend | 3000 | Next.js dev server; serves the UI and the middleware. |
| Backend API | 3001 | NestJS; the versioned API is served under an `/api/v1` prefix. |
| Swagger UI | 3001 | Served at `/api/docs`, only when `NODE_ENV` is not production. |
| Health check | 3001 | Served under `/api/v1/health`. |
| Worker | none | A supervisor process; it opens no listener and connects outbound to Redis only. |
| Redis | 6379 | Defaults to localhost. Shared by the cache and all four BullMQ queues — the same `REDIS_DB` is used for both. |
| PostgreSQL | remote | Neon Cloud, no local instance. |

API versioning is URI-based with the prefix `api/v` and a default version of `1`, so the effective base path is `/api/v1` — matching the frontend's `NEXT_PUBLIC_API_URL`.

---

## 5. Testing Setup

**Frameworks.** Jest 29 in all three apps, with ts-jest on the backend and workers and `next/jest` (SWC) on the frontend. Testing Library for the frontend, supertest installed on the backend.

**Where test files live.** Backend: co-located with the source as `*.spec.ts` under `src/`. Worker: co-located under `src/`. Frontend: a dedicated `__tests__/` tree — `__tests__/components/`, `__tests__/lib/`, `__tests__/lib/auth/`, with helpers in `__tests__/helpers/`.

**Current coverage.** The backend has 18 spec files covering the AI layer (document guard, scheme reader, a live scheme-reader spec), RBAC constants and parity with the seed, the HTTP exception filter, the PDF document renderer (including a real-PDF spec), scope and URL-guard services, academic utilities and parity, the scheme calculator, the reports controller, and the DBATU statement parser. The frontend has 4 spec files. The worker has 1. The root-level `test.md` is not an automated test suite but a manual end-to-end functional report produced by driving the browser with Chrome DevTools MCP across seven isolated role contexts (Super Admin, Admin, HOD, Principal, Teacher, Student, plus a real-format upload context) — it records findings by severity.

**How to run them.** `pnpm test` at the root runs every workspace's suite; `pnpm --filter <package> test` runs one. Per-app extras: `test:watch` on the backend and frontend, `test:cov` on the backend and frontend, and `test:e2e` on the backend pointing at a config file that does not yet exist.

**Coverage config and thresholds.** Coverage output goes to `../coverage` (backend and workers) and `../coverage/frontend` (frontend). The frontend collects from `components/`, `lib/` and `hooks/`. **No coverage thresholds are configured anywhere**, and the CLAUDE.md target of 80% on critical paths is not enforced by tooling.

**What is not covered.** No Playwright or other browser E2E suite, no dedicated integration suite against a live database, and no CI that runs any of it.

---

## 6. Deployment Story

**There is no deployment configuration in the repository.** An exhaustive search found no Dockerfile, no docker-compose file, no `.github/workflows`, no `vercel.json`, no `railway.json`, no `render.yaml`, no `Procfile`, no Kubernetes manifests and no infrastructure-as-code of any kind. The only YAML files in the repo are `pnpm-workspace.yaml` and `pnpm-lock.yaml`. The backend `scripts/copy-assets.js` is a build-time asset copier, not a containerisation script.

**Intended hosting, inferred from the code and documentation.** The application is built for a serverless deployment:
- **Database**: Neon Cloud (serverless Postgres). The code is explicitly written around it — the Prisma module injects `connection_limit=10` and `pool_timeout=20` into the connection URL because "Prisma sizes its pool from the CPU count, which on a small container opens more connections than the provider allows", and a query extension retries the four transient connectivity codes (P1001, P1002, P1008, P2024) with exponential backoff from a 500 ms base, up to four attempts, because the provider suspends after inactivity and the first request after a suspend pays the wake-up cost. P1017 is deliberately excluded because the statement may already have executed.
- **Storage**: Neon Storage (S3-compatible), with AWS S3 / Cloudflare R2 / MinIO all supported by configuration.
- **Cache and queue**: Redis — Upstash or local, per the README.
- **Frontend**: Next.js 14, deployable to any Node host or a serverless platform; `next build` / `next start` are the entry points and `next.config.js` contains no platform-specific settings.
- **Backend**: `nest build` produces `dist/`, and `start:prod` runs `node dist/main`. The build step runs `nest build && node scripts/copy-assets.js`.

**Production environment variables required.** All of the backend variables listed in section 3, with `NODE_ENV=production`; in production the Swagger UI is not mounted at all, and `CORS_ORIGIN` must name the real frontend origin. `JWT_SECRET` and `REFRESH_SECRET` must be distinct real secrets — the config file's fallback value is literally `change-me-in-production`, so a missing variable silently produces a known secret rather than a boot failure. `GROQ_API_KEY` and `HF_API_TOKEN` are optional (both features degrade gracefully). The frontend needs `NEXT_PUBLIC_API_URL` pointing at the deployed API.

**Two deployment blockers worth flagging.** First, the backend's Jest `moduleNameMapper` resolves the shared packages to their built `dist/` output, and the backend's own `tsconfig` paths do the same — so `packages/shared-types` and `packages/shared-constants` must be built before the backend is built or started. The root `turbo.json` encodes this with `dependsOn: ["^build"]` on build, lint and type-check, so a `pnpm build` from the root handles it correctly; a bare `nest build` in the backend directory does not. Second, the worker process is currently a supervisor, so a deployment that starts it alongside the backend gains monitoring but no additional job throughput — the backend alone runs all four processors.

---

## 7. Performance-Relevant Configuration

**Cache TTLs.** The backend's default cache TTL is 300 seconds (5 minutes), applied by the cache service to every `set`/`setJson` unless overridden. The shared-constants catalogue defines finer-grained TTLs for specific keys: user permissions 5 minutes, branch list 1 hour, scheme list 1 hour, scheme rules 30 minutes, subjects list 1 hour. The RBAC permission cache is invalidated in O(1) by a global version counter that any RBAC mutation bumps, which orphans every previously cached permission set at once rather than walking affected users. Cache-key invalidation by pattern uses `SCAN`, never `KEYS`.

**Frontend cache TTLs.** React Query `staleTime` 60 s, `gcTime` 10 minutes, `refetchOnWindowFocus: false`, `refetchOnReconnect: true`, 2 retries with 4xx excluded. Invalidation is centralised in an `invalidationRules` module that names each affected key family explicitly, rather than relying on prefix matching.

**Rate limits.** Three global tiers from the throttler module: short (3 requests/second), medium (100/minute), long (1000/hour). Per-route overrides via the throttle decorator: login 5 per 15 min, register 10 per 15 min, forgot password 20 per 15 min, password reset 5 and 10 per 15 min, invites 10 per 15 min, upload 10 per hour, report generation 5 per hour, scheme reader 10 per hour, analytics 30 per minute, dashboard 60–120 per minute. The shared-constants catalogue mirrors these as named constants (LOGIN, UPLOAD, REPORT_GENERATE, GENERAL_API, ANALYTICS). `express-rate-limit` `^7.2.0` is also declared as a dependency.

**Upload size limits.** 50 MB, expressed in three places that must agree: `MAX_FILE_SIZE_BYTES` (default 52428800), `UploadService.MAX_FILE_SIZE` (`50 * 1024 * 1024`), the multer interceptor limit (`50 * 1024 * 1024`), and `FILE_UPLOAD.MAX_SIZE_BYTES` in the shared constants. The scheme reader has its own, tighter limit of 20 MB for syllabus documents.

**Queue concurrency.** No processor sets an explicit concurrency, so all four run at BullMQ's default of 1 concurrent job. Job retention: `removeOnComplete: true` for OCR and upload jobs, `removeOnComplete: 50` for reports and email jobs, `removeOnFail: 100` across the board. Email jobs are configured with 3 attempts and exponential backoff from a 5 s delay.

**Pagination defaults.** Page 1, page size 20, maximum page size 100 (shared constants). The toppers repository enforces a default limit of 10 with a floor of 1.

**Timeouts.** The default HTTP request timeout is 30 000 ms, enforced by a global timeout interceptor; individual routes may declare a longer one through a decorator, which the scheme reader does because reading a syllabus PDF legitimately takes longer. The frontend Axios client has a matching 30 s timeout. The GROQ client defaults to 60 s per attempt. The document renderer is limited by character budget rather than time.

**Prisma connection pooling.** `connection_limit=10` and `pool_timeout=20` are appended to the database URL if not already present, preserving existing `sslmode` and `channel_binding` parameters. Connection establishment on boot is itself retried, so the application boots instead of failing module initialisation against a cold serverless provider.

**AI pacing.** Calls to the GROQ reader are spaced a minimum of 31 000 ms apart, with a 2 100 ms gap between guard calls, because the provider's per-minute output-token limit is the binding constraint. Output is capped at 450 tokens per call and input at 1 200 characters per call, so a large page is read in pieces rather than truncated. The cost estimate that drives the page-splitting arithmetic is 40 tokens per course.

**Logging.** Winston with daily file rotation, so log volume does not grow unbounded.

---

## 8. Security-Relevant Configuration

**CORS.** Enabled with a comma-separated `CORS_ORIGIN` allowlist (defaulting to the frontend's localhost origin) and `credentials: true`.

**Helmet.** Enabled globally as the first middleware, so every response carries the standard security headers.

**Cookies.** `cookie-parser` is installed and mounted. However, the session is stored client-side in `localStorage` and the access token is sent as an `Authorization: Bearer` header — there are no `httpOnly`, `secure` or `sameSite` cookie flags set anywhere in the source, because no auth cookie is issued. The `withCredentials: true` on the Axios client is therefore forward-looking rather than load-bearing today. The trade-off is that the access and refresh tokens are reachable by any script running on the page, which is a weaker posture than an httpOnly cookie.

**Token expiry.** Access 15 minutes, refresh 7 days. Refresh rotation is enforced server-side: the presented token is revoked and a fresh pair issued, so a stolen refresh token is usable at most once. Refresh tokens are bcrypt-hashed at cost 10 before storage and verified with `bcrypt.compare`.

**Password hashing.** bcrypt at 12 rounds by default, configurable via `BCRYPT_ROUNDS`. Password hashes are never returned by the API.

**Token storage for non-JWT secrets.** Invite tokens and password-reset tokens are hashed with SHA-256 and only the hash is persisted; the raw token exists only in the emailed link. Invite expiry is 168 hours (7 days) by default; password-reset links expire after 30 minutes by default.

**File validation.** Uploads are validated on three axes before anything is queued: the declared size against the 50 MB cap, the extension against a type table mapping `.pdf`, `.csv`, `.xlsx`, `.xls`, `.txt`, `.png`, `.jpg`, `.jpeg`, `.gif` and `.webp` to their content types, and the **magic bytes** of the uploaded buffer (the code checks for the PDF, ZIP/XLSX and UTF-8-BOM CSV signatures). The scheme reader additionally caps at 20 MB. The file-download route is JWT-guarded and ownership-checked — a stored file may hold a result statement or a profile picture, so the reader must be the owner or an administering member.

**SSRF protection.** A dedicated URL-guard service checks any URL the server is about to fetch — both when the upload job is created and again at the moment the processor fetches it — so a crafted address pointing at a server-only network resource is refused before it is visited.

**Path traversal.** Every local storage path is resolved and verified to be inside the storage root, so a crafted filename cannot escape it.

**Input validation.** The global validation pipe whitelists allowed DTO properties and *forbids* non-whitelisted ones, so an unexpected field is a 400 rather than a silently-ignored mass-assignment. Zod validates on the frontend.

**Authorization model.** Permissions are the only gate — there is no role guard, because role names are bundles of permissions and never gates in themselves. A global `PermissionsGuard` reads the effective permission set (the union across every role the member holds, branch-scoped where the role is branch-scoped), and that set is cached in Redis under a versioned key. A separate global `ForcePasswordChangeGuard` blocks every route while a password change is pending. Scope is derived from the caller and never accepted as a request parameter.

**Prompt-injection defence.** A dedicated guard model inspects an externally-supplied document for instructions aimed at the reader *before* the reader sees it, and its verdict is recorded and surfaced to the reviewer.

**Audit trail.** Every route decorated with the audit decorator writes an audit row. The audit interceptor is registered through the Nest DI container rather than `useGlobalInterceptors`, deliberately, so it ends up outermost — outside the transform interceptor and the request timeout — and the audit write completes before the response is sent.

**Error handling.** A single global exception filter shapes every error response; internal detail never reaches the client, and each error carries a request id.

**Rate limiting as a security control.** The per-route limits above (login 5 per 15 min, password reset 5 per 15 min) are the brute-force defences.

**Two gaps.** There is no CSRF protection, which is acceptable only because no cookie-based credential is used — it becomes a real gap the moment a cookie-based session is introduced. And there is no virus scanning on uploads, despite the CLAUDE.md requirement; the current defence is type and magic-byte validation only.

---

## 9. Build and Tooling

**Linting.** ESLint 8 at the root (`eslint:recommended` plus `@typescript-eslint/recommended`), with `no-unused-vars` as an error honouring an underscore-argument convention, `no-explicit-any` as a warning, and `no-console` as a warning allowing only `console.warn` and `console.error`. The backend has its own config with type-aware parsing (`project: tsconfig.json`) and extends `eslint-plugin-prettier`. The frontend has no separate ESLint config file — it uses `next lint` with `eslint-config-next` `14.2.18` and `eslint` `8.57.1`.

**Formatting.** Prettier 3.2.4 at the root with `semi: true`, `singleQuote: true`, `tabWidth: 2`, `trailingComma: "es5"`, `printWidth: 100`, `arrowParens: "always"`. The backend has its own `format` script scoped to `src/**/*.ts`; the root `format` script covers the whole repo. `.editorconfig` enforces LF endings, 2-space indent, a final newline and trimmed trailing whitespace.

**TypeScript strictness.** `strict: true` in both the backend and the frontend, with the backend's additional strict flags noted in section 1. The frontend uses `moduleResolution: "bundler"`, `isolatedModules: true` and `noEmit: true`, with the Next.js plugin. Both apps define path aliases — the frontend uses `@/` plus per-directory aliases, the backend uses `@/`, `@common/`, `@modules/` and `@config/`.

**Build order.** Turborepo manages it via `dependsOn: ["^build"]`: shared packages build first, then the apps. Build outputs are `dist/**` for the backend and worker and `.next/**` (excluding `.next/cache/**`) for the frontend. The backend's build is `nest build && node scripts/copy-assets.js`; the Nest CLI is configured with `deleteOutDir: true`. The worker builds with plain `tsc -p tsconfig.json`.

**Root scripts.** `dev` (all apps, uncached and persistent), `build`, `lint`, `test`, `type-check`, `clean` (removes build artifacts and the Turborepo cache), `format`, and the five database helpers (`db:generate`, `db:migrate`, `db:deploy`, `db:seed`, `db:studio`).

**Docker.** None. There is no Dockerfile anywhere in the repository, in any app or package.

**CI.** None. There is no `.github/workflows` directory and no other pipeline definition.

**Known tooling hazard.** The project memory records that setting `script-shell` in the pnpm `.npmrc` breaks every script. Given the Windows invocation environment, the correct way to call pnpm, jest, tsc, next and prisma is through the pnpm workspace filters rather than by invoking the binaries directly.

---

## Summary of Documentation-vs-Code Discrepancies

These are the places where the checked-in documentation does not match the running system. Each was verified against the source.

1. **Auth library** — the README says Better Auth; the code uses Passport JWT with NestJS guards.
2. **AI provider** — the README mentions only Hugging Face for OCR; the scheme reader actually calls GROQ with a prompt-injection guard model, and the GROQ variables are absent from `.env.example` entirely.
3. **Frontend test runner** — the README says Vitest; the code uses Jest with `next/jest`.
4. **E2E** — the README says Playwright; there is no Playwright in the repo, and the backend's `test:e2e` script points at a config file that does not exist.
5. **PDF parsing** — the README says pdfplumber/PyMuPDF (Python); the code is pure TypeScript using `pdf-parse` and `pdfjs-dist`.
6. **PDF generation** — implied by the "reports" framing but not implemented; reports are Excel only via `exceljs`.
7. **Worker role** — the README and `scripts.md` describe the worker as a BullMQ job consumer; it is a read-only queue supervisor, and the real processors run inside the backend.
8. **Deployment** — the README describes a Neon/Upstash/React stack but no deployment artefacts exist to make it realisable.
9. **Coverage threshold** — the CLAUDE.md mandates 80% on critical paths; no threshold is configured in any Jest config.
10. **Design-system package** — the README describes `packages/design-system` as the Coinbase source; it is an empty directory, and the tokens live in the frontend Tailwind config.
