'use client';

import { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileCheck2,
  Loader2,
  Send,
  Undo2,
} from 'lucide-react';

import { DataTable, type DataTableColumn } from '@/components/forms/DataTable';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { ClassContextBar } from '@/components/context/ClassContextBar';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useCurrentUser } from '@/hooks/useAuth';
import { useClassContext } from '@/lib/context/class-context';
import {
  useExaminations,
  usePublishExamination,
  useUnpublishExamination,
} from '@/hooks/useExaminations';
import { formatters } from '@/lib/utils/formatters';
import type { Examination, ExaminationStatus } from '@/lib/services/examinations.service';

/**
 * The status of a class's result, in the college's words.
 *
 * `PENDING` and `PROCESSING` are the same thing to a college clerk — the
 * marks are still being worked on — so they share a label and differ only
 * in the badge's tone.
 */
const STATUS_LABEL: Record<ExaminationStatus, string> = {
  PENDING: 'Marks still coming in',
  PROCESSING: 'Being worked on',
  PUBLISHED: 'Published',
  FAILED: 'Could not be processed',
};

const STATUS_TONE: Record<ExaminationStatus, string> = {
  PENDING: 'bg-surface-strong text-muted',
  PROCESSING: 'bg-surface-strong text-muted',
  PUBLISHED: 'bg-surface-strong text-semantic-up',
  FAILED: 'bg-surface-strong text-semantic-down',
};

/**
 * The publication screen — the examination cell's last step.
 *
 * Everything before this produces a working sheet of marks. This is where
 * a class's result becomes the answer the college gives.
 */
export default function PublicationsPage() {
  const { context: classContext } = useClassContext();
  const { data: user } = useCurrentUser();

  const canPublish = (user?.permissions ?? []).includes('examinations:write');

  const branchId = classContext.branchId;
  const semester = classContext.semester;
  const academicYearId = classContext.academicYearId;

  const scopeReady = !!branchId && semester > 0 && !!academicYearId;

  const examinationsQuery = useExaminations(
    scopeReady
      ? {
          branchId,
          semester,
          academicYearId,
        }
      : undefined
  );

  const examinations = examinationsQuery.data ?? [];

  const publish = usePublishExamination();
  const unpublish = useUnpublishExamination();

  /**
   * The examination whose publication is being confirmed.
   *
   * Publishing is a consequential act — it makes a result the college's
   * answer — so it is confirmed knowingly, and the confirmation says who
   * will be affected.
   */
  const [publishing, setPublishing] = useState<Examination | null>(null);
  const [unpublishing, setUnpublishing] = useState<Examination | null>(null);

  const columns: DataTableColumn<Examination>[] = useMemo(
    () => [
      {
        key: 'name',
        header: 'Examination',
        render: (row) => (
          <div className="flex flex-col">
            <span className="font-semibold text-ink">{row.name}</span>
            <span className="text-caption text-muted">
              {row.branchName} · Semester {row.semester} · {row.schemeName} ·{' '}
              {row.academicYear}
            </span>
          </div>
        ),
      },
      {
        key: 'examDate',
        header: 'Exam date',
        render: (row) => (
          <span className="text-body-sm text-body">{formatters.date(row.examDate, 'long')}</span>
        ),
      },
      {
        key: 'readiness',
        header: 'Result',
        render: (row) =>
          row.isReady ? (
            <span className="flex items-center gap-xs text-body-sm text-semantic-up">
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              All {row.studentCount} students have a result
            </span>
          ) : (
            <span className="flex items-center gap-xs text-body-sm text-muted">
              <AlertCircle className="h-4 w-4" aria-hidden />
              {row.completeCount} of {row.studentCount} students have a result
            </span>
          ),
      },
      {
        key: 'status',
        header: 'Status',
        render: (row) => (
          <div className="flex flex-col items-start gap-1">
            <span className={`cb-badge ${STATUS_TONE[row.status]}`}>
              {STATUS_LABEL[row.status]}
            </span>
            {row.resultPublishedAt ? (
              <span className="text-caption text-muted">
                Published {formatters.date(row.resultPublishedAt, 'time')}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        key: 'actions',
        header: 'Actions',
        className: 'text-right',
        render: (row) => {
          if (!canPublish) return <span className="text-caption text-muted">—</span>;

          if (row.status === 'PUBLISHED') {
            return (
              <Button
                type="button"
                variant="outline"
                onClick={() => setUnpublishing(row)}
                disabled={unpublish.isPending}
              >
                <Undo2 aria-hidden />
                Return to working
              </Button>
            );
          }

          return (
            <Button
              type="button"
              onClick={() => setPublishing(row)}
              disabled={!row.isReady || publish.isPending}
              title={
                row.isReady
                  ? 'Publish this result'
                  : 'Every student needs a complete result before the result can be published'
              }
            >
              <Send aria-hidden />
              Publish result
            </Button>
          );
        },
      },
    ],
    [canPublish, publish.isPending, unpublish.isPending]
  );

  return (
    <section className="flex flex-col gap-6 md:gap-8">
      <PageHeader
        title="Publish results"
        description="Publish a class’s result once every student has one. Until then the result is a working sheet."
      />

      <ClassContextBar />

      {publish.isError ? (
        <ErrorBanner
          message="The result could not be published. Your work is safe — try again."
          retry={() => publish.reset()}
        />
      ) : null}

      {unpublish.isError ? (
        <ErrorBanner
          message="The result could not be returned to being worked on."
          retry={() => unpublish.reset()}
        />
      ) : null}

      <section aria-labelledby="examinations-title" className="space-y-base">
        <h2 id="examinations-title" className="font-display text-title-md text-ink">
          Examinations
        </h2>

        <DataTable
          columns={columns}
          rows={examinations}
          keyExtractor={(row) => row.id}
          loading={examinationsQuery.isLoading}
          emptyState={
            scopeReady ? (
              <EmptyState
                variant="plain"
                title="No examination for this class"
                description="An examination is opened for a class before its result can be published. Ask the exam cell to open one."
                icon={<FileCheck2 className="h-8 w-8" aria-hidden />}
              />
            ) : (
              <EmptyState
                variant="plain"
                title="Choose a class to see its examinations"
                description="Every examination belongs to a branch, a semester and an academic year. Pick the class above."
                icon={<FileCheck2 className="h-8 w-8" aria-hidden />}
              />
            )
          }
        />
      </section>

      {/*
       * The publication confirmation. It says who will be affected — every
       * student in the class — and that the result becomes the college's
       * answer.
       */}
      <Sheet
        open={publishing !== null}
        onOpenChange={(next) => (next ? undefined : setPublishing(null))}
      >
        <SheetContent side="dialog">
          <SheetHeader>
            <SheetTitle>Publish this result?</SheetTitle>
            <SheetDescription>
              Once published, this result is the college’s answer for the class. Every student’s
              result is included, and the publication is recorded with your name.
            </SheetDescription>
          </SheetHeader>

          {publishing ? (
            <div className="flex flex-col gap-sm py-base">
              <p className="text-body-sm text-ink">
                <strong>{publishing.name}</strong>
              </p>
              <p className="text-body-sm text-muted">
                {publishing.branchName} · Semester {publishing.semester} ·{' '}
                {publishing.academicYear}
              </p>
              <p className="text-body-sm text-muted">
                {publishing.completeCount} student
                {publishing.completeCount === 1 ? '' : 's'} will receive this result.
              </p>
            </div>
          ) : null}

          <SheetFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPublishing(null)}
              disabled={publish.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!publishing) return;
                publish.mutate(publishing.id, { onSuccess: () => setPublishing(null) });
              }}
              disabled={publish.isPending}
            >
              {publish.isPending ? (
                <span className="inline-flex items-center gap-sm">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Publishing
                </span>
              ) : (
                <>
                  <Send aria-hidden />
                  Publish the result
                </>
              )}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/*
       * The confirmation for returning a published result to being worked
       * on — for the case where a mark was found to be wrong after the
       * result went out.
       */}
      <Sheet
        open={unpublishing !== null}
        onOpenChange={(next) => (next ? undefined : setUnpublishing(null))}
      >
        <SheetContent side="dialog">
          <SheetHeader>
            <SheetTitle>Return this result to being worked on?</SheetTitle>
            <SheetDescription>
              The result stops being the college’s answer while the marks are being fixed. The
              marks themselves are not changed by this — a mark that needs changing is corrected
              on the Marks Entry screen.
            </SheetDescription>
          </SheetHeader>

          {unpublishing ? (
            <div className="flex flex-col gap-sm py-base">
              <p className="text-body-sm text-ink">
                <strong>{unpublishing.name}</strong>
              </p>
              <p className="text-body-sm text-muted">
                {unpublishing.branchName} · Semester {unpublishing.semester} ·{' '}
                {unpublishing.academicYear}
              </p>
            </div>
          ) : null}

          <SheetFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setUnpublishing(null)}
              disabled={unpublish.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (!unpublishing) return;
                unpublish.mutate(unpublishing.id, { onSuccess: () => setUnpublishing(null) });
              }}
              disabled={unpublish.isPending}
            >
              {unpublish.isPending ? (
                <span className="inline-flex items-center gap-sm">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Returning
                </span>
              ) : (
                <>
                  <Undo2 aria-hidden />
                  Return to being worked on
                </>
              )}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </section>
  );
}
