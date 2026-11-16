'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';

/**
 * The report being archived.
 */
export interface ArchiveReportTarget {
  id: string;
  /** The report's name, as shown in the list. */
  label: string;
}

/**
 * The confirmation for archiving a report.
 *
 * A report is a statement about a class's results. Archiving one removes it
 * from the list, so the confirmation says plainly what happens — the record
 * is kept, the file is released — and asks for a reason, because a report
 * that disappeared without an explanation cannot be accounted for.
 */
interface ArchiveReportDialogProps {
  /** The report, or `null` when the dialog is closed. */
  target: ArchiveReportTarget | null;
  /** Called when the administrator confirms, with the reason they gave. */
  onConfirm: (reportId: string, reason: string) => void;
  /** Called when the administrator backs out. */
  onClose: () => void;
  /** Whether the archive is in flight. */
  isSubmitting?: boolean;
  /** The error from the archive, if it failed. */
  error?: string | null;
}

export function ArchiveReportDialog({
  target,
  onConfirm,
  onClose,
  isSubmitting = false,
  error = null,
}: ArchiveReportDialogProps) {
  const [reason, setReason] = useState('');

  /**
   * The reason is cleared when the dialog opens for a different report, so
   * a reason typed for one report is never submitted for another.
   */
  useEffect(() => {
    setReason('');
  }, [target?.id]);

  const open = target !== null;
  const reasonTooShort = reason.trim().length > 0 && reason.trim().length < 10;
  const canConfirm = !!target && reason.trim().length >= 10 && !isSubmitting;

  return (
    <Sheet open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-base overflow-y-auto sm:max-w-lg"
      >
        <SheetHeader>
          <SheetTitle>Archive this report</SheetTitle>
          <SheetDescription>
            The report will be taken out of the list and its file released. The record of the
            report — when it was made, by whom, and why it was archived — is kept.
          </SheetDescription>
        </SheetHeader>

        <p className="text-body-sm text-ink">
          You are archiving <strong>{target?.label}</strong>.
        </p>

        <div className="flex flex-col gap-xs">
          <label htmlFor="archive-report-reason" className="text-body-sm font-semibold text-ink">
            Why is this report being archived?
          </label>
          <textarea
            id="archive-report-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            aria-describedby="archive-report-reason-help"
            aria-invalid={reasonTooShort ? true : undefined}
            placeholder="For example: the report was generated for the wrong semester."
            className="cb-input w-full"
          />
          <span
            id="archive-report-reason-help"
            className={
              reasonTooShort ? 'text-caption text-semantic-down' : 'text-caption text-muted'
            }
          >
            {reasonTooShort
              ? 'Please write a little more, so this can be explained later.'
              : 'This is kept in the audit trail against your name.'}
          </span>
        </div>

        {error ? <ErrorBanner message={error} /> : null}

        <SheetFooter className="flex-col-reverse gap-xs sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => target && onConfirm(target.id, reason.trim())}
            disabled={!canConfirm}
          >
            {isSubmitting ? (
              <span className="inline-flex items-center gap-sm">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Archiving
              </span>
            ) : (
              <>
                <AlertTriangle aria-hidden />
                Archive report
              </>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
