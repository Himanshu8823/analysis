# Root scripts — what to run and when

`package.json` is strict JSON and cannot hold comments, so the notes for each
script live here. Run everything from the repo root.

---

## Dev

| Command | What it does |
|---|---|
| `pnpm dev` | Starts every app in the workspace: frontend (:3000), backend (:3001), and the BullMQ worker. Use this for day-to-day development. |

To run a single app:

```bash
pnpm --filter @result-analysis-system/frontend dev   # frontend only
pnpm --filter @result-analysis/backend dev            # backend only
pnpm --filter @result-analysis/workers dev            # worker only
```

---

## Database

The database is **Neon (hosted PostgreSQL)** — there is no local PostgreSQL.
The URL lives in `apps/backend/.env` as `DATABASE_URL`.

| Command | What it does | When |
|---|---|---|
| `pnpm db:generate` | Regenerates the Prisma Client from `schema.prisma`. | After every change to `schema.prisma`. |
| `pnpm db:migrate` | `prisma migrate deploy` — applies pending migrations to the database. | Any time the schema has pending migrations. |
| `pnpm db:deploy` | `prisma migrate deploy` — same as `db:migrate`. | Production deploy. Safe to run repeatedly. |
| `pnpm db:seed` | Seeds roles, permissions, and the admin user. | Once after the first migration. |
| `pnpm db:studio` | Opens Prisma Studio to browse the database. | Whenever you need to inspect data. |

> There is **no local database** — the only database is Neon (hosted
> PostgreSQL). `prisma migrate dev` is therefore not used anywhere in this
> project; migrations are applied with `prisma migrate deploy`, which never
> creates a migration file and is safe to run repeatedly.
>
> To create a new migration from schema changes, use
> `npx prisma migrate dev --name <change>` from `apps/backend` — it creates the
> migration file locally. Apply it with `pnpm db:migrate` afterwards.

### First-time setup against Neon

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

> The Neon connection string must use the **direct** (non-pooler) hostname.
> A `-pooler.` hostname is IPv6-only and will fail with `P1001: Can't reach
> database server` on machines without IPv6. Non-pooler hostnames have no
> `-pooler.` in them.

---

## Build & quality

| Command | What it does |
|---|---|
| `pnpm build` | Builds all apps and packages. |
| `pnpm lint` | Lints all apps and packages. |
| `pnpm type-check` | Type-checks all apps and packages without emitting. |
| `pnpm test` | Runs the test suites across the workspace. |
| `pnpm format` | Formats the repo with Prettier. |
| `pnpm clean` | Removes build artifacts and Turborepo caches. |

---

## Note on the worker

`apps/workers` consumes the BullMQ queues (`reports`, `ocr`). It runs as part of
`pnpm dev`. Its job handlers are placeholders — the real processors belong
alongside the backend modules that enqueue those jobs.
