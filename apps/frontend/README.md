# DBATU Result Analysis — Frontend

The Next.js 14 app for the DBATU Result Analysis System. The entire UI is built
on the Coinbase design system tokens declared in `tailwind.config.ts` and
`app/globals.css`. No custom colors are introduced anywhere in this app.

## Stack

- Next.js 14 (App Router) + TypeScript (strict)
- TanStack React Query (server state + cache)
- Axios with refresh-token interceptor (`lib/api/client.ts`)
- React Hook Form + Zod (available; auth forms currently use controlled state)
- Recharts (analytics + toppers charts)
- Tailwind CSS (Coinbase tokens only — see `tailwind.config.ts`)

## Setup

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Environment variables (see `.env.example`):

| Variable | Default | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001/api/v1` | Backend base URL |

## Architecture

Strict layering enforced by the codebase:

```
app/                  ← pages only — composition, never API calls
  (auth)/             ← /login /register /forgot-password
  (authenticated)/    ← /dashboard /upload /students /reports /toppers /analytics /admin/*
hooks/                ← useAuth / useStudents / useReports / ... (data layer)
lib/services/         ← pure async functions (apiClient + ENDPOINTS)
lib/api/              ← axios client + endpoint constants
lib/query/            ← queryClient, queryKeys, invalidationRules
lib/utils/            ← formatters, validators, responsive helpers, toast context
components/           ← ui / forms / feedback / charts / layout
```

## Responsive Breakpoints (mandatory)

The app targets exactly three breakpoints — no `sm:` / `xl:` / `2xl:` anywhere.

| Name | Range | Prefix |
|---|---|---|
| Mobile | `< 768px` | default (no prefix) |
| Tablet | `768–1023px` | `md:` |
| Desktop | `≥ 1024px` | `lg:` |

Touch targets are ≥ 44px on mobile. Every table falls back to a card view on
mobile. Modals are full-width sheets on mobile and centered dialogs at `md:`.

## Pages

| Route | Description | Hooks |
|---|---|---|
| `/login` | Sign in with email + password | `useLogin` |
| `/forgot-password` | Send password reset link | `useForgotPassword` |
| `/dashboard` | KPI cards + recent uploads | `useDashboard` |
| `/upload` | Excel/PDF dropzone + job polling | `useCreateUploadJob` / `useUploadJob` / `useConfirmUpload` |
| `/students` | CRUD + bulk import + filters | `useStudents` / `useBranches` / `useSchemes` / `useImportStudents` |
| `/reports` | Generate + download Excel reports | `useGenerateReport` / `useReports` / `useDownloadReport` |
| `/toppers` | Subject + class toppers with tie handling | `useSubjectToppers` / `useClassToppers` |
| `/analytics` | KPI cards + 3 chart types | `useOverview` / `usePassFail` / `useSubjectDifficulty` / `usePerformanceTrends` |
| `/admin/members` | Members, pending invites, roles | `useMembers` / `useInvites` / `useInviteUser` |
| `/admin/schemes` | View + edit scheme rules JSON | `useSchemes` / `useUpdateScheme` |
| `/admin/assignments` | HOD allocations — subject-to-teacher and class teacher | `useTeacherAllocations` / `useClassTeacherAssignments` / `useSubjectOfferings` / `useAssignableTeachers` |

## Caching & Invalidation

React Query is configured globally in `lib/query/queryClient.ts`:

- `staleTime`: 60s default; lists use 60s, configs 5–30min.
- `gcTime`: 10min.
- No retries on 4xx.
- No refetch on window focus.

Mutations drive cache invalidation through `lib/query/invalidationRules.ts`
(e.g. `onStudentCreated`, `onMarksUpdated`, `onReportGenerated`).

## Scripts

```bash
pnpm dev          # Start the Next.js dev server
pnpm build        # Production build
pnpm start        # Run the production build
pnpm lint         # ESLint
pnpm type-check   # tsc --noEmit
```

## Conventions

- Server components by default; client components only when interactive.
- Pages never import `apiClient` directly. All data lives in hooks.
- Hooks never import React components. They expose React Query return values.
- Services are framework-free async functions.
- No `console.log` in production code. (The error boundary is the only
  intentional console call and is gated by `useEffect`.)