# DBATU Result Analysis System

> Industry-level, full-stack web product that automates DBATU-affiliated college result analysis — from ingest (Excel + PDF) through scheme-aware calculations to multi-sheet Excel reports and rich visualizations.

---

## Description

A complete software product that ingests student result data (Excel + PDF), processes it through scheme-aware calculation engines (DBATU 2019 / 2022 / 2024), identifies toppers with proper tie handling, and produces rich, multi-sheet Excel reports with visualizations.

The core problem solved: manual result analysis takes 2-3 days for 100+ students, with human errors in calculation, no standardised scheme handling, no proper topper identification, no consistent reports, and no role-based access. This product replaces that with an automated, audit-ready pipeline.

See [PROJECT.md](./PROJECT.md) for the complete project plan (source of truth).

---

## Tech Stack

### Frontend
- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript (strict mode)
- **Design System**: Coinbase (via `npx getdesign@latest add coinbase` — the only source for colors/components)
- **State / Data**: TanStack React Query
- **HTTP Client**: Axios with interceptors
- **Forms**: React Hook Form + Zod
- **Charts**: Recharts (or design system charts)
- **Styling**: Tailwind CSS (config from coinbase design system)

### Backend
- **Framework**: Nest.js (MVC: Controller -> Service -> Repository)
- **Language**: TypeScript (strict mode)
- **ORM**: Prisma
- **Auth**: Better Auth
- **Queue**: Bull MQ (long-running jobs)
- **Cache**: Redis (ioredis)
- **PDF Parsing**: pdfplumber / PyMuPDF (text-based)
- **OCR**: Hugging Face open-source models (Table Transformer + PaddleOCR / Tesseract)

### Database & Storage
- **Primary DB**: PostgreSQL (Neon Cloud)
- **Storage**: Neon Storage (Excel, PDF, generated reports)
- **Cache / Queue**: Redis (Upstash or local)

### Tooling
- **Package Manager**: pnpm (monorepo)
- **Monorepo Tool**: Turborepo or pnpm workspaces
- **Linting**: ESLint + Prettier
- **Testing**: Jest (backend), Vitest (frontend), Playwright (E2E)

---

## Monorepo Structure

```
result-analysis-system/
|-- apps/
|   |-- frontend/                  # Next.js app (:3000)
|   |-- backend/                   # Nest.js app (:3001), Prisma schema in apps/backend/prisma
|   |-- workers/                   # BullMQ worker process (long-running jobs)
|-- packages/
|   |-- shared-types/              # Shared TypeScript types
|   |-- shared-constants/          # Shared constants (roles, permissions, etc.)
|   |-- design-system/             # Reserved for the Coinbase design system package
|-- CLAUDE.md                      # Project rules
|-- PROJECT.md                     # Source of truth
|-- package.json                   # Root package.json (workspace scripts)
|-- pnpm-workspace.yaml            # Workspace config
|-- turbo.json                     # Turbo config
|-- README.md                      # This file
```

The Coinbase design tokens are currently applied directly in
`apps/frontend/tailwind.config.ts` (mirroring `DESIGN.md`); `packages/design-system`
is reserved for extracting them into a consumable package.

---

## Setup

### Prerequisites
- Node.js >= 18
- pnpm >= 9
- PostgreSQL (Neon Cloud recommended, or local)
- Redis (Upstash or local)

### Install
```bash
pnpm install
```

### Environment
Each app reads its own `.env` from its app directory:

```bash
copy apps\backend\.env.example apps\backend\.env    # Windows
cp apps/backend/.env.example apps/backend/.env      # macOS / Linux

copy apps\frontend\.env.example apps\frontend\.env
cp apps/frontend/.env.example apps/frontend/.env
```

At minimum, set `DATABASE_URL` in the backend `.env` to a reachable PostgreSQL
instance. `REDIS_HOST`/`REDIS_PORT` default to `localhost:6379`.

### Local services
The backend requires both PostgreSQL and Redis to boot (Prisma + BullMQ).

```bash
docker run -d --name ras-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_USER=postgres -e POSTGRES_DB=result_analysis -p 5432:5432 postgres:16
docker run -d --name ras-redis -p 6379:6379 redis:7
```

### Database setup
```bash
pnpm db:generate   # generate Prisma client
pnpm db:migrate   # apply migrations
pnpm db:seed      # seed roles, permissions and admin user
```

`pnpm db:studio` opens Prisma Studio to browse the database.

---

## Available Scripts

Run from the repo root. All tasks are coordinated by Turborepo (`turbo.json`).

| Script | Description |
|--------|-------------|
| `pnpm dev` | Run all apps in development mode (frontend :3000, backend :3001, workers) |
| `pnpm build` | Build all apps and packages |
| `pnpm lint` | Lint all apps and packages |
| `pnpm test` | Run all tests across apps and packages |
| `pnpm type-check` | Type-check all apps and packages |
| `pnpm clean` | Remove build artifacts and caches |
| `pnpm format` | Format all files with Prettier |
| `pnpm db:generate` | Generate the Prisma client |
| `pnpm db:migrate` | Create and apply a Prisma migration |
| `pnpm db:deploy` | Apply pending migrations (production) |
| `pnpm db:seed` | Seed the database |
| `pnpm db:studio` | Open Prisma Studio |

To run a single app, filter by workspace:

```bash
pnpm --filter @result-analysis-system/frontend dev
pnpm --filter @result-analysis/backend dev
```

### URLs

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:3001/api/v1 |
| Swagger docs | http://localhost:3001/api/docs |
| Health check | http://localhost:3001/api/v1/health |

---

## Documentation

- **[PROJECT.md](./PROJECT.md)** — Source of truth: vision, tech stack, architecture, schema, RBAC, reports, phases, and deliverables.
- **[CLAUDE.md](./CLAUDE.md)** — Project rules: design system, responsiveness (3 breakpoints), coding standards, RBAC, performance, and what is non-negotiable.

---

## Status

> **Bootstrapped.** Monorepo skeleton, root configs, shared-types, and shared-constants packages are in place. See PROJECT.md section 13 for the phased delivery plan.
