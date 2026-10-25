-- ============================================================================
-- Split `subjects` into a subject identity (`subjects`) and a subject's
-- assignment to a class context (`subject_offerings`).
--
-- The generated diff for this change was destructive: it dropped
-- `subjects.branch_id/scheme_id/semester/year` and `marks.subject_id` /
-- `teacher_subjects.subject_id` in the same statement that added the NOT NULL
-- replacement columns, which loses every existing row's data. This migration
-- is rewritten to be data-preserving:
--
--   1. Create `subject_offerings` and backfill it from the old `subjects`
--      columns (one offering per existing subject row).
--   2. Add the new columns as NULLABLE, backfill them from the offering rows,
--      then promote them to NOT NULL.
--   3. Only then drop the old columns and indexes.
-- ============================================================================

-- CreateTable
CREATE TABLE "subject_offerings" (
    "id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "semester" INTEGER NOT NULL,
    "scheme_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "academic_year_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subject_offerings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "examinations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "semester" INTEGER NOT NULL,
    "scheme_id" TEXT NOT NULL,
    "academic_year_id" TEXT NOT NULL,
    "exam_date" TIMESTAMP(3) NOT NULL,
    "result_published_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "examinations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_teacher_assignments" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "semester" INTEGER NOT NULL,
    "scheme_id" TEXT NOT NULL,
    "academic_year_id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "assigned_by" TEXT,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_teacher_assignments_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- Backfill: one SubjectOffering per legacy Subject row.
--
-- The legacy `subjects` row carried branch/semester/scheme/year inline, so it
-- maps 1:1 onto an offering. `academic_year_id` is left NULL (the column is
-- nullable) because the legacy row did not record one.
-- ============================================================================
INSERT INTO "subject_offerings" (
    "id",
    "subject_id",
    "branch_id",
    "semester",
    "scheme_id",
    "year",
    "academic_year_id",
    "is_active",
    "created_at",
    "updated_at"
)
SELECT
    gen_random_uuid()::text,
    s."id",
    s."branch_id",
    s."semester",
    s."scheme_id",
    s."year",
    NULL,
    s."is_active",
    s."created_at",
    CURRENT_TIMESTAMP
FROM "subjects" s
WHERE NOT EXISTS (
    SELECT 1
    FROM "subject_offerings" o
    WHERE o."subject_id" = s."id"
      AND o."branch_id" = s."branch_id"
      AND o."semester" = s."semester"
      AND o."scheme_id" = s."scheme_id"
);

-- ============================================================================
-- Backfill `marks.subject_offering_id` from the legacy `marks.subject_id`.
--
-- A mark row referenced a subject that may have been offered in several class
-- contexts. The offering is resolved by matching the mark's student class
-- context (branch/semester/scheme) first, then falling back to the earliest
-- offering of that subject. A mark whose subject has no offering at all cannot
-- be attributed and is removed below.
-- ============================================================================
ALTER TABLE "marks" ADD COLUMN "subject_offering_id" TEXT;

-- Pass 1: match the offering against the mark's student class context.
-- PostgreSQL does not allow the UPDATE target alias to be referenced inside a
-- JOIN ... ON clause of the FROM list, so the students table is joined in the
-- WHERE clause instead.
UPDATE "marks" m
SET "subject_offering_id" = o."id"
FROM "subject_offerings" o, "students" st
WHERE st."id" = m."student_id"
  AND m."subject_offering_id" IS NULL
  AND o."subject_id" = m."subject_id"
  AND o."branch_id" = st."branch_id"
  AND o."semester" = st."semester"
  AND o."scheme_id" = st."scheme_id";

-- Pass 2: fall back to the earliest offering of the subject.
UPDATE "marks" m
SET "subject_offering_id" = (
    SELECT o."id"
    FROM "subject_offerings" o
    WHERE o."subject_id" = m."subject_id"
    ORDER BY o."created_at" ASC, o."id" ASC
    LIMIT 1
)
WHERE m."subject_offering_id" IS NULL
  AND EXISTS (
      SELECT 1 FROM "subject_offerings" o WHERE o."subject_id" = m."subject_id"
  );

-- A mark row whose subject had no offering cannot be attributed to a class
-- context, so it is removed rather than left dangling.
DELETE FROM "marks" WHERE "subject_offering_id" IS NULL;

-- Two legacy marks that pointed at different subjects could collapse onto the
-- same offering under the new key. Keep the most recent row per
-- (student, offering, examType, academicYear) group.
DELETE FROM "marks" m
WHERE EXISTS (
    SELECT 1
    FROM "marks" dup
    WHERE dup."student_id" = m."student_id"
      AND dup."subject_offering_id" = m."subject_offering_id"
      AND dup."exam_type" = m."exam_type"
      AND dup."academic_year_id" = m."academic_year_id"
      AND dup."id" <> m."id"
      AND (dup."updated_at", dup."id") > (m."updated_at", m."id")
);

-- ============================================================================
-- Backfill `teacher_subjects.subject_offering_id`.
-- ============================================================================
ALTER TABLE "teacher_subjects" ADD COLUMN "subject_offering_id" TEXT;

UPDATE "teacher_subjects" ts
SET "subject_offering_id" = (
    SELECT o."id"
    FROM "subject_offerings" o
    WHERE o."subject_id" = ts."subject_id"
    ORDER BY o."created_at" ASC, o."id" ASC
    LIMIT 1
)
WHERE ts."subject_offering_id" IS NULL
  AND EXISTS (
      SELECT 1 FROM "subject_offerings" o WHERE o."subject_id" = ts."subject_id"
  );

DELETE FROM "teacher_subjects" WHERE "subject_offering_id" IS NULL;

-- ============================================================================
-- Promote the backfilled columns to NOT NULL.
-- ============================================================================
ALTER TABLE "marks" ALTER COLUMN "subject_offering_id" SET NOT NULL;

ALTER TABLE "teacher_subjects" ALTER COLUMN "subject_offering_id" SET NOT NULL;

-- ============================================================================
-- `subjects` gains `updated_at`. Prisma's `updatedAt` has no column default
-- (the client manages it), so the column must end up NOT NULL *without* a
-- database default — otherwise the database drifts from the datamodel and
-- `prisma migrate dev` will keep reporting a diff. Add it nullable, backfill
-- the existing rows from `created_at`, then promote it.
-- ============================================================================
ALTER TABLE "subjects" ADD COLUMN "updated_at" TIMESTAMP(3);

UPDATE "subjects" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;

ALTER TABLE "subjects" ALTER COLUMN "updated_at" SET NOT NULL;

-- ============================================================================
-- `students` gains a nullable `email` and `user_id` for exam-cell login
-- provisioning. Both stay NULL for existing rows.
-- ============================================================================
ALTER TABLE "students" ADD COLUMN "email" TEXT;
ALTER TABLE "students" ADD COLUMN "user_id" TEXT;

-- ============================================================================
-- `subjects.code` is now globally unique (the legacy key was
-- (code, scheme, branch)). Legacy data could hold the same code under two
-- branch/scheme combinations, so duplicates are suffixed deterministically
-- before the unique index is created. The first occurrence — the oldest row —
-- keeps the original code; later ones get a numeric suffix.
-- ============================================================================
UPDATE "subjects" s
SET "code" = s."code" || '-' || d."dup_rank"
FROM (
    SELECT
        "id",
        ROW_NUMBER() OVER (
            PARTITION BY "code"
            ORDER BY "created_at" ASC, "id" ASC
        ) AS "dup_rank"
    FROM "subjects"
) d
WHERE s."id" = d."id"
  AND d."dup_rank" > 1;

-- ============================================================================
-- DropForeignKey
--
-- Constraints and indexes are dropped *before* the columns they depend on:
-- dropping a column takes its indexes and constraints with it, so a later
-- `DROP CONSTRAINT` / `DROP INDEX` would fail with "does not exist".
-- ============================================================================
ALTER TABLE "marks" DROP CONSTRAINT "marks_subject_id_fkey";

ALTER TABLE "subjects" DROP CONSTRAINT "subjects_branch_id_fkey";

ALTER TABLE "subjects" DROP CONSTRAINT "subjects_scheme_id_fkey";

ALTER TABLE "teacher_subjects" DROP CONSTRAINT "teacher_subjects_subject_id_fkey";

-- ============================================================================
-- DropIndex
DROP INDEX "marks_student_id_subject_id_exam_type_academic_year_id_key";

DROP INDEX "marks_subject_id_idx";

DROP INDEX "subjects_branch_id_scheme_id_semester_idx";

DROP INDEX "subjects_code_scheme_id_branch_id_key";

DROP INDEX "teacher_subjects_teacher_id_subject_id_academic_year_id_key";

-- ============================================================================
-- Drop the legacy columns now that everything has been migrated.
-- ============================================================================
ALTER TABLE "marks" DROP COLUMN "subject_id";

ALTER TABLE "teacher_subjects" DROP COLUMN "subject_id";

ALTER TABLE "subjects" DROP COLUMN "branch_id";
ALTER TABLE "subjects" DROP COLUMN "scheme_id";
ALTER TABLE "subjects" DROP COLUMN "semester";
ALTER TABLE "subjects" DROP COLUMN "year";

-- ============================================================================
-- CreateIndex
CREATE INDEX "subject_offerings_branch_id_scheme_id_semester_idx" ON "subject_offerings"("branch_id", "scheme_id", "semester");

CREATE INDEX "subject_offerings_academic_year_id_idx" ON "subject_offerings"("academic_year_id");

CREATE UNIQUE INDEX "subject_offerings_subject_id_branch_id_semester_scheme_id_key" ON "subject_offerings"("subject_id", "branch_id", "semester", "scheme_id");

CREATE INDEX "examinations_academic_year_id_idx" ON "examinations"("academic_year_id");

CREATE UNIQUE INDEX "examinations_branch_id_semester_scheme_id_academic_year_id_key" ON "examinations"("branch_id", "semester", "scheme_id", "academic_year_id");

CREATE INDEX "class_teacher_assignments_teacher_id_idx" ON "class_teacher_assignments"("teacher_id");

CREATE INDEX "class_teacher_assignments_academic_year_id_idx" ON "class_teacher_assignments"("academic_year_id");

CREATE UNIQUE INDEX "class_teacher_assignments_branch_id_semester_scheme_id_acad_key" ON "class_teacher_assignments"("branch_id", "semester", "scheme_id", "academic_year_id");

CREATE INDEX "marks_subject_offering_id_idx" ON "marks"("subject_offering_id");

CREATE UNIQUE INDEX "marks_student_id_subject_offering_id_exam_type_academic_yea_key" ON "marks"("student_id", "subject_offering_id", "exam_type", "academic_year_id");

CREATE UNIQUE INDEX "students_email_key" ON "students"("email");

CREATE UNIQUE INDEX "students_user_id_key" ON "students"("user_id");

CREATE UNIQUE INDEX "subjects_code_key" ON "subjects"("code");

CREATE INDEX "teacher_subjects_subject_offering_id_idx" ON "teacher_subjects"("subject_offering_id");

CREATE UNIQUE INDEX "teacher_subjects_teacher_id_subject_offering_id_academic_ye_key" ON "teacher_subjects"("teacher_id", "subject_offering_id", "academic_year_id");

-- ============================================================================
-- AddForeignKey
ALTER TABLE "subject_offerings" ADD CONSTRAINT "subject_offerings_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "subject_offerings" ADD CONSTRAINT "subject_offerings_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "subject_offerings" ADD CONSTRAINT "subject_offerings_scheme_id_fkey" FOREIGN KEY ("scheme_id") REFERENCES "schemes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "subject_offerings" ADD CONSTRAINT "subject_offerings_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "examinations" ADD CONSTRAINT "examinations_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "examinations" ADD CONSTRAINT "examinations_scheme_id_fkey" FOREIGN KEY ("scheme_id") REFERENCES "schemes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "examinations" ADD CONSTRAINT "examinations_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "class_teacher_assignments" ADD CONSTRAINT "class_teacher_assignments_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "class_teacher_assignments" ADD CONSTRAINT "class_teacher_assignments_scheme_id_fkey" FOREIGN KEY ("scheme_id") REFERENCES "schemes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "class_teacher_assignments" ADD CONSTRAINT "class_teacher_assignments_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "class_teacher_assignments" ADD CONSTRAINT "class_teacher_assignments_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "teacher_subjects" ADD CONSTRAINT "teacher_subjects_subject_offering_id_fkey" FOREIGN KEY ("subject_offering_id") REFERENCES "subject_offerings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "students" ADD CONSTRAINT "students_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "marks" ADD CONSTRAINT "marks_subject_offering_id_fkey" FOREIGN KEY ("subject_offering_id") REFERENCES "subject_offerings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
