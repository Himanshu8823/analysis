-- The examination cell's correction of a mark a teacher holds.
--
-- A correction overwrites work another person is responsible for. Until now
-- the overwritten value was simply lost, which meant "who changed this score
-- and why?" could not be answered from the data alone. This table keeps the
-- value that was replaced, names the teacher whose entry was corrected, and
-- holds the reason the exam cell gave.
--
-- The table is append-only. Nothing updates or deletes a row here.

CREATE TABLE "mark_revisions" (
    "id" TEXT NOT NULL,
    "mark_id" TEXT NOT NULL,
    "previous_marks_obtained" DOUBLE PRECISION NOT NULL,
    "previous_max_marks" DOUBLE PRECISION NOT NULL,
    "previous_is_absent" BOOLEAN NOT NULL,
    "previous_is_withheld" BOOLEAN NOT NULL,
    "previous_remarks" TEXT,
    "corrected_marks_obtained" DOUBLE PRECISION NOT NULL,
    "corrected_max_marks" DOUBLE PRECISION NOT NULL,
    "corrected_is_absent" BOOLEAN NOT NULL,
    "corrected_is_withheld" BOOLEAN NOT NULL,
    "corrected_remarks" TEXT,
    "corrected_by" TEXT NOT NULL,
    "overridden_teacher_id" TEXT,
    "overridden_teacher_name" TEXT,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mark_revisions_pkey" PRIMARY KEY ("id")
);

-- The revision rows are read by mark, by the examiner who made them, and by
-- the teacher whose work was corrected.
CREATE INDEX "mark_revisions_mark_id_idx" ON "mark_revisions"("mark_id");
CREATE INDEX "mark_revisions_corrected_by_idx" ON "mark_revisions"("corrected_by");
CREATE INDEX "mark_revisions_overridden_teacher_id_idx" ON "mark_revisions"("overridden_teacher_id");

-- A revision is deleted with the mark it belongs to. A mark is never deleted
-- while a report or an audit entry may reference it, so this cascade only
-- fires in the one case where the mark itself is gone.
ALTER TABLE "mark_revisions" ADD CONSTRAINT "mark_revisions_mark_id_fkey"
    FOREIGN KEY ("mark_id") REFERENCES "marks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
