'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { PageHeader } from '@/components/layout/PageHeader';
import { Select } from '@/components/forms/Select';
import { Button } from '@/components/ui/button';
import { useImportStudents } from '@/hooks/useStudents';
import { useBranches } from '@/hooks/useBranches';
import { useSchemes } from '@/hooks/useSchemes';
import { useAcademicYears, useBatches, useRunningYear } from '@/hooks/useAcademic';
import { extractErrorMessage } from '@/hooks/useAuth';
import { useClassContext } from '@/lib/context/class-context';
import { ALL_SEMESTERS, yearForSemester } from '@/lib/academic';
import type { BulkImportResult, BulkImportScope } from '@/lib/services/students.service';

/**
 * Import students — the bulk import flow.
 *
 * The sheet carries only the two things that are unique to each student:
 * their roll number and their name. Everything that is true of the whole
 * batch — the branch, scheme, academic year, batch, year and semester —
 * is chosen once on this page and applied to every row, exactly as it is
 * when a single student is added by hand.
 *
 * That keeps the sheet free of repeated columns and keeps the file readable
 * for whoever prepares it.
 */
export default function ImportStudentsPage() {
  const router = useRouter();
  const { data: branchesData } = useBranches();
  const { data: schemesData } = useSchemes();
  const { data: academicYears } = useAcademicYears();
  const runningYear = useRunningYear();
  const { data: batchData } = useBatches();
  const { mutate: importStudents, isPending: importing } = useImportStudents();

  const [result, setResult] = useState<BulkImportResult | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * The class comes from the shared context.
   *
   * Importing a sheet files every student in it into one class, so this
   * screen works on the class the member is already working on elsewhere.
   * The batch is the one thing that stays here: a batch records the year a
   * student was admitted, which is a fact about the students being imported
   * rather than about the class they are joining.
   */
  const { context: classContext, setPart: setClassPart } = useClassContext();

  const branches = branchesData ?? [];
  const schemes = schemesData ?? [];
  const batches = batchData ?? [];
  /**
   * The **running** academic year is the default — the one the calendar's
   * dates say is running today, which is what the backend defaults its
   * reports to.
   */
  const activeYear = runningYear.year ?? academicYears?.[0];

  const [batchId, setBatchId] = useState('');

  const branchId = classContext.branchId;
  const schemeId = classContext.schemeId;
  const semester = classContext.semester;

  /**
   * The year follows from the semester, so it can never disagree with it.
   * It is shown for reference but not sent — the server derives it too.
   */
  const currentYear = yearForSemester(semester);

  /**
   * The academic year falls back to the active one.
   *
   * The years are fetched asynchronously, so the context starts empty and is
   * filled in only once the operator picks one — a Radix select never fires
   * `onValueChange` for the value that is already selected, so leaving the
   * context empty would keep the scope unresolved on a college with a single
   * academic year.
   */
  const effectiveAcademicYearId = classContext.academicYearId || activeYear?.id || '';

  const scope: BulkImportScope = {
    branchId: branchId || undefined,
    schemeId: schemeId || undefined,
    batchId: batchId || undefined,
    academicYearId: effectiveAcademicYearId || undefined,
    semester,
  };

  /**
   * Everything except the file has to be chosen before the import runs.
   * The import button stays disabled until it is, so a student cannot end up
   * filed under the wrong branch.
   */
  const scopeComplete = Boolean(
    branchId && schemeId && batchId && effectiveAcademicYearId
  );
  const canImport = Boolean(file) && scopeComplete && !importing;

  return (
    <section className="flex flex-col gap-6 md:gap-8">
      <PageHeader
        title="Import students"
        description="Upload a CSV or Excel sheet to add many students at once."
        backLink={{ href: '/students', label: 'Back to students' }}
      />

      <div className="rounded-xl border border-hairline bg-card p-4 md:p-6">
        <p className="text-body-sm text-body">
          Upload a CSV or Excel sheet with a <strong>Roll No</strong> and{' '}
          <strong>Name</strong> column. The class details below apply to every
          student in the file.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-base md:grid-cols-2">
          <Select
            label="Branch"
            value={branchId}
            onChange={(e) => setClassPart('branchId', e.target.value)}
            required
          >
            <option value="" disabled>
              Select a branch
            </option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.code} · {branch.name}
              </option>
            ))}
          </Select>
          <Select
            label="Scheme"
            value={schemeId}
            onChange={(e) => setClassPart('schemeId', e.target.value)}
            required
          >
            <option value="" disabled>
              Select a scheme
            </option>
            {schemes.map((scheme) => (
              <option key={scheme.id} value={scheme.id}>
                {scheme.name}
              </option>
            ))}
          </Select>
          <Select
            label="Academic year"
            value={effectiveAcademicYearId}
            onChange={(e) => setClassPart('academicYearId', e.target.value)}
            required
          >
            <option value="" disabled>
              Select an academic year
            </option>
            {academicYears?.map((year) => (
              <option key={year.id} value={year.id}>
                {year.year}
              </option>
            ))}
          </Select>
          {/**
           * A batch records the year a student was admitted, while
           * `academicYearId` is the year the student is currently in. They are
           * different years, so filtering the batches by the current academic
           * year would hide the very batch the student belongs to. Every
           * batch is listed instead — the same rule the single-student form
           * follows.
           */}
          <Select
            label="Batch"
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
            required
          >
            <option value="" disabled>
              Select a batch
            </option>
            {batches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.name}
              </option>
            ))}
          </Select>
          {/**
           * The year follows from the semester — semesters 1 and 2 are year 1,
           * semesters 3 and 4 are year 2, and so on. It is shown for
           * reference but not chosen, so the two can never disagree.
           */}
          <Select label="Year" value={String(currentYear)} disabled>
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                Year {n}
              </option>
            ))}
          </Select>
          <Select
            label="Semester"
            value={String(semester)}
            onChange={(e) => setClassPart('semester', Number(e.target.value))}
          >
            {ALL_SEMESTERS.map((n) => (
              <option key={n} value={n}>
                Semester {n}
              </option>
            ))}
          </Select>
        </div>

        <label className="mt-4 flex flex-col gap-xs">
          <span className="text-body-sm font-semibold text-ink">File</span>
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            className="cb-input"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setError(null);
            }}
          />
          <span className="text-body-sm text-muted">
            The sheet needs a header row with <strong>Roll No</strong> and{' '}
            <strong>Name</strong> columns.
          </span>
        </label>

        <div className="mt-6 flex flex-col-reverse gap-2 border-t border-hairline pt-4 md:flex-row md:items-center md:justify-end">
          <Button variant="secondary" asChild className="w-full md:w-auto">
            <a href="/students">Cancel</a>
          </Button>
          <Button
            disabled={!canImport}
            onClick={() =>
              file &&
              importStudents(
                { file, scope },
                {
                  onSuccess: (imported) => {
                    /**
                     * The import is done — the operator is sent to the student
                     * list, which is where they would go to check the result.
                     * The toast from the hook carries the count.
                     */
                    if (imported.inserted > 0) {
                      router.push('/students');
                      return;
                    }
                    setResult(imported);
                  },
                  onError: (error) => setError(extractErrorMessage(error)),
                }
              )
            }
            className="w-full md:w-auto"
          >
            {importing ? 'Importing…' : 'Import students'}
          </Button>
        </div>

        {error ? (
          <div
            role="alert"
            className="mt-4 rounded-md border border-hairline bg-surface-soft p-base text-body-sm text-semantic-down"
          >
            {error}
          </div>
        ) : null}

        {result ? (
          <div className="mt-4 flex flex-col gap-xs rounded-md border border-hairline bg-surface-soft p-base">
            <p className="text-body-sm font-semibold text-ink">
              Imported {result.inserted} student{result.inserted === 1 ? '' : 's'}
              {result.failed > 0
                ? ` · ${result.failed} row${result.failed === 1 ? '' : 's'} failed`
                : ''}
            </p>
            {result.errors && result.errors.length > 0 ? (
              <ul className="flex flex-col gap-xs">
                {result.errors.slice(0, 10).map((rowError) => (
                  <li
                    key={`${rowError.row}-${rowError.error}`}
                    className="text-body-sm text-semantic-down"
                  >
                    Row {rowError.row}: {rowError.error}
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="mt-2">
              <Button variant="secondary" asChild className="w-full md:w-auto">
                <a href="/students">Back to students</a>
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
