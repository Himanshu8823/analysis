'use client';

import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';

import { PageHeader } from '@/components/layout/PageHeader';
import { Select } from '@/components/forms/Select';
import { Button } from '@/components/ui/button';
import { useImportStudents } from '@/hooks/useStudents';
import { useBranches } from '@/hooks/useBranches';
import { useSchemes } from '@/hooks/useSchemes';
import { useAcademicYears } from '@/hooks/useAcademic';
import type { BulkImportResult, BulkImportScope } from '@/lib/services/students.service';

/**
 * Import students — the bulk import flow.
 *
 * Separate from the single-record create/edit pages because the scope is
 * optional here (it can be read from the sheet itself) and the result needs
 * room to show per-row errors.
 */
export default function ImportStudentsPage() {
  const { data: branchesData } = useBranches();
  const { data: schemesData } = useSchemes();
  const { data: academicYears } = useAcademicYears();
  const { mutate: importStudents, isPending: importing } = useImportStudents();

  const [result, setResult] = useState<BulkImportResult | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const branches = branchesData ?? [];
  const schemes = schemesData ?? [];
  const activeYear = academicYears?.find((y) => y.isActive) ?? academicYears?.[0];

  const [branchId, setBranchId] = useState('');
  const [schemeId, setSchemeId] = useState('');
  const [academicYearId, setAcademicYearId] = useState(activeYear?.id ?? '');
  const [currentYear, setCurrentYear] = useState(1);
  const [semester, setSemester] = useState(1);

  const scope: BulkImportScope = {
    branchId: branchId || undefined,
    schemeId: schemeId || undefined,
    academicYearId: academicYearId || undefined,
    currentYear,
    semester,
  };

  return (
    <section className="flex flex-col gap-6 md:gap-8">
      <PageHeader
        title="Import students"
        description="Upload a CSV or Excel sheet to add many students at once."
        actions={
          <Button variant="secondary" asChild className="w-full md:w-auto">
            <a href="/students">
              <ArrowLeft aria-hidden />
              Back to students
            </a>
          </Button>
        }
      />

      <div className="rounded-xl border border-hairline bg-card p-4 md:p-6">
        <p className="text-body-sm text-body">
          Upload a CSV or Excel sheet with a <strong>Roll No</strong> and{' '}
          <strong>Name</strong> column. Any other scope columns are optional —
          whatever you leave blank here is read from the sheet.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-base md:grid-cols-2">
          <Select
            label="Branch"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
          >
            <option value="">From the sheet</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.code} · {branch.name}
              </option>
            ))}
          </Select>
          <Select
            label="Scheme"
            value={schemeId}
            onChange={(e) => setSchemeId(e.target.value)}
          >
            <option value="">From the sheet</option>
            {schemes.map((scheme) => (
              <option key={scheme.id} value={scheme.id}>
                {scheme.name}
              </option>
            ))}
          </Select>
          <Select
            label="Academic year"
            value={academicYearId}
            onChange={(e) => setAcademicYearId(e.target.value)}
          >
            <option value="">From the sheet</option>
            {academicYears?.map((year) => (
              <option key={year.id} value={year.id}>
                {year.year}
              </option>
            ))}
          </Select>
          <Select
            label="Year"
            value={String(currentYear)}
            onChange={(e) => setCurrentYear(Number(e.target.value))}
          >
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                Year {n}
              </option>
            ))}
          </Select>
          <Select
            label="Semester"
            value={String(semester)}
            onChange={(e) => setSemester(Number(e.target.value))}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
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
            }}
          />
        </label>

        <div className="mt-6 flex flex-col-reverse gap-2 border-t border-hairline pt-4 md:flex-row md:items-center md:justify-end">
          <Button variant="secondary" asChild className="w-full md:w-auto">
            <a href="/students">Cancel</a>
          </Button>
          <Button
            disabled={!file || importing}
            onClick={() => file && importStudents({ file, scope }, { onSuccess: setResult })}
            className="w-full md:w-auto"
          >
            {importing ? 'Importing…' : 'Import students'}
          </Button>
        </div>

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
                {result.errors.slice(0, 10).map((error) => (
                  <li
                    key={`${error.row}-${error.error}`}
                    className="text-body-sm text-semantic-down"
                  >
                    Row {error.row}: {error.error}
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
