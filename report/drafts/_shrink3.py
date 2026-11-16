import io
from _shrink import rewrite

CH5 = [
# --- 5.1 table rationale shortening ---
(
"| Runtime and language | Node.js 18 or newer | A single runtime serves the browser client, the application service, the background worker and the shared packages, which removes the impedance of a polyglot deployment. |",
"| Runtime and language | Node.js 18 or newer | One runtime serves the browser client, the application service, the worker and the shared packages, removing the impedance of a polyglot deployment. |"
),
(
"| Package manager | pnpm 9.12.3 | A workspace-native package manager with a content-addressed store, which keeps five packages on one dependency graph without duplicating the dependency tree. |",
"| Package manager | pnpm 9.12.3 | A workspace-native package manager with a content-addressed store keeps five packages on one dependency graph without duplicating the tree. |"
),
(
"| Build orchestration | Turborepo 2.3.3 | Task graph execution with declared dependencies between packages and applications, so shared packages are always built before the applications that import them. |",
"| Build orchestration | Turborepo 2.3.3 | Task graph execution with declared dependencies, so shared packages are always built before the applications that import them. |"
),
(
"| Frontend framework | Next.js 14.2.18 (App Router) | Provides server rendering and route grouping out of the box, which suits an interface with a large number of permission-dependent screens. |",
"| Frontend framework | Next.js 14.2.18 (App Router) | Server rendering and route grouping out of the box, which suits an interface with many permission-dependent screens. |"
),
(
"| Frontend language | TypeScript 5.6.3, React 18.3.1 | Static types across the client catch the permission-union and result-object shapes at compile time rather than at render time. |",
"| Frontend language | TypeScript 5.6.3, React 18.3.1 | Static types across the client catch the permission-union and result-object shapes at compile time. |"
),
(
"| Backend framework | NestJS 10 on Express, core/common/platform-express 10.3 | A dependency-injection container with a layered module system, which matches the rules-heavy domain and makes the shared authorisation service injectable into every module. |",
"| Backend framework | NestJS 10 on Express, core/common/platform-express 10.3 | A dependency-injection container with a layered module system matches the rules-heavy domain and makes the shared authorisation service injectable into every module. |"
),
(
"| Database | PostgreSQL on Neon Cloud (serverless) | A fully relational store is required because the domain is defined by foreign keys, compound uniqueness and multi-table joins in every result computation. |",
"| Database | PostgreSQL on Neon Cloud (serverless) | A relational store is required because the domain is defined by foreign keys, compound uniqueness and multi-table joins in every result computation. |"
),
(
"| Object-relational mapper | Prisma 5.8 | Generates a type-safe client from the schema, so joins, aggregates and the compound uniqueness constraints are checked by the compiler. |",
"| Object-relational mapper | Prisma 5.8 | Generates a type-safe client from the schema, so joins, aggregates and the compound uniqueness constraints are checked by the compiler. |"
),
(
"| Cache and queue | Redis via ioredis 5.3 with BullMQ 5.7 (Nest integration 10.1) | One Redis instance serves both the read cache and four background queues; BullMQ provides job persistence, retries and status inspection for long-running work. |",
"| Cache and queue | Redis via ioredis 5.3 with BullMQ 5.7 (Nest integration 10.1) | One Redis instance serves the read cache and four background queues; BullMQ adds job persistence, retries and status inspection. |"
),
(
"| Authentication | Passport-JWT 4.0 with Nest Passport 10.0 and the Nest JWT module 10.2; bcrypt 5.1 for hashing | A stateless bearer-token scheme is the natural fit for a JSON interface consumed by a browser client, and a separate signing secret for refresh tokens limits the blast radius of a leaked access token. |",
"| Authentication | Passport-JWT 4.0 with Nest Passport 10.0 and the Nest JWT module 10.2; bcrypt 5.1 for hashing | A stateless bearer-token scheme fits a JSON interface consumed by a browser client, and a separate signing secret for refresh tokens limits the blast radius of a leaked access token. |"
),
(
"| Validation | class-validator 0.14 with class-transformer 0.5 on the server; Zod 3.23.8 with React Hook Form 7.53.2 on the client | Whitelisting and forbidding of unknown properties converts mass-assignment into a rejected request rather than a silently ignored field. |",
"| Validation | class-validator 0.14 with class-transformer 0.5 on the server; Zod 3.23.8 with React Hook Form 7.53.2 on the client | Whitelisting and forbidding of unknown properties turns mass-assignment into a rejected request rather than a silently ignored field. |"
),
(
"| Charting | Recharts 2.13.3 | A declarative React charting layer whose components resize with the container, which supports the mandatory three-breakpoint responsiveness without a separate responsive wrapper. |",
"| Charting | Recharts 2.13.3 | A declarative React charting layer whose components resize with the container, supporting the three-breakpoint rule without a separate wrapper. |"
),
(
"| User-interface component system | Radix UI primitives with a shadcn/ui-style component layer, icons from lucide-react 0.460.0 | Headless primitives supply accessible behaviour (focus trapping, dismissal, roving focus) that a hand-built component set would not, while the composed layer keeps the visual language in one place. |",
"| User-interface component system | Radix UI primitives with a shadcn/ui-style component layer, icons from lucide-react 0.460.0 | Headless primitives supply accessible behaviour a hand-built set would not, while the composed layer keeps the visual language in one place. |"
),
(
"| Styling | Tailwind CSS 3.4.14 with tailwindcss-animate, class-variance-authority, clsx and tailwind-merge | Utility classes keyed to the design tokens keep the palette centralised, and the mobile-first prefix model maps directly onto the three mandated breakpoints. |",
"| Styling | Tailwind CSS 3.4.14 with tailwindcss-animate, class-variance-authority, clsx and tailwind-merge | Utility classes keyed to the design tokens keep the palette centralised, and the mobile-first prefix model maps onto the three mandated breakpoints. |"
),
(
"| Spreadsheet generation | ExcelJS 4.4.0 | Writes multi-sheet workbooks with styling and typed cells, which is the required output format for the seven report types and for the complete seven-sheet bundle. |",
"| Spreadsheet generation | ExcelJS 4.4.0 | Writes multi-sheet workbooks with styling and typed cells, the required output format for the seven report types and the complete bundle. |"
),
(
"| Document parsing | pdf-parse 1.1.1 and pdfjs-dist 3.11.174 | Two complementary readers cover text-layer extraction and low-level page access without introducing a second language runtime into the pipeline. |",
"| Document parsing | pdf-parse 1.1.1 and pdfjs-dist 3.11.174 | Two complementary readers cover text-layer extraction and low-level page access without a second language runtime. |"
),
(
"| Optical character recognition | Hugging Face Inference API 2.6.4 with a table transformer, a handwriting recogniser and a general-purpose model | Three models with different input limits are selected by content hint, so a scanned statement and a handwritten register are not forced through one recogniser. |",
"| Optical character recognition | Hugging Face Inference API 2.6.4 with a table transformer, a handwriting recogniser and a general-purpose model | Three models with different input limits are selected by content hint, so a scanned statement and a handwritten register are not forced through one recogniser. |"
),
(
"| Curriculum-reading service | GROQ chat-completions endpoint, a Qwen 27B instruct reader with Llama Prompt Guard 2 as a separate safety model | A reader model with a strict output schema handles the unbounded variety of curriculum documents, while an independent guard model screens the document before the reader sees it. |",
"| Curriculum-reading service | GROQ chat-completions endpoint, a Qwen 27B instruct reader with Llama Prompt Guard 2 as a separate safety model | A reader model with a strict output schema handles the variety of curriculum documents, while an independent guard model screens the document before the reader sees it. |"
),
(
"| Mail delivery | nodemailer 10.2 over generic SMTP | A provider-neutral SMTP client keeps the deployment free of a mail-specific platform dependency and allows the transport to be swapped without touching calling code. |",
"| Mail delivery | nodemailer 10.2 over generic SMTP | A provider-neutral SMTP client avoids a mail-specific platform dependency and lets the transport be swapped without touching calling code. |"
),
(
"| Object storage | AWS S3 client 3.1161 against any S3-compatible endpoint, with a local-disk fallback | One client serves Neon Storage, Amazon S3, Cloudflare R2 and MinIO, and the fallback keeps a fresh checkout runnable without a storage account. |",
"| Object storage | AWS S3 client 3.1161 against any S3-compatible endpoint, with a local-disk fallback | One client serves Neon Storage, Amazon S3, Cloudflare R2 and MinIO, and the fallback keeps a fresh checkout runnable. |"
),
(
"| Testing | Jest 29.7 throughout, with ts-jest on the server and worker, the Next.js Jest transform on the client, Testing Library and supertest | A single test runner across all three applications keeps the assertions and the mocking idiom uniform, and the worker and server share the same transformer. |",
"| Testing | Jest 29.7 throughout, with ts-jest on the server and worker, the Next.js Jest transform on the client, Testing Library and supertest | One runner across all three applications keeps the assertions and the mocking idiom uniform. |"
),
# --- 5.2.6 tightening ---
(
"The parser for the printed result statement handles the awkward parts of the format deliberately. The statement is a wide table with one row per student and a merged two-row header, with subject blocks separated by a pipe delimiter. Because the table is laid out in columns rather than delimited, cell boundaries are recovered from runs of two or more spaces. A subject code is recognised by the shape of the code itself, so a heading such as roll number, percentage or grade-point average is never mistaken for a subject heading — which would shift every later column out of alignment and corrupt the whole file. The practical block of a subject is kept separate from its theory block, so a practical recorded under the theory's component names cannot silently overwrite the theory's mark. The college's own summary columns are ignored because the system re-derives them, and default component maxima are used because the statement prints marks and never prints maxima.",
"The parser for the printed result statement handles the awkward parts of the format deliberately. The statement is a wide table with one row per student and a merged two-row header, with subject blocks separated by a pipe delimiter. Because the table is laid out in columns rather than delimited, cell boundaries are recovered from runs of two or more spaces. A subject code is recognised by the shape of the code itself, so a heading such as roll number, percentage or grade-point average is never mistaken for a subject heading — which would shift every later column out of alignment and corrupt the file. The practical block of a subject is kept separate from its theory block, so a practical recorded under the theory's component names cannot silently overwrite the theory's mark. The college's own summary columns are ignored because the system re-derives them, and default component maxima are used because the statement prints marks and never maxima."
),
(
"Alongside the statement parser, a tidy-sheet extractor handles the long layout in which one row carries one mark, using generous header aliases and a cap of 5,000 rows. A text-layer PDF reader attempts a line-based table parse, with rows separated by newlines and columns by runs of two or more spaces, tabs or pipes; the implementation itself describes this route as best-effort. For a scanned document, optical character recognition selects among three models by content hint — a table transformer for structure, a handwriting recogniser and a general-purpose recogniser — with table detection as a second optional call whose failure is logged without failing the extraction. Recognised text is fed through the same tidy-sheet parser, so the review screen has the same shape whatever the source.",
"Alongside the statement parser, a tidy-sheet extractor handles the long layout in which one row carries one mark, using generous header aliases and a cap of 5,000 rows. A text-layer PDF reader attempts a line-based table parse, with rows separated by newlines and columns by runs of two or more spaces, tabs or pipes; the implementation itself describes this route as best-effort. For a scanned document, optical character recognition selects among three models by content hint — a table transformer for structure, a handwriting recogniser and a general-purpose recogniser — with table detection as a second optional call whose failure is logged without failing the extraction. Recognised text is fed through the same tidy-sheet parser, so the review screen has one shape whatever the source."
),
# --- 5.3.4 tightening ---
(
"Branch isolation was verified by attempting, as a branch-scoped member, to request a branch outside the assigned scope, and confirming that the request was refused rather than redirected or silently widened. Allocation ownership was verified by attempting, as a teacher, to write marks for an offering not allocated to them, and confirming that the write was rejected in full.\n\nAccuracy of marks computation was verified against the running system. A claim was recorded as verified only when it was observed — a value read from a screen, a file downloaded and opened, a response inspected — and never inferred from reading the source, because the defects the system was built to remove were precisely defects that the source appeared to express correctly.",
"Branch isolation was verified by attempting, as a branch-scoped member, to request a branch outside the assigned scope, and confirming that the request was refused rather than redirected or silently widened. Allocation ownership was verified by attempting, as a teacher, to write marks for an offering not allocated to them, and confirming that the write was rejected in full.\n\nAccuracy of marks computation was verified against the running system. A claim was recorded as verified only when it was observed — a value read from a screen, a file downloaded and opened, a response inspected — and never inferred from reading the source, because the defects the system was built to remove were precisely defects the source appeared to express correctly."
),
(
"First, there is no automated browser-level end-to-end suite. The manual acceptance exercise across seven role contexts is thorough evidence of behaviour but it is not repeatable without an operator, it does not run on every change, and it cannot be relied upon as a regression gate.\n\nSecond, no coverage threshold is configured anywhere in the project, and nothing enforces one. The rule mandating coverage on critical paths is not implemented by tooling, and coverage output directories exist without a limit being applied to them.\n\nThird, frontend coverage is thin. No page, hook or form in the client has an automated test. The frontend suites cover the pure helpers only, so a regression in a rendered screen would not be caught by the suite.\n\nFourth, there is no automated integration suite against a live database and no continuous integration that runs any of the suites. The permission model, the calculators and the parser are covered by unit suites; the interaction of the service layer with real persistence is covered only by the manual exercise.",
"First, there is no automated browser-level end-to-end suite. The manual acceptance exercise across seven role contexts is thorough evidence of behaviour but it is not repeatable without an operator, it does not run on every change, and it cannot be relied upon as a regression gate.\n\nSecond, no coverage threshold is configured anywhere in the project, and nothing enforces one; coverage output directories exist without a limit being applied to them. Third, frontend coverage is thin — no page, hook or form has an automated test, so the suites cover the pure helpers only and a regression in a rendered screen would not be caught.\n\nFourth, there is no automated integration suite against a live database and no continuous integration that runs any of the suites. The permission model, the calculators and the parser are covered by unit suites; the interaction of the service layer with real persistence is covered only by the manual exercise."
),
]

rewrite('ch5_implementation_testing.md', CH5)
