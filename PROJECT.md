# DBATU Result Analysis System - Complete Project Plan

> **Status**: Source of Truth for all subagents
> **Last Updated**: 2026-10-19
> **Project Type**: Industry-level Full-Stack Product (NOT demo)

---

## 1. 🎯 Project Vision

**DBATU Result Analysis System** is a comprehensive web-based product that automates the complete result analysis workflow for DBATU affiliated colleges. It ingests student result data (Excel + PDF), processes it through scheme-aware calculation engines, identifies toppers, and produces rich reports with visualizations.

### Core Problem Being Solved:
- Manual result analysis takes 2-3 days for 100+ students
- Human errors in calculation
- No standardized scheme handling (DBATU has multiple schemes: 2019, 2022, 2024)
- No proper topper identification with tie handling
- No consistent reports or visualizations
- No role-based access (everyone sees everything or nothing)

### Solution:
A complete software product with proper MVC architecture, RBAC, automated OCR for image PDFs, queue-based processing, and a clean responsive UI built on the Coinbase Design System.

---

## 2. 🛠️ Tech Stack (LOCKED)

### Frontend:
- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript (strict mode)
- **Design System**: `npx getdesign@latest add coinbase` (ONLY source for colors/components)
- **State/Data**: TanStack React Query (server state)
- **HTTP Client**: Axios (with interceptors)
- **Forms**: React Hook Form + Zod
- **Charts**: Recharts (or design system charts)
- **Styling**: Tailwind CSS (config from coinbase design system)

### Backend:
- **Framework**: Nest.js (with MVC architecture: Controller → Service → Repository)
- **Language**: TypeScript (strict mode)
- **ORM**: Prisma
- **Auth**: Better Auth
- **Queue**: Bull MQ (for long-running tasks)
- **Cache**: Redis (ioredis)
- **PDF Parsing**: pdfplumber / PyMuPDF (text-based)
- **OCR**: Hugging Face open-source models (for image PDFs)
  - Primary: **Table Transformer** (for table structure detection)
  - Secondary: **PaddleOCR** or **Tesseract** (for text extraction)
  - Selection: Use model with best accuracy for table + handwritten text

### Database:
- **Primary DB**: PostgreSQL (Neon Cloud)
- **Storage**: Neon Storage (for Excel, PDF, generated reports)
- **Cache/Queue**: Redis (Upstash or local)

### Tooling:
- **Package Manager**: pnpm (monorepo)
- **Monorepo Tool**: Turborepo or pnpm workspaces
- **Linting**: ESLint + Prettier
- **Testing**: Jest (backend), Vitest (frontend), Playwright (E2E)

---

## 3. 📁 Monorepo Structure (MANDATORY)

```
result-analysis-system/
├── apps/
│   ├── frontend/                    # Next.js app
│   ├── backend/                     # Nest.js app
│   └── workers/                     # Bull MQ worker process
├── packages/
│   ├── shared-types/                # Shared TypeScript types
│   ├── shared-constants/            # Shared constants (roles, permissions, etc.)
│   └── design-system/               # Coinbase design system (after install)
├── prisma/                          # Root Prisma schema (for shared DB)
├── CLAUDE.md                        # Project rules
├── PROJECT.md                       # This file (source of truth)
├── package.json                     # Root package.json
├── pnpm-workspace.yaml              # Workspace config
├── turbo.json                       # Turbo config
└── README.md
```

---

## 4. 🏛️ Backend Architecture (Nest.js MVC)

### Per-Module Structure (apply to ALL modules):
```
modules/<feature>/
├── <feature>.module.ts            # Nest module definition
├── <feature>.controller.ts        # HTTP layer (routes, validation, guards)
├── <feature>.service.ts           # Business logic, orchestration
├── <feature>.repository.ts        # DB queries (Prisma)
├── dto/                           # Input validation
│   ├── create-<feature>.dto.ts
│   ├── update-<feature>.dto.ts
│   └── ...
├── entities/                      # (if needed, usually Prisma generates)
├── tests/
│   ├── <feature>.controller.spec.ts
│   ├── <feature>.service.spec.ts
│   └── <feature>.repository.spec.ts
└── interfaces/                    # Internal interfaces
```

### Backend Modules Required:
1. **AuthModule** - Better Auth integration
2. **UsersModule** - User CRUD
3. **RbacModule** - Roles & Permissions
   - sub: RolesSubModule, PermissionsSubModule, UserRolesSubModule
4. **BranchesModule** - Academic branches
5. **SchemesModule** - DBATU schemes (2019, 2022, 2024)
6. **SubjectsModule** - Subjects per scheme/branch/semester
7. **StudentsModule** - Student records
8. **MarksModule** - Marks entry + calculation engine
9. **UploadModule** - File upload handling
   - strategies: ExcelStrategy, PdfTextStrategy, PdfOcrStrategy
10. **PdfParserModule** - Text-based PDF parsing
11. **OcrModule** - OCR for image PDFs (Hugging Face)
12. **ReportsModule** - Report generation (Excel multi-sheet)
13. **ToppersModule** - Topper identification algorithms
14. **AnalyticsModule** - Aggregations and statistics
15. **AuditLogsModule** - User action tracking
16. **NotificationsModule** - Real-time notifications (WebSocket gateway)
17. **HealthModule** - Health checks

### Cross-Cutting Concerns:
```
common/
├── decorators/        # @Roles, @Permissions, @CurrentUser, @Public
├── guards/            # AuthGuard, RolesGuard, PermissionsGuard
├── interceptors/      # LoggingInterceptor, TransformInterceptor, TimeoutInterceptor
├── filters/           # HttpExceptionFilter (global), ValidationExceptionFilter
├── pipes/             # ValidationPipe (global), ParseUUIDPipe
├── middleware/        # RateLimitMiddleware, RequestIdMiddleware
└── utils/             # LoggerUtil, DateUtil, ResponseUtil
```

---

## 5. 🎨 Frontend Architecture (Next.js)

### Folder Structure:
```
apps/frontend/
├── app/
│   ├── (auth)/                     # Auth route group
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   ├── forgot-password/page.tsx
│   │   └── layout.tsx              # Simple layout
│   │
│   ├── (authenticated)/            # Protected route group
│   │   ├── dashboard/
│   │   │   ├── page.tsx
│   │   │   └── _components/        # Page-local components
│   │   ├── upload/
│   │   │   ├── page.tsx
│   │   │   └── _components/
│   │   ├── students/
│   │   │   ├── page.tsx
│   │   │   └── _components/
│   │   ├── reports/
│   │   │   ├── page.tsx
│   │   │   ├── [id]/page.tsx
│   │   │   └── _components/
│   │   ├── toppers/
│   │   │   ├── page.tsx
│   │   │   └── _components/
│   │   ├── analytics/
│   │   │   ├── page.tsx
│   │   │   └── _components/
│   │   ├── admin/                  # Admin only
│   │   │   ├── users/page.tsx
│   │   │   ├── schemes/page.tsx
│   │   │   └── _components/
│   │   └── layout.tsx              # Sidebar + Header layout
│   │
│   ├── api/                        # API routes (rarely used, mostly backend handles)
│   ├── layout.tsx                  # Root layout
│   ├── page.tsx                    # Landing/redirect
│   └── globals.css
│
├── components/
│   ├── ui/                         # From coinbase design system
│   ├── forms/                      # Reusable form components
│   ├── layout/                     # Sidebar, Header, etc.
│   ├── charts/                     # Chart wrappers
│   └── feedback/                   # Toast, Loading states
│
├── hooks/                          # ALL data fetching/mutations live here
│   ├── useAuth.ts                  # login, logout, register hooks
│   ├── useStudents.ts              # student CRUD hooks
│   ├── useSchemes.ts
│   ├── useSubjects.ts
│   ├── useMarks.ts
│   ├── useUpload.ts                # upload + status polling
│   ├── useReports.ts
│   ├── useToppers.ts
│   ├── useAnalytics.ts
│   └── useNotifications.ts
│
├── lib/
│   ├── api/
│   │   ├── client.ts               # Axios instance w/ interceptors
│   │   ├── interceptors.ts         # Auth token, refresh, error handling
│   │   └── endpoints.ts            # All API endpoint constants
│   │
│   ├── services/                   # Pure API call functions
│   │   ├── auth.service.ts
│   │   ├── students.service.ts
│   │   ├── schemes.service.ts
│   │   ├── upload.service.ts
│   │   └── ...
│   │
│   ├── query/
│   │   ├── queryClient.ts          # TanStack Query setup
│   │   ├── queryKeys.ts            # Centralized query keys factory
│   │   └── invalidationRules.ts    # Cache invalidation rules
│   │
│   ├── utils/                      # Pure utility functions
│   │   ├── formatters.ts           # Format marks, dates, percentages
│   │   ├── validators.ts           # Client-side validators
│   │   └── constants.ts            # Frontend-only constants
│   │
│   ├── types/                      # Frontend types (or import from packages/shared-types)
│   └── constants/
│
├── middleware.ts                   # Route protection middleware
├── next.config.js
├── tailwind.config.ts              # From coinbase design system
├── tsconfig.json
└── package.json
```

### Frontend Rules:
1. **Pages (`page.tsx`)** = composition only (no business logic, no API calls)
2. **Hooks (`use*.ts`)** = ALL data fetching + mutations (React Query)
3. **Services (`*.service.ts`)** = pure API call functions (no React)
4. **Components** = presentational + composition
5. **Server Components by default**, Client Components only when needed (interactivity, hooks, browser APIs)

---

## 6. 🗄️ Database Schema (Prisma)

### Core Tables:
- `User` (auth users)
- `Role`, `Permission`, `UserRole`, `RolePermission` (RBAC)
- `Branch` (CS, ME, CE, EE, etc.)
- `Scheme` (2019, 2022, 2024) + JSON rules
- `Subject` (linked to scheme + branch + semester)
- `Student` (rollNo, name, branchId, year, semester, schemeId, batchId)
- `Mark` (studentId, subjectId, examType, marksObtained, maxMarks, isAbsent)
- `AcademicYear`
- `Batch`
- `UploadJob` (file upload tracking + OCR job status)
- `Report` (generated report metadata)
- `AuditLog`
- `Notification`

### Key Indexes:
- `Student`: `(rollNo)`, `(branchId, currentYear, semester)`
- `Mark`: `(studentId, subjectId)`, `(studentId, examType)`
- `UploadJob`: `(status, createdAt)`

---

## 7. 🔐 RBAC (Permission-Based)

### Roles (Static):
- `SUPER_ADMIN` - All permissions
- `ADMIN` - Exam cell operations
- `HOD` - Department head
- `TEACHER` - Subject teacher
- `PRINCIPAL` - Read-only analytics
- `STUDENT` - (future) own result only

### Permissions (Dynamic):
- `students:read`, `students:write`
- `marks:read`, `marks:write`, `marks:edit_own_subject`
- `reports:read`, `reports:generate`, `reports:download`
- `upload:create`, `upload:process`
- `analytics:read`, `analytics:read_own_department`
- `users:read`, `users:write`
- `rbac:read`, `rbac:write`

### Permission Assignment Pattern:
- Roles have multiple permissions
- Users assigned to roles
- Teachers additionally have subject-level access (subjects they teach)

---

## 8. 📂 File Upload Pipeline

```
1. User uploads file (Excel/PDF)
2. Backend validates (type, size, max 50MB)
3. Backend determines strategy:
   - .xlsx/.xls/.csv → ExcelStrategy (fast)
   - PDF with text → PdfTextStrategy (medium)
   - PDF with images → PdfOcrStrategy (slow, queue)
4. For OCR:
   - Push job to Bull MQ
   - Worker picks up
   - Calls Hugging Face API with model
   - Extracts tables + text
   - Maps to expected structure
   - Updates job status
   - User gets notification
5. User reviews extracted data
6. User confirms → saves to DB
```

### Hugging Face Model Selection:
- **For tables**: `microsoft/table-transformer-structure-recognition`
- **For text**: `microsoft/trocr-base-handwritten` or `PaddlePaddle/PaddleOCR`
- **Decision**: Pick based on PDF type detection

---

## 9. 📊 Reports

### Excel Multi-Sheet Workbook:
- `Student_Wise_Result` - Per student breakdown
- `Scheme_Wise_Marks` - Scheme + subjects
- `Subject_Analysis` - Subject stats (avg, max, min, topper)
- `Student_Analysis` - Student performance + credits
- `Class_Toppers` - Overall ranking
- `Pass_Fail_Analysis` - Aggregated counts/percentages
- `Charts_Data` - Source data for charts

### Frontend Charts:
- Pass/Fail distribution (pie)
- Subject difficulty (bar)
- Topper comparison (horizontal bar)
- Marks distribution (histogram)
- Credits summary (stacked bar)

---

## 10. 🏆 Toppers Module (Algorithm)

### Subject Topper:
- Highest marks in subject
- Handle ties (list all)
- Exclude absent students
- Exclude withheld results

### Class Topper:
- Sum of marks OR percentage (configurable)
- Handle ties
- Subject-wise pass criteria before counting towards total

---

## 11. ⚡ Performance + Caching

### Backend (Redis):
- `cache:user:permissions:{userId}` (TTL 5min, invalidate on role change)
- `cache:branch:list` (TTL 1hr)
- `cache:scheme:rules:{schemeId}` (TTL 30min)
- `cache:report:{reportId}` (TTL 10min)

### Frontend (React Query):
- `staleTime: 1min` for list data
- `staleTime: 5min` for config data
- `gcTime: 10min` (formerly cacheTime)
- Invalidate precisely on mutations

### Rate Limiting (Real-world):
| Endpoint | Limit |
|----------|-------|
| `POST /auth/login` | 5 / 15min / IP |
| `POST /upload` | 10 / hour / user |
| `POST /reports/generate` | 5 / hour / user |
| `GET /api/*` (general) | 100 / min / user |
| `GET /api/analytics/*` | 30 / min / user |

Graceful degradation: queue overflow → friendly error with retry-after.

---

## 12. 📱 Responsive Design (3 Breakpoints)

**Mandatory breakpoints:**
- **Mobile**: < 768px
- **Tablet**: 768-1023px
- **Desktop**: >= 1024px

**Implementation rules:**
- Mobile-first Tailwind classes
- Charts: stack on mobile, side-by-side on desktop
- Tables: card view on mobile, table on desktop
- Modals: bottom-sheet on mobile, centered on desktop
- Navigation: hamburger on mobile, sidebar on desktop
- Touch targets: min 44x44px on mobile
- No horizontal scroll at any breakpoint

---

## 13. 🚀 Implementation Phases

### Phase 1: Foundation (Week 1)
- Monorepo setup (pnpm + Turbo)
- Backend: Nest.js + Prisma + Neon
- Frontend: Next.js + Coinbbase design system
- Auth (Better Auth) + RBAC skeleton
- Health checks

### Phase 2: Core Data (Week 2)
- Branches, Schemes, Subjects, Students CRUD
- RBAC enforcement
- Form validation
- List views (responsive)

### Phase 3: Marks + Calculation (Week 3)
- Marks module + scheme-aware calculation engine
- Calculator factory pattern (2019, 2022, 2024 strategies)
- Marks entry form
- Result calculation

### Phase 4: File Upload + Processing (Week 4-5)
- Upload module + strategies
- Excel parser
- PDF text parser
- OCR integration (Hugging Face + Bull MQ workers)
- Worker process (separate `apps/workers`)
- Upload job tracking + status polling

### Phase 5: Reports + Toppers (Week 6)
- Excel multi-sheet generation
- Topper algorithms
- Analytics aggregations

### Phase 6: Frontend Polish (Week 7)
- Charts integration
- Responsive verification on 3 sizes
- Performance optimization
- Accessibility

### Phase 7: Hardening (Week 8)
- Rate limiting
- Audit logs
- Notifications
- Testing (unit + integration + e2e)
- Documentation
- Performance benchmarks

---

## 14. 📏 Code Standards

### Naming Conventions:
- **Backend**: `camelCase` (vars/functions), `PascalCase` (classes), `kebab-case` (filenames)
- **Frontend**: `camelCase` (vars/functions), `PascalCase` (components), `kebab-case` (files)
- **Constants**: `UPPER_SNAKE_CASE`
- **Database**: `snake_case` (Prisma handles mapping)

### File Naming:
- `*.controller.ts`, `*.service.ts`, `*.repository.ts`
- `*.dto.ts`, `*.entity.ts`, `*.spec.ts`
- React components: `PascalCase.tsx` OR `kebab-case.tsx` (pick one project-wide)

### Code Style:
- TypeScript strict mode everywhere
- ESLint + Prettier (run on save)
- No `any` (use `unknown` + type guard)
- Explicit return types on public functions
- JSDoc for public APIs
- No commented-out code

---

## 15. 🧪 Testing Strategy

| Layer | Tool | Coverage |
|-------|------|----------|
| Repository (Prisma) | Jest | 80%+ |
| Service (Business) | Jest | 85%+ |
| Controller (API) | Jest (supertest) | 75%+ |
| E2E | Playwright | Happy paths + critical security |
| Frontend Components | Vitest + Testing Library | 70%+ |
| Frontend Hooks | Vitest | 80%+ |

---

## 16. 🔒 Security Checklist

- [ ] Password hashing (bcrypt rounds=12)
- [ ] JWT with short expiry + refresh token
- [ ] CSRF for forms
- [ ] Input validation (DTO + Zod)
- [ ] Rate limiting (per IP + per user)
- [ ] SQL injection prevention (Prisma parameterizes)
- [ ] XSS prevention (sanitize HTML)
- [ ] File upload validation (type, size, magic bytes)
- [ ] HTTPS only in production
- [ ] Environment variables for secrets
- [ ] Audit log for all sensitive operations
- [ ] Permission check on EVERY endpoint (no client-side-only checks)

---

## 17. 📦 Deliverables Order (For Subagents)

### Agent 1: Bootstrap & Monorepo
- pnpm workspace setup
- Turbo config
- Root package.json
- README

### Agent 2: Backend Foundation
- Nest.js app
- Prisma schema (all tables)
- Database migrations
- Auth (Better Auth)
- Common (decorators, guards, interceptors, filters)
- HealthModule
- Base MVC module skeleton (UsersModule as example)

### Agent 3: Backend Domain Modules + Upload Pipeline
- Branches, Schemes, Subjects, Students, Marks modules (full MVC)
- Marks calculator (scheme strategies)
- Upload module + strategies (Excel, PDF text, OCR)
- OCR module with Hugging Face integration
- Bull MQ + worker process
- Toppers + Reports + Analytics modules

### Agent 4: Frontend Foundation + Auth + RBAC
- Next.js app with Coinbase design system
- Layout components (sidebar, header)
- Auth pages (login, register)
- Hooks + Services infrastructure
- React Query setup + query keys + invalidation
- API client + interceptors
- Middleware for route protection

### Agent 5: Frontend Pages + Features
- Dashboard
- Upload page (with status polling)
- Students, Schemes, Subjects, Marks pages (CRUD)
- Reports page
- Toppers page
- Analytics page
- Admin pages (users, schemes)
- All responsive (3 breakpoints)

---

## 18. 🎯 Success Criteria

- [ ] All 8 user rules from CLAUDE.md satisfied
- [ ] Complete MVC architecture for backend
- [ ] Complete hooks/services/components layering for frontend
- [ ] Strict 3-breakpoint responsiveness (mobile, tablet, desktop)
- [ ] ONLY Coinbase design system tokens/colors used
- [ ] RBAC enforcement on EVERY endpoint
- [ ] Rate limiting with real-world patterns
- [ ] Both caching layers (React Query + Redis) implemented
- [ ] OCR pipeline working with queue
- [ ] Excel multi-sheet report generation
- [ ] No temporary solutions
- [ ] Proper testing in place
- [ ] Documentation updated

---

**This document is the source of truth. All subagents must follow it strictly.**
