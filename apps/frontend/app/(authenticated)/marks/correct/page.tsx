'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, Loader2, ShieldCheck } from 'lucide-react';

import { Select } from '@/components/forms/Select';
import { PageHeader } from '@/components/layout/PageHeader';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ClassContextBar } from '@/components/context/ClassContextBar';
import { RequirePermission } from '@/components/auth/RequirePermission';
import { useStudents } from '@/hooks/useStudents';
import { useSubjectCatalogueOfferings } from '@/hooks/useSubjects';
import { useMarks, useCorrectMark } from '@/hooks/useMarks';
import { extractErrorMessage } from '@/hooks/useAuth';
import { useClassContext } from '@/lib/context/class-context';
import type { ExamType } from '@/lib/services/marks.service';

/**
 * The exam components a subject may carry, in the college's own words.
 *
 * These are the exact values the backend accepts. Which of them apply to a
 * given subject depends on the scheme, so the list is fixed but the choice
 * is the exam cell's.
 */
const EXAM_TYPES: ExamType[] = ['CA1', 'CA2', 'MID_SEM', 'WRITTEN', 'PRACTICAL', 'ORAL'];

const EXAM_TYPE_LABEL: Record<ExamType, string> = {
  CA1: 'CA 1',
  CA2: 'CA 2',
  MID_SEM: 'Mid semester',
  WRITTEN: 'Written',
  PRACTICAL: 'Practical',
  ORAL: 'Oral',
};

/**
 * The correction screen — the examination cell's way of changing a mark a
 * teacher has entered.
 *
 * This is deliberately a *separate* screen from ordinary mark entry, and
 * deliberately more demanding:
 *
 *  - it is reachable only by a member who holds `marks:write` — the exam
 *    cell. A teacher never sees it;
 *  - it shows what the mark currently holds, so the correction is made
 *    against a value the examiner can see;
 *  - it demands a reason, because a correction overwrites work another
 *    person is responsible for, and "someone changed my mark" with no
 *    explanation is not an answer the college can give.
 *
 * The mark's previous value is kept on record by the server, so this screen
 * never destroys the teacher's entry — it supersedes it.
 */
function CorrectMarkContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { context: classContext } = useClassContext();
  const branchId = classContext.branchId;
  const schemeId = classContext.schemeId;
  const semester = classContext.semester;
  const academicYearId = classContext.academicYearId;

  /**
   * The screen may be opened with the mark already chosen — the marks screen
   * links here for a specific student and component.
   */
  const [offeringId, setOfferingId] = useState(searchParams.get('offeringId') ?? '');
  const [studentId, setStudentId] = useState(searchParams.get('studentId') ?? '');
  const [examType, setExamType] = useState<ExamType>(
    (searchParams.get('examType') as ExamType) ?? 'CA1'
  );
  const [newValue, setNewValue] = useState('');
  const [reason, setReason] = useState('');

  /**
   * The subject is cleared when the class changes, for the same reason the
   * marks screen clears it: a subject belongs to one class, and keeping the
   * old selection would mix two classes together.
   */
  useEffect(() => {
    setOfferingId('');
    setStudentId('');
  }, [branchId, schemeId, semester, academicYearId]);

  const offeringsQuery = useSubjectCatalogueOfferings({
    branchId: branchId || undefined,
    schemeId: schemeId || undefined,
    semester,
    academicYearId: academicYearId || undefined,
  });

  const offerings = useMemo(
    () => (offeringsQuery.data ?? []).filter((o) => o.isActive !== false),
    [offeringsQuery.data]
  );

  const selectedOffering = offerings.find((o) => o.id === offeringId);

  const studentsQuery = useStudents(
    branchId && schemeId && semester > 0
      ? {
          branchId,
          schemeId,
          semester,
          academicYearId: academicYearId || undefined,
          pageSize: 200,
        }
      : undefined
  );

  const students = studentsQuery.data?.items ?? [];

  /**
   * The marks already on record for the chosen subject, so the examiner can
   * see the value they are about to replace — and so the screen can tell
   * them when there is nothing to correct.
   */
  const existingMarks = useMarks(
    selectedOffering && academicYearId
      ? { subjectOfferingId: selectedOffering.id, academicYearId }
      : undefined
  );

  const existingMark = useMemo(
    () =>
      (existingMarks.data ?? []).find(
        (mark) => mark.studentId === studentId && mark.examType === examType
      ),
    [existingMarks.data, studentId, examType]
  );

  const correct = useCorrectMark();

  const scopeReady = !!branchId && !!schemeId && !!academicYearId && !!offeringId && !!studentId;

  const reasonTooShort = reason.trim().length > 0 && reason.trim().length < 10;
  const canSubmit =
    scopeReady &&
    !!existingMark &&
    !existingMark.isAbsent &&
    newValue.trim() !== '' &&
    Number.isFinite(Number(newValue)) &&
    reason.trim().length >= 10 &&
    !correct.isPending;

  const onSubmit = () => {
    if (!canSubmit || !existingMark) return;

    correct.mutate(
      {
        studentId,
        subjectOfferingId: offeringId,
        examType,
        marksObtained: Number(newValue),
        maxMarks: existingMark.maxMarks,
        academicYearId,
        reason: reason.trim(),
      },
      {
        onSuccess: () => {
          router.push('/marks');
        },
      }
    );
  };

  return (
    <section className="flex flex-col gap-6 md:gap-8">
      <PageHeader
        title="Correct a mark"
        description="Change a mark that a teacher has entered. The original value is kept on record, and your reason is saved with the change."
      />

      <ClassContextBar />

      {correct.isError ? (
        <ErrorBanner message={extractErrorMessage(correct.error)} retry={onSubmit} />
      ) : null}

      <article className="cb-surface-card" aria-labelledby="correct-subject-title">
        <header className="mb-base">
          <h2 id="correct-subject-title" className="font-display text-title-md text-ink">
            Which mark to correct
          </h2>
        </header>

        <div className="grid grid-cols-1 gap-base md:grid-cols-2 lg:grid-cols-3">
          <Select
            label="Subject"
            value={offeringId}
            onChange={(e) => setOfferingId(e.target.value)}
            disabled={!branchId || !schemeId}
          >
            <option value="">
              {offerings.length === 0 && branchId && schemeId
                ? 'No subjects offered for this class'
                : 'Select subject'}
            </option>
            {offerings.map((offering) => (
              <option key={offering.id} value={offering.id}>
                {offering.subject?.code ?? offering.subjectId} ·{' '}
                {offering.subject?.name ?? 'Subject'}
              </option>
            ))}
          </Select>

          <Select
            label="Student"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            disabled={!branchId || !schemeId}
          >
            <option value="">
              {students.length === 0 && branchId && schemeId
                ? 'No students in this class'
                : 'Select student'}
            </option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.rollNo} · {student.name}
              </option>
            ))}
          </Select>

          <Select
            label="Component"
            value={examType}
            onChange={(e) => setExamType(e.target.value as ExamType)}
          >
            {EXAM_TYPES.map((type) => (
              <option key={type} value={type}>
                {EXAM_TYPE_LABEL[type]}
              </option>
            ))}
          </Select>
        </div>
      </article>

      {scopeReady ? (
        existingMarks.isLoading ? (
          <article className="cb-surface-card p-base">
            <p className="flex items-center gap-sm text-body-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Looking up the mark…
            </p>
          </article>
        ) : !existingMark ? (
          <article className="cb-surface-card p-base">
            <EmptyState
              title="There is no mark to correct here"
              description="This student has no mark entered for this component. If the mark is missing entirely, add it on the Marks Entry screen instead."
            />
          </article>
        ) : existingMark.isAbsent ? (
          <article className="cb-surface-card p-base">
            <EmptyState
              title="This student was marked absent"
              description="An absent mark is changed on the Marks Entry screen, not here. A correction is for changing a score that was entered."
            />
          </article>
        ) : (
          <article className="cb-surface-card" aria-labelledby="correct-value-title">
            <header className="mb-base">
              <h2 id="correct-value-title" className="font-display text-title-md text-ink">
                The change
              </h2>
              <p className="mt-xs text-body-sm text-muted">
                The mark currently reads <strong>{existingMark.marksObtained}</strong> out of{' '}
                {existingMark.maxMarks}. The value you enter replaces it, and the original stays
                on record.
              </p>
            </header>

            <div className="grid grid-cols-1 gap-base md:grid-cols-2">
              <div className="flex flex-col gap-xs">
                <label htmlFor="corrected-marks" className="text-body-sm font-semibold text-ink">
                  Corrected marks
                </label>
                <input
                  id="corrected-marks"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={existingMark.maxMarks}
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  aria-describedby="corrected-marks-help"
                  className="cb-input num w-full sm:w-40"
                />
                <span id="corrected-marks-help" className="text-caption text-muted">
                  Out of {existingMark.maxMarks}.
                </span>
              </div>

              <div className="flex flex-col gap-xs">
                <label htmlFor="correction-reason" className="text-body-sm font-semibold text-ink">
                  Why is this being corrected?
                </label>
                <textarea
                  id="correction-reason"
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  aria-describedby="correction-reason-help"
                  aria-invalid={reasonTooShort ? true : undefined}
                  placeholder="For example: the answer sheet was marked twice and the second marking was correct."
                  className="cb-input w-full"
                />
                <span
                  id="correction-reason-help"
                  className={reasonTooShort ? 'text-caption text-semantic-down' : 'text-caption text-muted'}
                >
                  {reasonTooShort
                    ? 'Please write a little more, so the change can be explained later.'
                    : 'This is shown to the teacher whose mark was changed, and kept in the audit trail.'}
                </span>
              </div>
            </div>

            <div className="mt-base flex flex-wrap items-center gap-sm">
              <button
                type="button"
                className="cb-btn-primary w-full sm:w-auto"
                onClick={onSubmit}
                disabled={!canSubmit}
              >
                {correct.isPending ? (
                  <span className="inline-flex items-center gap-sm">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Saving
                  </span>
                ) : (
                  <>
                    <ShieldCheck className="mr-1 h-4 w-4" aria-hidden />
                    Save the correction
                  </>
                )}
              </button>
              <button
                type="button"
                className="cb-btn-secondary w-full sm:w-auto"
                onClick={() => router.push('/marks')}
              >
                Cancel
              </button>
            </div>

            <p className="mt-base flex items-start gap-xs text-caption text-muted">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>
                This correction is recorded against your name. The teacher who entered the original
                mark keeps their entry on record, and the reason above is kept alongside it.
              </span>
            </p>
          </article>
        )
      ) : (
        <article className="cb-surface-card flex items-start gap-sm p-base" role="status">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
          <p className="text-body-sm text-body">
            {branchId && schemeId
              ? 'Choose a subject and a student to correct their mark.'
              : 'Choose a branch and scheme above to correct a mark.'}
          </p>
        </article>
      )}
    </section>
  );
}

export default function CorrectMarkPage() {
  return (
    <RequirePermission
      permissions={['marks:write']}
      screenLabel="Correct a mark"
    >
      <CorrectMarkContent />
    </RequirePermission>
  );
}
