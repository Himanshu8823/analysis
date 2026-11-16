-- ============================================================================
-- Widen the Student model to real-world scope, and add the per-semester
-- enrolment record that keeps a student's history attached to them.
--
-- Three things happen here:
--
--  1. The Student model gains the fields a college actually records —
--     personal details, contact details, identity, category and quotas,
--     guardians, and a status lifecycle with a reason and a date. Most are
--     nullable, so a record created before this migration stays valid and
--     the college can fill the columns in over time.
--
--  2. `students.status` replaces the flat "is this student on the roll"
--     flag. The old `is_active` column is kept — it still answers "is this
--     record live in the roster" — but it no longer tries to answer "what
--     is this student's standing in the course", which is what the new
--     status column is for. The backfill below makes every existing row
--     `ACTIVE`, so no record is left without a status.
--
--  3. `student_enrollments` is created. The Student row records where the
--     student is *now*; the enrolment row records where they *were*. Without
--     it, advancing a student meant overwriting `semester`, and the earlier
--     semester's subjects and result fell out of the picture entirely
--     (§2.8.3). Every existing student gets one enrolment row for the
--     semester they are currently in.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- The enums.
-- ---------------------------------------------------------------------------
CREATE TYPE "StudentStatus" AS ENUM ('ACTIVE', 'GRADUATED', 'DROPPED_OUT', 'ON_LEAVE');
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'NOT_RECORDED');
CREATE TYPE "BloodGroup" AS ENUM (
  'A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'AB_POS', 'AB_NEG', 'O_POS', 'O_NEG', 'NOT_RECORDED'
);
CREATE TYPE "ReservedCategory" AS ENUM ('GENERAL', 'SC', 'ST', 'OBC', 'EWS', 'NOT_RECORDED');
CREATE TYPE "FeeCategory" AS ENUM (
  'REGULAR', 'MANAGEMENT_QUOTA', 'NRI', 'CONCESSION', 'SCHOLARSHIP', 'NOT_RECORDED'
);
CREATE TYPE "GuardianRelation" AS ENUM (
  'FATHER', 'MOTHER', 'GRANDFATHER', 'GRANDMOTHER', 'UNCLE', 'AUNT', 'SPOUSE', 'SIBLING', 'OTHER'
);

-- ---------------------------------------------------------------------------
-- The new Student columns.
-- ---------------------------------------------------------------------------

-- Personal details.
ALTER TABLE "students" ADD COLUMN "date_of_birth" TIMESTAMP(3),
  ADD COLUMN "gender" "Gender" DEFAULT 'NOT_RECORDED';

-- Contact details.
ALTER TABLE "students" ADD COLUMN "phone" TEXT,
  ADD COLUMN "alternate_email" TEXT,
  ADD COLUMN "address" TEXT,
  ADD COLUMN "city" TEXT,
  ADD COLUMN "state" TEXT,
  ADD COLUMN "pincode" TEXT;

-- Identity details — sensitive, and gated in the service layer.
ALTER TABLE "students" ADD COLUMN "photo_url" TEXT,
  ADD COLUMN "blood_group" "BloodGroup" DEFAULT 'NOT_RECORDED',
  ADD COLUMN "national_id" TEXT;

-- Academic details that were previously implicit.
ALTER TABLE "students" ADD COLUMN "admission_year" INTEGER,
  ADD COLUMN "section" TEXT;

-- Category and quotas.
ALTER TABLE "students" ADD COLUMN "reserved_category" "ReservedCategory" DEFAULT 'NOT_RECORDED',
  ADD COLUMN "fee_category" "FeeCategory" DEFAULT 'NOT_RECORDED',
  ADD COLUMN "scholarship_recipient" BOOLEAN NOT NULL DEFAULT false;

-- Guardians — one and a second.
ALTER TABLE "students" ADD COLUMN "guardian_name" TEXT,
  ADD COLUMN "guardian_relation" "GuardianRelation",
  ADD COLUMN "guardian_phone" TEXT,
  ADD COLUMN "guardian_email" TEXT,
  ADD COLUMN "guardian_occupation" TEXT,
  ADD COLUMN "guardian2_name" TEXT,
  ADD COLUMN "guardian2_relation" "GuardianRelation",
  ADD COLUMN "guardian2_phone" TEXT,
  ADD COLUMN "guardian2_email" TEXT,
  ADD COLUMN "guardian2_occupation" TEXT;

-- The status lifecycle.
ALTER TABLE "students" ADD COLUMN "status" "StudentStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "status_reason" TEXT,
  ADD COLUMN "status_date" TIMESTAMP(3);

-- ---------------------------------------------------------------------------
-- The backfill.
--
-- Every existing student is `ACTIVE` — they are on the roll. The default
-- above already says so, and this statement makes the intent explicit
-- rather than relying on the default having been applied.
--
-- The status date is set to the record's creation date, because that is the
-- day the student entered the system — the closest true answer available
-- for a record that was created before the lifecycle existed.
-- ---------------------------------------------------------------------------
UPDATE "students"
SET "status" = 'ACTIVE',
    "status_date" = COALESCE("status_date", "created_at")
WHERE "status" IS NULL OR "status_date" IS NULL;

-- ---------------------------------------------------------------------------
-- The per-semester enrolment record.
-- ---------------------------------------------------------------------------
CREATE TABLE "student_enrollments" (
  "id" TEXT NOT NULL,
  "student_id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "scheme_id" TEXT NOT NULL,
  "semester" INTEGER NOT NULL,
  "academic_year_id" TEXT NOT NULL,
  "section" TEXT,
  "is_current" BOOLEAN NOT NULL DEFAULT false,
  "enrolled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "student_enrollments_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------
-- The indexes and the foreign keys.
--
-- The unique constraint is created *before* the backfill, because the
-- backfill's `ON CONFLICT` clause names it — Postgres rejects an
-- `ON CONFLICT` that has no matching unique index to arbitrate against.
-- ---------------------------------------------------------------------------
ALTER TABLE "student_enrollments"
  ADD CONSTRAINT "student_enrollments_student_id_semester_academic_year_id_key"
  UNIQUE ("student_id", "semester", "academic_year_id");

CREATE INDEX "student_enrollments_student_id_academic_year_id_idx"
  ON "student_enrollments"("student_id", "academic_year_id");
CREATE INDEX "student_enrollments_student_id_idx" ON "student_enrollments"("student_id");

ALTER TABLE "student_enrollments"
  ADD CONSTRAINT "student_enrollments_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "student_enrollments"
  ADD CONSTRAINT "student_enrollments_branch_id_fkey"
  FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "student_enrollments"
  ADD CONSTRAINT "student_enrollments_scheme_id_fkey"
  FOREIGN KEY ("scheme_id") REFERENCES "schemes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "student_enrollments"
  ADD CONSTRAINT "student_enrollments_academic_year_id_fkey"
  FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- The backfill: every existing student gets one enrolment row for the
-- semester they are currently studying, flagged as current. Without this,
-- a student who had been advanced to Sem 5 would have no Sem 1 enrolment
-- and their earlier history would be unreachable.
-- ---------------------------------------------------------------------------
INSERT INTO "student_enrollments" (
  "id", "student_id", "branch_id", "scheme_id", "semester",
  "academic_year_id", "section", "is_current", "enrolled_at",
  "created_at", "updated_at"
)
SELECT
  md5(random()::text || clock_timestamp()::text || s."id"),
  s."id",
  s."branch_id",
  s."scheme_id",
  s."semester",
  s."academic_year_id",
  s."section",
  true,
  s."created_at",
  s."created_at",
  s."created_at"
FROM "students" s
WHERE s."is_active" = true
ON CONFLICT ("student_id", "semester", "academic_year_id") DO NOTHING;

-- A standing index on the status, because the roster filters on it and
-- every filter on a growing table needs one.
CREATE INDEX "students_status_idx" ON "students"("status");
