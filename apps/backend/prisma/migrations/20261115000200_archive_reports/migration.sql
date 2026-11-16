-- Reports are archived, not deleted.
--
-- A report is a statement about a class's results. A result that existed and
-- then vanished cannot be accounted for, so the row is kept: the file is
-- removed, the report is marked as archived, and the reason and the person
-- who archived it are kept with it.
--
-- The existing rows are live reports, so they start archived = false.

ALTER TABLE "reports" ADD COLUMN "is_archived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "reports" ADD COLUMN "archived_at" TIMESTAMP(3);
ALTER TABLE "reports" ADD COLUMN "archived_by" TEXT;
ALTER TABLE "reports" ADD COLUMN "archive_reason" TEXT;

-- The report list is filtered by whether a report is live, so that column
-- carries the read path.
CREATE INDEX "reports_is_archived_idx" ON "reports"("is_archived");
