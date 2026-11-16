'use client';

import { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  Layers,
  Users,
} from 'lucide-react';

import { Select } from '@/components/forms/Select';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { TableSkeleton } from '@/components/forms/TableSkeleton';
import { useAcademicStructure } from '@/hooks/useAcademicStructure';
import { useBranches } from '@/hooks/useBranches';
import { cn } from '@/lib/utils';
import type { AcademicClass } from '@/lib/services/academic-structure.service';

/**
 * The academic structure — the spine of the college.
 *
 * Branches → years → semesters → the subjects taught to each class, who
 * teaches them, who is the class teacher, how many students are in the
 * class, and how many of them still have marks missing.
 *
 * This is the screen the college navigates by. Without it, setting up a new
 * year means opening four different screens and remembering which is which.
 */
export default function AcademicStructurePage() {
  const [branchId, setBranchId] = useState('');
  const [academicYearId, setAcademicYearId] = useState('');

  const { data: branchesData } = useBranches();
  const branches = branchesData ?? [];

  const structureQuery = useAcademicStructure({
    branchId: branchId || undefined,
    academicYearId: academicYearId || undefined,
  });

  const structure = structureQuery.data;
  const years = structure?.academicYears ?? [];

  /**
   * The classes, grouped by branch. The screen is a navigation, and a
   * navigation is a tree.
   */
  const byBranch = useMemo(() => {
    const groups = new Map<string, { name: string; code: string; classes: AcademicClass[] }>();

    for (const row of structure?.classes ?? []) {
      const group = groups.get(row.branchId) ?? {
        name: row.branchName,
        code: row.branchCode,
        classes: [],
      };
      group.classes.push(row);
      groups.set(row.branchId, group);
    }

    return [...groups.values()].sort((a, b) => a.code.localeCompare(b.code));
  }, [structure?.classes]);

  return (
    <section className="flex flex-col gap-6 md:gap-8">
      <PageHeader
        title="Academic Structure"
        description="The college's structure — branches, years and semesters — with the subjects taught to each class, the teachers, and how ready each class is."
      />

      <article className="cb-surface-card" aria-label="Filters">
        <div className="grid grid-cols-1 gap-base md:grid-cols-2 lg:grid-cols-3">
          <Select
            label="Branch"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
          >
            <option value="">All branches in my scope</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.code} · {branch.name}
              </option>
            ))}
          </Select>

          <Select
            label="Academic year"
            value={academicYearId}
            onChange={(e) => setAcademicYearId(e.target.value)}
          >
            <option value="">The running year</option>
            {years.map((year) => (
              <option key={year.id} value={year.id}>
                {year.year}
                {year.isActive ? ' (running)' : ''}
              </option>
            ))}
          </Select>
        </div>
      </article>

      {structureQuery.isError ? (
        <ErrorBanner
          message="Could not load the academic structure."
          retry={() => structureQuery.refetch()}
        />
      ) : null}

      {structureQuery.isLoading ? (
        <div className="cb-surface-card p-base">
          <TableSkeleton columns={4} rows={6} bordered={false} />
        </div>
      ) : byBranch.length === 0 ? (
        <div className="cb-surface-card p-base">
          <EmptyState
            variant="plain"
            title="No classes are set up yet"
            description="A class appears here once a subject is offered to a branch in a semester. Offer a subject, and the class appears with its teachers and its readiness."
            icon={<Layers className="h-8 w-8" aria-hidden />}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-base">
          {byBranch.map((group) => (
            <BranchGroup key={group.code} group={group} />
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * One branch and the classes it runs.
 */
function BranchGroup({
  group,
}: {
  group: { name: string; code: string; classes: AcademicClass[] };
}) {
  const [open, setOpen] = useState(true);

  return (
    <article className="cb-surface-card overflow-hidden rounded-md">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full items-center gap-sm px-base py-base text-left"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted" aria-hidden />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
        )}
        <span className="font-display text-title-md text-ink">{group.name}</span>
        <span className="num text-caption text-muted">{group.code}</span>
        <span className="ml-auto text-caption text-muted">
          {group.classes.length} class{group.classes.length === 1 ? '' : 'es'}
        </span>
      </button>

      {open ? (
        <div className="border-t border-hairline">
          {group.classes.map((row) => (
            <ClassRow key={`${row.schemeId}-${row.semester}`} row={row} />
          ))}
        </div>
      ) : null}
    </article>
  );
}

/**
 * One class — a semester of a scheme, with its subjects and its readiness.
 */
function ClassRow({ row }: { row: AcademicClass }) {
  const [open, setOpen] = useState(false);

  const missing = row.studentCount - row.studentsWithCompleteResult;

  return (
    <div className="border-b border-hairline last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full flex-wrap items-center gap-x-base gap-y-1 px-base py-3 text-left"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted" aria-hidden />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
        )}

        <span className="font-semibold text-ink">Semester {row.semester}</span>
        <span className="text-body-sm text-muted">{row.schemeName}</span>

        <span className="flex items-center gap-xs text-caption text-muted">
          <Layers className="h-3.5 w-3.5" aria-hidden />
          {row.subjects.length} subject{row.subjects.length === 1 ? '' : 's'}
        </span>

        <span className="flex items-center gap-xs text-caption text-muted">
          <Users className="h-3.5 w-3.5" aria-hidden />
          {row.studentCount} student{row.studentCount === 1 ? '' : 's'}
        </span>

        <span className="flex items-center gap-xs text-caption text-muted">
          <GraduationCap className="h-3.5 w-3.5" aria-hidden />
          {row.classTeacherName ?? 'No class teacher'}
        </span>

        <span className="ml-auto">
          {row.isReadyToPublish ? (
            <span className="cb-badge bg-surface-strong text-semantic-up">
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" aria-hidden />
              Ready to publish
            </span>
          ) : (
            <span className="cb-badge bg-surface-strong text-muted">
              <AlertCircle className="mr-1 h-3.5 w-3.5" aria-hidden />
              {missing} student{missing === 1 ? '' : 's'} missing marks
            </span>
          )}
        </span>
      </button>

      {open ? (
        <div className="overflow-x-auto pb-base">
          <table className="w-full text-body-sm">
            <thead className="bg-surface-soft">
              <tr>
                <th scope="col" className="px-base py-sm text-left font-semibold text-muted">
                  Subject
                </th>
                <th scope="col" className="px-base py-sm text-left font-semibold text-muted">
                  Code
                </th>
                <th scope="col" className="px-base py-sm text-left font-semibold text-muted">
                  Credits
                </th>
                <th scope="col" className="px-base py-sm text-left font-semibold text-muted">
                  Teacher
                </th>
              </tr>
            </thead>
            <tbody>
              {row.subjects.map((subject) => (
                <tr key={subject.subjectOfferingId} className="border-t border-hairline first:border-t-0">
                  <td className="px-base py-sm text-ink">{subject.subjectName}</td>
                  <td className="num px-base py-sm text-body">{subject.subjectCode}</td>
                  <td className="num px-base py-sm text-body">{subject.credits}</td>
                  <td
                    className={cn(
                      'px-base py-sm text-body',
                      !subject.teacherName && 'text-semantic-down'
                    )}
                  >
                    {subject.teacherName ?? 'Not allocated'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
