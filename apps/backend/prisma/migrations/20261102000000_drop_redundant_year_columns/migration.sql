-- ============================================================================
-- Drop the two year columns that duplicate the semester.
--
-- `subject_offerings.year` and `students.current_year` both recorded the
-- curriculum year (1, 2, 3 or 4) of a class. But the year is not an
-- independent fact about a class — it is *derived* from the semester:
-- semesters 1-2 are year 1, semesters 3-4 are year 2, and so on. Storing
-- it separately meant two columns that could contradict each other, and a
-- row could say "semester 5, year 1" without anything rejecting it.
--
-- The derivation now lives in one helper on each side
-- (`yearForSemester`), so the year can never disagree with the semester.
--
-- The backfill below runs BEFORE the columns are dropped, and it repairs
-- any row whose stored year did not match its semester. Those rows are
-- the ones this migration exists to fix: they were writable only because
-- nothing derived the year from the semester.
--
-- The indexes that covered the dropped columns are dropped with them.
-- `students.roll_no` and `students.academic_year_id` remain unique
-- together, which is the index that actually matters for lookups.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Repair `subject_offerings.year` so it agrees with the semester.
--
-- A semester of 1 or 2 is year 1, 3 or 4 is year 2, and so on.
-- ---------------------------------------------------------------------------
UPDATE "subject_offerings"
SET "year" = CEIL("semester"::numeric / 2)
WHERE "year" IS DISTINCT FROM CEIL("semester"::numeric / 2);

-- ---------------------------------------------------------------------------
-- Repair `students.current_year` the same way.
-- ---------------------------------------------------------------------------
UPDATE "students"
SET "current_year" = CEIL("semester"::numeric / 2)
WHERE "current_year" IS DISTINCT FROM CEIL("semester"::numeric / 2);

-- ---------------------------------------------------------------------------
-- Drop the indexes that led with the dropped columns.
--
-- `subject_offerings_branch_id_scheme_id_semester_idx` survives — it does not
-- use the dropped column.
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS "students_branch_id_current_year_semester_idx";

-- ---------------------------------------------------------------------------
-- Drop the columns themselves.
-- ---------------------------------------------------------------------------
ALTER TABLE "subject_offerings" DROP COLUMN "year";
ALTER TABLE "students" DROP COLUMN "current_year";
