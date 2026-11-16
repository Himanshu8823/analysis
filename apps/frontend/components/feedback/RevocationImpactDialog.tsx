'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, UserCheck } from 'lucide-react';

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
import { useRevocationImpact } from '@/hooks/useMembers';

/**
 * The member whose access is being revoked — or restored.
 */
export interface RevocationTarget {
  id: string;
  name: string;
  isActive: boolean;
}

/**
 * The confirmation for a member's revocation — or their restoration.
 *
 * A revocation is not a small thing: it signs the member out, releases their
 * allocations, withdraws their invitations and removes their roles. A
 * confirmation dialog that says only "Are you sure?" gives the administrator
 * nothing to be sure *about*.
 *
 * So the dialog asks the server what the revocation would actually do, and
 * shows it in sentences: the subjects that would be released, the classes
 * that would lose their class teacher, the roles that would be removed. The
 * administrator confirms knowing the consequences, not guessing at them.
 *
 * The dialog is deliberately not a `window.confirm`. That shows a browser
 * string, cannot show a list of consequences, and cannot be styled to match
 * the rest of the product.
 */
interface RevocationImpactDialogProps {
  /** The member, or `null` when the dialog is closed. */
  target: RevocationTarget | null;
  /** Called when the administrator confirms a revocation, with the reason. */
  onConfirm: (memberId: string, reason: string) => void;
  /**
   * Called when the administrator restores a revoked member, with the reason.
   *
   * A restoration is a different act from a revocation, and it is confirmed
   * by the same dialog — but the consequences are different, so the two are
   * separate callbacks rather than one callback with a flag.
   */
  onRestore?: (memberId: string, reason: string) => void;
  /** Called when the administrator backs out. */
  onClose: () => void;
  /** Whether the confirmation is in flight. */
  isSubmitting?: boolean;
  /** The error from the confirmation, if it failed. */
  error?: string | null;
}

export function RevocationImpactDialog({
  target,
  onConfirm,
  onRestore,
  onClose,
  isSubmitting = false,
  error = null,
}: RevocationImpactDialogProps) {
  const [reason, setReason] = useState('');
  const impactQuery = useRevocationImpact(target?.id ?? null);

  /**
   * The reason is cleared when the dialog opens for a different member, so
   * a reason typed for one member is never submitted for another.
   */
  useEffect(() => {
    setReason('');
  }, [target?.id]);

  const impact = impactQuery.data;
  const open = target !== null;

  /**
   * A member who is already revoked is being restored, not revoked. The
   * two are different acts with different consequences.
   */
  const isRestore = target !== null && !target.isActive;

  /**
   * A reason is required for a consequential, auditable action. The
   * sentences below say who did what and why.
   */
  const reasonTooShort = reason.trim().length > 0 && reason.trim().length < 10;
  const canConfirm =
    !!target && reason.trim().length >= 10 && !isSubmitting && (isRestore ? !!onRestore : true);

  return (
    <Sheet open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-base overflow-y-auto sm:max-w-lg"
      >
        <SheetHeader>
          <SheetTitle>
            {isRestore ? 'Restore this member’s access' : 'Revoke this member’s access'}
          </SheetTitle>
          <SheetDescription>
            {isRestore
              ? 'This makes their account usable again. The subjects and roles they held are not given back automatically — you re-apply those yourself.'
              : 'This signs them out and releases what they were responsible for. Their history is kept.'}
          </SheetDescription>
        </SheetHeader>

        {isRestore ? null : impactQuery.isLoading ? (
          <p className="flex items-center gap-sm text-body-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Working out what this will affect…
          </p>
        ) : impactQuery.isError ? (
          <ErrorBanner
            message="Could not work out what this will affect, so the change was not made."
            retry={() => impactQuery.refetch()}
          />
        ) : impact ? (
          <>
            {/*
             * The consequences, as sentences. These are written by the server
             * for a college administrator — they name branches, subjects and
             * semesters, never ids.
             */}
            <ul className="flex flex-col gap-sm">
              {(impact.consequences ?? []).map((sentence, index) => (
                <li key={index} className="flex items-start gap-xs text-body-sm text-body">
                  <AlertTriangle
                    className="mt-0.5 h-4 w-4 shrink-0 text-semantic-down"
                    aria-hidden
                  />
                  <span>{sentence}</span>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {/*
         * The reason. It is required for both directions, because both are
         * consequential and auditable — and because "someone revoked my
         * access" with no explanation is not an answer the college can give.
         */}
        <div className="flex flex-col gap-xs">
          <label
            htmlFor="revocation-reason"
            className="text-body-sm font-semibold text-ink"
          >
            {isRestore ? 'Why are they being restored?' : 'Why is this being done?'}
          </label>
          <textarea
            id="revocation-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            aria-describedby="revocation-reason-help"
            aria-invalid={reasonTooShort ? true : undefined}
            placeholder={
              isRestore
                ? 'For example: the revocation was made in error, and the teacher has returned.'
                : 'For example: the teacher has left the college, so their access is being withdrawn.'
            }
            className="cb-input w-full"
          />
          <span
            id="revocation-reason-help"
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
            variant={isRestore ? 'default' : 'destructive'}
            onClick={() => {
              if (!target) return;
              if (isRestore) {
                onRestore?.(target.id, reason.trim());
              } else {
                onConfirm(target.id, reason.trim());
              }
            }}
            disabled={!canConfirm}
          >
            {isSubmitting ? (
              <span className="inline-flex items-center gap-sm">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                {isRestore ? 'Restoring' : 'Revoking'}
              </span>
            ) : isRestore ? (
              <>
                <UserCheck aria-hidden />
                Restore access
              </>
            ) : (
              <>
                <AlertTriangle aria-hidden />
                Revoke access
              </>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
