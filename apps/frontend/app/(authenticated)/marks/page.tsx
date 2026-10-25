'use client';

import { useMemo, useState } from 'react';
import { Save, Loader2, ClipboardCheck, AlertCircle } from 'lucide-react';

import { Select } from '@/components/forms/Select';
import { Pagination } from '@/components/forms/Pagination';
import { TableSkeleton } from '@/components/forms/TableSkeleton';
import { PageHeader } from '@/components/layout/PageHeader';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { EmptyState } from '@/components/feedback/EmptyState';
import { useBranches } from '@/hooks/useBranches';
import { useSchemes } from '@/hooks/useSchemes';
import { useAcademicYears } from '@/hooks/useAcademic';
import { useStudents } from '@/hooks/useStudents';
import { useSubjectCatalogueOfferings } from '@/hooks/useSubjects';
import { useCreateBulkMarks, useMarks } from '@/hooks/useMarks';
import { useTablePagination } from '@/hooks/useTablePagination';
import { extractErrorMessage } from '@/hooks/useAuth';
import type { BulkMarkInput, ExamType } from '@/lib/services/marks.service';
import { cn } from '@/lib/utils';

/**
 * The exam components a subject may carry.
 *
 * These are the exact values the backend accepts (`CreateMarkDto.EXAM_TYPES`).
 * Which of them apply to a given subject depends on the scheme, so the
 * teacher picks from the ones the scheme defines — but the list itself is
 * fixed by the contract.
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
 * One editable cell.
 *
 * The state is a string because an input holds text, and a partially-typed
 * number ("1" on the way to "18") must not be coerced to a number and lost.
 */
interface CellState {
  value: string;
  absent: boolean;
}

/**
 * One student's row: the cell for every component, keyed by exam type.
 *
 * A row carries every component so switching the component selector keeps
 * the values the user already typed for the other components.
 */
type RowState = Partial<Record<ExamType, CellState>>;

/**
 * The grid's state: one row per student.
 */
type GridState = Record<string, RowState>;

export default function MarksEntryPage() {
  const [branchId, setBranchId] = useState('');
  const [schemeId, setSchemeId] = useState('');
  const [semester, setSemester] = useState(1);
  const [academicYearId, setAcademicYearId] = useState('');
  const [offeringId, setOfferingId] = useState('');
  const [examType, setExamType] = useState<ExamType>('CA1');
  const [maxMarks, setMaxMarks] = useState('20');
  const [rows, setRows] = useState<GridState>({});

  const { data: branchesData } = useBranches();
  const { data: schemesData } = useSchemes();
  const { data: academicYears } = useAcademicYears();

  const branches = branchesData ?? [];
  const schemes = schemesData ?? [];
  const years = academicYears ?? [];

  // The active academic year is the default, so the form works on arrival.
  const activeYear = years.find((y) => y.isActive) ?? years[0];
  const effectiveAcademicYearId = academicYearId || activeYear?.id || '';

  const offeringsQuery = useSubjectCatalogueOfferings({
    branchId: branchId || undefined,
    schemeId: schemeId || undefined,
    semester,
    academicYearId: effectiveAcademicYearId || undefined,
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
          academicYearId: effectiveAcademicYearId || undefined,
          pageSize: 200,
        }
      : undefined
  );

  const students = studentsQuery.data?.items ?? [];
  const { page, setPage, pageSize, setPageSize, total, pageItems } = useTablePagination(students, {
    pageSize: 20,
    resetKey: `${branchId}|${schemeId}|${semester}|${effectiveAcademicYearId}`,
  });

  /**
   * The marks already entered for the selected offering, so the grid opens
   * showing what is there rather than a blank sheet that would silently
   * overwrite the existing entries on save.
   */
  const existingMarks = useMarks(
    selectedOffering && effectiveAcademicYearId
      ? {
          subjectOfferingId: selectedOffering.id,
          academicYearId: effectiveAcademicYearId,
        }
      : undefined
  );

  const createBulk = useCreateBulkMarks();

  const scopeReady =
    !!branchId && !!schemeId && semester > 0 && !!effectiveAcademicYearId && !!offeringId;

  /**
   * The grid is seeded from the marks already on record. A cell that has no
   * entry starts blank, and a cell that has one starts with its value.
   */
  const seedRows = useMemo(() => {
    const seeded: GridState = {};
    for (const student of students) {
      seeded[student.id] = {};
    }
    for (const mark of existingMarks.data ?? []) {
      const row = seeded[mark.studentId];
      if (!row) continue;
      row[mark.examType] = {
        value: mark.isAbsent ? '' : String(mark.marksObtained),
        absent: mark.isAbsent,
      };
    }
    return seeded;
  }, [students, existingMarks.data]);

  /**
   * The seeded cell for a student and component.
   *
   * A component the teacher has not opened yet falls back to what is on
   * record, so switching the component selector shows the existing marks
   * rather than an empty input.
   */
  const cellFor = (studentId: string): CellState | undefined =>
    rows[studentId]?.[examType] ?? seedRows[studentId]?.[examType];

  /**
   * The rows the user has actually touched — the ones to save.
   *
   * Only touched cells are sent, so saving a grid never blanks the
   * components the user did not open. A cell counts as touched when it has a
   * value or is explicitly marked absent.
   */
  const dirtyRows = useMemo(() => {
    if (!scopeReady || !selectedOffering) return [];
    const payload: BulkMarkInput[] = [];
    for (const student of students) {
      const row = rows[student.id];
      if (!row) continue;
      const cell = row[examType];
      if (!cell) continue;
      if (!cell.absent && cell.value.trim() === '') continue;
      const obtained = cell.absent ? 0 : Number(cell.value);
      if (!cell.absent && !Number.isFinite(obtained)) continue;
      payload.push({
        studentId: student.id,
        subjectOfferingId: selectedOffering.id,
        examType,
        marksObtained: obtained,
        maxMarks: Number(maxMarks) || 0,
        isAbsent: cell.absent,
        academicYearId: effectiveAcademicYearId,
      });
    }
    return payload;
  }, [rows, students, scopeReady, selectedOffering, examType, maxMarks, effectiveAcademicYearId]);

  const setCell = (studentId: string, value: string) => {
    setRows((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [examType]: { value, absent: prev[studentId]?.[examType]?.absent ?? false },
      },
    }));
  };

  const toggleAbsent = (studentId: string) => {
    setRows((prev) => {
      const current = prev[studentId]?.[examType];
      const nextAbsent = !(current?.absent ?? false);
      return {
        ...prev,
        [studentId]: {
          ...prev[studentId],
          [examType]: {
            value: nextAbsent ? '' : current?.value ?? '',
            absent: nextAbsent,
          },
        },
      };
    });
  };

  const onSave = () => {
    if (dirtyRows.length === 0) return;
    createBulk.mutate(dirtyRows, {
      onSuccess: () => {
        setRows({});
      },
    });
  };

  return (
    <section className="flex flex-col gap-6 md:gap-8">
      <PageHeader
        title="Marks Entry"
        description="Enter the marks for one subject component across a class. Only the cells you edit are saved."
      />

      {/* Scope */}
      <article className="cb-surface-card" aria-labelledby="marks-scope-title">
        <header className="mb-base flex items-center gap-sm">
          <ClipboardCheck className="h-5 w-5 text-primary" aria-hidden />
          <h2 id="marks-scope-title" className="font-display text-title-md text-ink">
            Class and subject
          </h2>
        </header>

        <div className="grid grid-cols-1 gap-base md:grid-cols-2 lg:grid-cols-3">
          <Select
            label="Branch"
            value={branchId}
            onChange={(e) => {
              setBranchId(e.target.value);
              setOfferingId('');
            }}
          >
            <option value="">Select branch</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.code} · {branch.name}
              </option>
            ))}
          </Select>

          <Select
            label="Scheme"
            value={schemeId}
            onChange={(e) => {
              setSchemeId(e.target.value);
              setOfferingId('');
            }}
          >
            <option value="">Select scheme</option>
            {schemes.map((scheme) => (
              <option key={scheme.id} value={scheme.id}>
                {scheme.name}
              </option>
            ))}
          </Select>

          <Select
            label="Semester"
            value={String(semester)}
            onChange={(e) => {
              setSemester(Number(e.target.value));
              setOfferingId('');
            }}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <option key={n} value={n}>
                Semester {n}
              </option>
            ))}
          </Select>

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

          <Select
            label="Academic year"
            value={effectiveAcademicYearId}
            onChange={(e) => setAcademicYearId(e.target.value)}
          >
            {years.length === 0 ? <option value="">No academic years</option> : null}
            {years.map((year) => (
              <option key={year.id} value={year.id}>
                {year.year}
              </option>
            ))}
          </Select>
        </div>

        <div className="mt-base">
          <label
            htmlFor="max-marks"
            className="text-caption uppercase tracking-wide text-muted"
          >
            Maximum marks for this component
          </label>
          <input
            id="max-marks"
            type="number"
            inputMode="numeric"
            min={1}
            value={maxMarks}
            onChange={(e) => setMaxMarks(e.target.value)}
            className="cb-input mt-1 w-full sm:w-40"
          />
        </div>
      </article>

      {createBulk.isError ? (
        <ErrorBanner
          message={extractErrorMessage(createBulk.error)}
          retry={onSave}
        />
      ) : null}

      {/* Entry grid */}
      {scopeReady ? (
        <article className="cb-surface-card overflow-hidden rounded-md" aria-labelledby="entry-grid-title">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-base py-base">
            <div>
              <h2 id="entry-grid-title" className="font-display text-title-md text-ink">
                {selectedOffering?.subject?.name ?? 'Marks'}
              </h2>
              <p className="text-caption text-muted">
                {EXAM_TYPE_LABEL[examType]} · out of {maxMarks || '—'} · {students.length}{' '}
                student{students.length === 1 ? '' : 's'}
              </p>
            </div>
            <button
              type="button"
              className="cb-btn-primary w-full sm:w-auto"
              onClick={onSave}
              disabled={dirtyRows.length === 0 || createBulk.isPending}
            >
              {createBulk.isPending ? (
                <span className="inline-flex items-center gap-sm">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Saving
                </span>
              ) : (
                <>
                  <Save className="mr-1 h-4 w-4" aria-hidden />
                  Save {dirtyRows.length > 0 ? `${dirtyRows.length} mark${dirtyRows.length === 1 ? '' : 's'}` : ''}
                </>
              )}
            </button>
          </header>

          {studentsQuery.isLoading ? (
            <div className="p-base">
              <TableSkeleton columns={4} rows={6} bordered={false} />
            </div>
          ) : students.length === 0 ? (
            <div className="p-base">
              <EmptyState
                title="No students in this class"
                description="Add students to this branch, scheme and semester before entering their marks."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-body-sm">
                <thead className="bg-surface-soft">
                  <tr>
                    <th scope="col" className="px-base py-sm text-left font-semibold text-muted">
                      Roll
                    </th>
                    <th scope="col" className="px-base py-sm text-left font-semibold text-muted">
                      Name
                    </th>
                    <th scope="col" className="px-base py-sm text-right font-semibold text-muted">
                      Marks / {maxMarks || '—'}
                    </th>
                    <th scope="col" className="px-base py-sm text-center font-semibold text-muted">
                      Absent
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((student) => {
                    const cell = cellFor(student.id);
                    const value = cell?.value ?? '';
                    const absent = cell?.absent ?? false;
                    const edited = rows[student.id]?.[examType] !== undefined;

                    return (
                      <tr
                        key={student.id}
                        className={cn(
                          'border-t border-hairline first:border-t-0',
                          edited && 'bg-surface-soft'
                        )}
                      >
                        <td className="num px-base py-sm text-body">{student.rollNo}</td>
                        <td className="px-base py-sm text-ink">{student.name}</td>
                        <td className="px-base py-sm text-right">
                          <input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={Number(maxMarks) || undefined}
                            value={value}
                            disabled={absent}
                            onChange={(e) => setCell(student.id, e.target.value)}
                            aria-label={`Marks for ${student.name}, ${student.rollNo}`}
                            className="cb-input num w-24 text-right"
                          />
                        </td>
                        <td className="px-base py-sm text-center">
                          <input
                            type="checkbox"
                            checked={absent}
                            onChange={() => toggleAbsent(student.id)}
                            aria-label={`Mark ${student.name} absent`}
                            className="size-5"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {dirtyRows.length > 0 ? (
            <p className="border-t border-hairline px-base py-sm text-caption text-muted">
              {dirtyRows.length} unsaved mark{dirtyRows.length === 1 ? '' : 's'}. Only the cells
              you edited will be saved.
            </p>
          ) : null}

          {!studentsQuery.isLoading && total > 0 ? (
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              className="border-t border-hairline px-base py-sm"
            />
          ) : null}
        </article>
      ) : (
        <article className="cb-surface-card flex items-start gap-sm p-base" role="status">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
          <p className="text-body-sm text-body">
            Choose a branch, scheme and subject to start entering marks.
          </p>
        </article>
      )}
    </section>
  );
}
