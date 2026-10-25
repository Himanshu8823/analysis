'use client';

import { useMemo, useState } from 'react';
import { BookUser, GraduationCap, Plus, Trash2, UserCheck } from 'lucide-react';

import { DataTable, type DataTableColumn } from '@/components/forms/DataTable';
import { FilterBar } from '@/components/forms/FilterBar';
import { Select } from '@/components/forms/Select';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import {
  Select as FilterSelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import {
  useAssignableTeachers,
  useClassTeacherAssignments,
  useCreateClassTeacherAssignment,
  useCreateTeacherAllocation,
  useDeleteClassTeacherAssignment,
  useDeleteTeacherAllocation,
  useSubjectOfferings,
  useTeacherAllocations,
} from '@/hooks/useAllocations';
import { useAcademicYears } from '@/hooks/useAcademic';
import { useBranches } from '@/hooks/useBranches';
import { useCurrentUser } from '@/hooks/useAuth';
import { useSchemes } from '@/hooks/useSchemes';
import type {
  ClassTeacherAssignment,
  TeacherAllocation,
} from '@/lib/services/allocations.service';
import type { SubjectOfferingOption } from '@/lib/services/subject-offerings';

type TabKey = 'subjects' | 'classTeachers';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'subjects', label: 'Subject allocations' },
  { key: 'classTeachers', label: 'Class teachers' },
];

/** The semesters a college runs. */
const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];

export default function AdminAssignmentsPage() {
  const [tab, setTab] = useState<TabKey>('subjects');

  /**
   * The branch scope.
   *
   * An HOD is branch-scoped: their session carries their branch, and they
   * allocate within it only — the branch is fixed for them. A college-wide
   * user (Super Admin, Admin) has no branch in their session, so they pick
   * one; the allocation endpoints scope by branch either way.
   */
  const { data: user } = useCurrentUser();
  const sessionBranchId = user?.branchId ?? '';
  const isBranchFixed = !!sessionBranchId;

  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [semester, setSemester] = useState<string>('');
  const [academicYearId, setAcademicYearId] = useState<string>('');
  const [schemeId, setSchemeId] = useState<string>('');

  const { data: branchesData } = useBranches();
  const { data: schemesData } = useSchemes();
  const { data: academicYears } = useAcademicYears();

  const branches = branchesData ?? [];
  const schemes = schemesData ?? [];
  const years = academicYears ?? [];

  /**
   * The branch the page is scoped to.
   *
   * For an HOD this is their own branch, always. For a college-wide user it
   * is whichever branch they picked — and when they have not picked one, no
   * allocation is listed at all, because an unscoped list would mix every
   * branch's teaching staff together.
   */
  const branchId = isBranchFixed
    ? sessionBranchId
    : branchFilter === 'all'
      ? ''
      : branchFilter;

  const branch = branches.find((b) => b.id === branchId);
  const activeYear = years.find((y) => y.isActive) ?? years[0];

  /**
   * The academic year falls back to the active one.
   *
   * A Radix select never fires `onValueChange` for the value that is already
   * selected, so leaving the state empty would keep the scope unresolved on
   * a college with a single academic year.
   */
  const effectiveAcademicYearId = academicYearId || activeYear?.id || '';

  const scopeFilters = useMemo(
    () => ({
      branchId: branchId || undefined,
      semester: semester ? Number(semester) : undefined,
      academicYearId: effectiveAcademicYearId || undefined,
    }),
    [branchId, semester, effectiveAcademicYearId],
  );

  const allocationsQuery = useTeacherAllocations(scopeFilters);
  const classTeachersQuery = useClassTeacherAssignments(scopeFilters);

  const hasActiveFilters =
    !isBranchFixed && branchFilter !== 'all' ? true : !!semester || !!academicYearId || !!schemeId;

  /**
   * The rows carry ids, not names — the branch, semester and scheme a class
   * or allocation belongs to are rendered by looking the id up here. The maps
   * are rebuilt whenever the reference lists change.
   */
  const academicYearLabels = useMemo(() => {
    const map = new Map<string, string>();
    for (const year of years) map.set(year.id, year.year);
    return map;
  }, [years]);

  const schemeLabels = useMemo(() => {
    const map = new Map<string, string>();
    for (const scheme of schemes) map.set(scheme.id, scheme.name);
    return map;
  }, [schemes]);

  const clearFilters = () => {
    if (!isBranchFixed) setBranchFilter('all');
    setSemester('');
    setAcademicYearId('');
    setSchemeId('');
  };

  return (
    <section className="flex flex-col gap-6 md:gap-8">
      <PageHeader
        title="Assignments"
        description={
          branch
            ? `Allocate the teaching staff of the ${branch.code} branch — who teaches which subject, and who is the class teacher for each class.`
            : 'Allocate the teaching staff — who teaches which subject, and who is the class teacher for each class.'
        }
      />

      {/* Tab bar — wraps on mobile */}
      <div
        role="tablist"
        aria-label="Assignment sections"
        className="flex flex-wrap gap-xs border-b border-hairline pb-sm"
      >
        {TABS.map((t) => {
          const isActive = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setTab(t.key)}
              className={`inline-flex h-11 items-center gap-sm rounded-md px-base text-body-sm font-semibold transition-colors ${
                isActive
                  ? 'bg-surface-strong text-ink'
                  : 'text-muted hover:bg-surface-soft hover:text-ink'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <FilterBar
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
        resultCount={
          isBranchFixed && branch
            ? 'Your branch — allocations are limited to it'
            : null
        }
      >
        {/*
          For an HOD the branch is fixed, not a filter: it is shown as a
          disabled dropdown so the scope of the page is visible at a glance.
          A college-wide user has no branch of their own, so they pick one.
        */}
        {isBranchFixed ? (
          <FilterSelect value={sessionBranchId} onValueChange={() => undefined} disabled>
            <SelectTrigger
              className="w-full md:w-56"
              aria-label="Your branch — allocations cannot cross branches"
            >
              <SelectValue placeholder="Your branch" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={sessionBranchId}>
                {branch ? `${branch.code} · ${branch.name}` : 'Your branch'}
              </SelectItem>
            </SelectContent>
          </FilterSelect>
        ) : (
          <FilterSelect value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger className="w-full md:w-56" aria-label="Filter by branch">
              <SelectValue placeholder="Select a branch" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All branches</SelectItem>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.code} · {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </FilterSelect>
        )}

        <FilterSelect value={semester} onValueChange={setSemester}>
          <SelectTrigger className="w-full md:w-40" aria-label="Filter by semester">
            <SelectValue placeholder="All semesters" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All semesters</SelectItem>
            {SEMESTERS.map((n) => (
              <SelectItem key={n} value={String(n)}>
                Semester {n}
              </SelectItem>
            ))}
          </SelectContent>
        </FilterSelect>

        <FilterSelect value={schemeId} onValueChange={setSchemeId}>
          <SelectTrigger className="w-full md:w-40" aria-label="Filter by scheme">
            <SelectValue placeholder="All schemes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All schemes</SelectItem>
            {schemes.map((scheme) => (
              <SelectItem key={scheme.id} value={scheme.id}>
                {scheme.name}
              </SelectItem>
            ))}
          </SelectContent>
        </FilterSelect>

        <FilterSelect value={academicYearId} onValueChange={setAcademicYearId}>
          <SelectTrigger className="w-full md:w-40" aria-label="Filter by academic year">
            <SelectValue placeholder="All academic years" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All academic years</SelectItem>
            {years.map((year) => (
              <SelectItem key={year.id} value={year.id}>
                {year.year}
              </SelectItem>
            ))}
          </SelectContent>
        </FilterSelect>
      </FilterBar>

      {tab === 'subjects' ? (
        <SubjectAllocationsTab
          branchId={branchId}
          semester={semester ? Number(semester) : undefined}
          schemeId={schemeId === 'all' ? undefined : schemeId}
          academicYearId={effectiveAcademicYearId}
          query={allocationsQuery}
          academicYearLabels={academicYearLabels}
        />
      ) : null}

      {tab === 'classTeachers' ? (
        <ClassTeachersTab
          branchId={branchId}
          semester={semester ? Number(semester) : undefined}
          schemeId={schemeId === 'all' ? undefined : schemeId}
          academicYearId={effectiveAcademicYearId}
          query={classTeachersQuery}
          academicYearLabels={academicYearLabels}
          schemeLabels={schemeLabels}
        />
      ) : null}
    </section>
  );
}

interface SubjectAllocationsTabProps {
  branchId: string;
  semester?: number;
  schemeId?: string;
  academicYearId: string;
  query: ReturnType<typeof useTeacherAllocations>;
  /** Academic year id → year label, for the rows' year column. */
  academicYearLabels: Map<string, string>;
}

function SubjectAllocationsTab({
  branchId,
  semester,
  schemeId,
  academicYearId,
  query,
  academicYearLabels,
}: SubjectAllocationsTabProps) {
  const [assignOpen, setAssignOpen] = useState(false);

  const allocations = query.data ?? [];

  const deleteAllocation = useDeleteTeacherAllocation();

  const columns: DataTableColumn<TeacherAllocation>[] = [
    {
      key: 'teacher',
      header: 'Teacher',
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-ink">{row.teacherName}</span>
          <span className="text-caption text-muted">{row.teacherEmail}</span>
        </div>
      ),
    },
    {
      key: 'subjectCode',
      header: 'Subject code',
      render: (row) => <span className="num text-ink">{row.subjectCode}</span>,
    },
    {
      key: 'subjectName',
      header: 'Subject',
      render: (row) => <span className="text-body-sm text-body">{row.subjectName}</span>,
    },
    {
      key: 'semester',
      header: 'Semester',
      render: (row) => <span className="num text-body-sm text-body">Sem {row.semester}</span>,
    },
    {
      key: 'year',
      header: 'Academic year',
      render: (row) => (
        <span className="text-body-sm text-body">
          {academicYearLabels.get(row.academicYearId) ?? row.academicYearId}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-xs">
          <button
            type="button"
            aria-label={`Remove ${row.teacherName} from ${row.subjectCode}`}
            title="Remove allocation"
            onClick={() => {
              if (
                confirm(
                  `Remove ${row.teacherName} from ${row.subjectCode}? The teacher will no longer be able to enter marks for it.`,
                )
              ) {
                deleteAllocation.mutate(row.id);
              }
            }}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-strong hover:text-semantic-down"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="flex flex-col gap-sm md:flex-row md:items-center md:justify-between">
        <p className="text-body-sm text-body">
          A teacher can be allocated any number of subjects. The allocation is
          what lets them enter marks for that subject.
        </p>
        <Button
          type="button"
          onClick={() => setAssignOpen(true)}
          disabled={!branchId}
          className="w-full md:w-auto"
        >
          <Plus aria-hidden />
          Assign teacher
        </Button>
      </div>

      {query.isError ? (
        <ErrorBanner
          message="Could not load subject allocations."
          retry={() => query.refetch()}
        />
      ) : null}

      <DataTable
        columns={columns}
        rows={allocations}
        keyExtractor={(row) => row.id}
        loading={query.isLoading}
        emptyState={
          branchId ? (
            <EmptyState
              variant="plain"
              title="No subject allocations yet"
              description="Assign a teacher to a subject so they can enter marks for it."
              icon={<BookUser aria-hidden />}
              action={
                <Button type="button" onClick={() => setAssignOpen(true)}>
                  <Plus aria-hidden />
                  Assign teacher
                </Button>
              }
            />
          ) : (
            <EmptyState
              variant="plain"
              title="Choose a branch to see its allocations"
              description="Allocations are always scoped to one branch. Pick the branch you are allocating for."
              icon={<BookUser aria-hidden />}
            />
          )
        }
      />

      <AssignSubjectSheet
        /* The key remounts the form when the scope changes, so the academic
           year field starts from the newly selected year. */
        key={`${branchId}-${semester ?? ''}-${schemeId ?? ''}-${academicYearId}`}
        open={assignOpen}
        onOpenChange={setAssignOpen}
        branchId={branchId}
        semester={semester}
        schemeId={schemeId}
        academicYearId={academicYearId}
      />
    </>
  );
}

interface ClassTeachersTabProps {
  branchId: string;
  semester?: number;
  schemeId?: string;
  academicYearId: string;
  query: ReturnType<typeof useClassTeacherAssignments>;
  /** Academic year id → year label. */
  academicYearLabels: Map<string, string>;
  /** Scheme id → scheme name. */
  schemeLabels: Map<string, string>;
}

function ClassTeachersTab({
  branchId,
  semester,
  schemeId,
  academicYearId,
  query,
  academicYearLabels,
  schemeLabels,
}: ClassTeachersTabProps) {
  const [assignOpen, setAssignOpen] = useState(false);
  const [editing, setEditing] = useState<ClassTeacherAssignment | null>(null);

  const assignments = query.data ?? [];

  const deleteAssignment = useDeleteClassTeacherAssignment();

  const openReplace = (assignment: ClassTeacherAssignment) => {
    setEditing(assignment);
    setAssignOpen(true);
  };

  const columns: DataTableColumn<ClassTeacherAssignment>[] = [
    {
      key: 'class',
      header: 'Class',
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-ink">Semester {row.semester}</span>
          <span className="text-caption text-muted">
            {schemeLabels.get(row.schemeId) ?? row.schemeId} ·{' '}
            {academicYearLabels.get(row.academicYearId) ?? row.academicYearId}
          </span>
        </div>
      ),
    },
    {
      key: 'teacher',
      header: 'Class teacher',
      render: (row) => (
        <div className="flex flex-col">
          <span className="text-ink">{row.teacherName}</span>
          <span className="text-caption text-muted">{row.teacherEmail}</span>
        </div>
      ),
    },
    {
      key: 'assignedAt',
      header: 'Assigned',
      render: (row) => (
        <span className="text-caption text-muted">
          {row.assignedAt ? formatDate(row.assignedAt) : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-xs">
          <button
            type="button"
            aria-label={`Replace the class teacher for semester ${row.semester}`}
            title="Replace class teacher"
            onClick={() => openReplace(row)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-strong hover:text-ink"
          >
            <UserCheck className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            aria-label={`Remove the class teacher for semester ${row.semester}`}
            title="Remove class teacher"
            onClick={() => {
              if (
                confirm(
                  `Remove ${row.teacherName} as the class teacher for semester ${row.semester}? The class will have no class teacher until one is assigned.`,
                )
              ) {
                deleteAssignment.mutate(row.id);
              }
            }}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-strong hover:text-semantic-down"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="flex flex-col gap-sm md:flex-row md:items-center md:justify-between">
        <p className="text-body-sm text-body">
          Every class — a branch, semester and scheme in one academic year —
          has exactly one class teacher. Assigning to a class that already has
          one replaces them.
        </p>
        <Button
          type="button"
          onClick={() => {
            setEditing(null);
            setAssignOpen(true);
          }}
          disabled={!branchId}
          className="w-full md:w-auto"
        >
          <Plus aria-hidden />
          Assign class teacher
        </Button>
      </div>

      {query.isError ? (
        <ErrorBanner
          message="Could not load class teacher assignments."
          retry={() => query.refetch()}
        />
      ) : null}

      <DataTable
        columns={columns}
        rows={assignments}
        keyExtractor={(row) => row.id}
        loading={query.isLoading}
        emptyState={
          branchId ? (
            <EmptyState
              variant="plain"
              title="No class teachers assigned yet"
              description="Assign a class teacher to each class so they can see that class's statistics."
              icon={<GraduationCap aria-hidden />}
              action={
                <Button
                  type="button"
                  onClick={() => {
                    setEditing(null);
                    setAssignOpen(true);
                  }}
                >
                  <Plus aria-hidden />
                  Assign class teacher
                </Button>
              }
            />
          ) : (
            <EmptyState
              variant="plain"
              title="Choose a branch to see its class teachers"
              description="Every class belongs to a branch. Pick the branch you are allocating for."
              icon={<GraduationCap aria-hidden />}
            />
          )
        }
      />

      <AssignClassTeacherSheet
        /* The key remounts the form when the class being assigned changes, so
           the semester and scheme fields start from the new class instead of
           the previous one. */
        key={editing?.id ?? `new-${semester ?? ''}-${schemeId ?? ''}`}
        open={assignOpen}
        onOpenChange={(open) => {
          setAssignOpen(open);
          if (!open) setEditing(null);
        }}
        branchId={branchId}
        semester={semester}
        schemeId={schemeId}
        academicYearId={academicYearId}
        existing={editing}
      />
    </>
  );
}

interface AssignSubjectSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  semester?: number;
  schemeId?: string;
  academicYearId: string;
}

/**
 * The "Assign teacher" form.
 *
 * A subject is picked as an offering — a subject taught in a specific branch,
 * semester and scheme — because that offering is what the teacher is
 * allocated to.
 */
function AssignSubjectSheet({
  open,
  onOpenChange,
  branchId,
  semester,
  schemeId,
  academicYearId,
}: AssignSubjectSheetProps) {
  const [teacherId, setTeacherId] = useState('');
  const [offeringId, setOfferingId] = useState('');
  const [targetAcademicYearId, setTargetAcademicYearId] = useState(academicYearId);
  const [error, setError] = useState<string | null>(null);

  const teachersQuery = useAssignableTeachers(branchId);
  const offeringsQuery = useSubjectOfferings({
    branchId: branchId || undefined,
    semester,
    schemeId,
  });
  const { data: academicYears } = useAcademicYears();
  const years = academicYears ?? [];

  const createAllocation = useCreateTeacherAllocation();

  const teachers = teachersQuery.data ?? [];
  const offerings = offeringsQuery.data ?? [];

  const reset = () => {
    setTeacherId('');
    setOfferingId('');
    setTargetAcademicYearId(academicYearId);
    setError(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleSubmit = () => {
    if (!teacherId) {
      setError('Choose the teacher who will teach this subject.');
      return;
    }
    if (!offeringId) {
      setError('Choose the subject to allocate.');
      return;
    }
    if (!targetAcademicYearId) {
      setError('Choose an academic year for this allocation.');
      return;
    }

    setError(null);
    createAllocation.mutate(
      { teacherId, subjectOfferingId: offeringId, academicYearId: targetAcademicYearId },
      {
        onSuccess: () => {
          reset();
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="dialog">
        <SheetHeader>
          <SheetTitle>Assign a teacher to a subject</SheetTitle>
          <SheetDescription>
            The teacher gets the right to enter marks for that subject, and only
            for that subject.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-base">
          {teachersQuery.isError ? (
            <ErrorBanner
              message="Could not load the teachers of this branch."
              retry={() => teachersQuery.refetch()}
            />
          ) : null}

          {offeringsQuery.isError ? (
            <ErrorBanner
              message="Could not load the subjects of this branch."
              retry={() => offeringsQuery.refetch()}
            />
          ) : null}

          <Select
            label="Teacher"
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
            placeholder="Select a teacher"
          >
            <option value="">Select a teacher</option>
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.name} · {teacher.email}
              </option>
            ))}
          </Select>

          <Select
            label="Subject"
            value={offeringId}
            onChange={(e) => setOfferingId(e.target.value)}
            placeholder="Select a subject"
          >
            <option value="">Select a subject</option>
            {offerings.map((offering) => (
              <option key={offering.id} value={offering.id}>
                {offeringLabel(offering)}
              </option>
            ))}
          </Select>

          <Select
            label="Academic year"
            value={targetAcademicYearId}
            onChange={(e) => setTargetAcademicYearId(e.target.value)}
            placeholder="Select an academic year"
          >
            <option value="">Select an academic year</option>
            {years.map((year) => (
              <option key={year.id} value={year.id}>
                {year.year}
              </option>
            ))}
          </Select>

          <p className="text-caption text-muted">
            The allocation applies to your branch and the academic year above.
          </p>

          {error ? (
            <p role="alert" className="text-body-sm text-semantic-down">
              {error}
            </p>
          ) : null}
        </div>

        <SheetFooter>
          <button
            type="button"
            onClick={() => handleOpenChange(false)}
            className="cb-btn-secondary w-full md:w-auto"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={createAllocation.isPending}
            className="cb-btn-primary w-full md:w-auto"
          >
            {createAllocation.isPending ? 'Assigning…' : 'Assign teacher'}
          </button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

interface AssignClassTeacherSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  semester?: number;
  schemeId?: string;
  academicYearId: string;
  /** The assignment being replaced, if any. */
  existing: ClassTeacherAssignment | null;
}

/**
 * The "Assign class teacher" form.
 *
 * A class is branch + semester + scheme + academic year. The class-teacher
 * assignment is unique per class on the backend, so replacing an existing
 * class teacher deletes the old assignment first and then creates the new
 * one — otherwise the create is rejected as a duplicate.
 *
 * The form is mounted with a key that changes when the target class changes,
 * so the semester and scheme fields start from the class being assigned
 * rather than from a stale previous form.
 */
function AssignClassTeacherSheet({
  open,
  onOpenChange,
  branchId,
  semester,
  schemeId,
  academicYearId,
  existing,
}: AssignClassTeacherSheetProps) {
  const initialSemester = existing
    ? String(existing.semester)
    : semester
      ? String(semester)
      : '';
  const initialScheme = existing ? existing.schemeId : (schemeId ?? '');

  const [teacherId, setTeacherId] = useState('');
  const [targetSemester, setTargetSemester] = useState(initialSemester);
  const [targetSchemeId, setTargetSchemeId] = useState(initialScheme);
  const [targetAcademicYearId, setTargetAcademicYearId] = useState(academicYearId);
  const [error, setError] = useState<string | null>(null);

  const teachersQuery = useAssignableTeachers(branchId);
  const { data: schemesData } = useSchemes();
  const { data: academicYears } = useAcademicYears();
  const schemes = schemesData ?? [];
  const years = academicYears ?? [];

  const createAssignment = useCreateClassTeacherAssignment();
  const deleteAssignment = useDeleteClassTeacherAssignment();

  const teachers = teachersQuery.data ?? [];

  const reset = () => {
    setTeacherId('');
    // The academic year follows the filters again, so a stale year never
    // carries over into the next assignment.
    setTargetAcademicYearId(academicYearId);
    setError(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleSubmit = () => {
    const sem = Number(targetSemester);
    const scheme = targetSchemeId;

    if (!teacherId) {
      setError('Choose the teacher who will be the class teacher.');
      return;
    }
    if (!sem || sem < 1) {
      setError('Choose the semester of the class.');
      return;
    }
    if (!scheme) {
      setError('Choose the scheme of the class.');
      return;
    }
    if (!branchId) {
      setError('Your branch could not be determined.');
      return;
    }
    if (!targetAcademicYearId) {
      setError('Choose the academic year of the class.');
      return;
    }

    setError(null);

    const payload = {
      teacherId,
      branchId,
      semester: sem,
      schemeId: scheme,
      academicYearId: targetAcademicYearId,
    };

    // Replacing: the class teacher is unique per class, so the old row has to
    // go before the new one can be created.
    if (!existing) {
      createAssignment.mutate(payload, {
        onSuccess: () => {
          reset();
          onOpenChange(false);
        },
      });
      return;
    }

    deleteAssignment.mutate(existing.id, {
      onSuccess: () => {
        createAssignment.mutate(payload, {
          onSuccess: () => {
            reset();
            onOpenChange(false);
          },
        });
      },
    });
  };

  const isReplace = !!existing;
  const pending = createAssignment.isPending || deleteAssignment.isPending;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="dialog">
        <SheetHeader>
          <SheetTitle>
            {isReplace ? 'Replace the class teacher' : 'Assign a class teacher'}
          </SheetTitle>
          <SheetDescription>
            Each class has exactly one class teacher. Assigning a new one
            replaces whoever holds the class today.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-base">
          {teachersQuery.isError ? (
            <ErrorBanner
              message="Could not load the teachers of this branch."
              retry={() => teachersQuery.refetch()}
            />
          ) : null}

          <Select
            label="Class teacher"
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
            placeholder="Select a teacher"
          >
            <option value="">Select a teacher</option>
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.name} · {teacher.email}
              </option>
            ))}
          </Select>

          <div className="grid grid-cols-1 gap-base md:grid-cols-2">
            <Select
              label="Semester"
              value={targetSemester}
              onChange={(e) => setTargetSemester(e.target.value)}
              placeholder="Select a semester"
            >
              <option value="">Select a semester</option>
              {SEMESTERS.map((n) => (
                <option key={n} value={String(n)}>
                  Semester {n}
                </option>
              ))}
            </Select>

            <Select
              label="Scheme"
              value={targetSchemeId}
              onChange={(e) => setTargetSchemeId(e.target.value)}
              placeholder="Select a scheme"
            >
              <option value="">Select a scheme</option>
              {schemes.map((scheme) => (
                <option key={scheme.id} value={scheme.id}>
                  {scheme.name}
                </option>
              ))}
            </Select>
          </div>

          <Select
            label="Academic year"
            value={targetAcademicYearId}
            onChange={(e) => setTargetAcademicYearId(e.target.value)}
            placeholder="Select an academic year"
          >
            <option value="">Select an academic year</option>
            {years.map((year) => (
              <option key={year.id} value={year.id}>
                {year.year}
              </option>
            ))}
          </Select>

          {existing ? (
            <p className="text-caption text-muted">
              Replacing {existing.teacherName}. The previous assignment is
              removed when the new one is saved.
            </p>
          ) : (
            <p className="text-caption text-muted">
              The class is your branch, the semester, scheme and academic year
              above.
            </p>
          )}

          {error ? (
            <p role="alert" className="text-body-sm text-semantic-down">
              {error}
            </p>
          ) : null}
        </div>

        <SheetFooter>
          <button
            type="button"
            onClick={() => handleOpenChange(false)}
            className="cb-btn-secondary w-full md:w-auto"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={pending}
            className="cb-btn-primary w-full md:w-auto"
          >
            {pending
              ? 'Saving…'
              : isReplace
                ? 'Replace class teacher'
                : 'Assign class teacher'}
          </button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/**
 * The label of a subject offering — code, name and the semester it runs in.
 *
 * The semester and scheme are optional on the offering (the split `Subject`
 * model does not carry them, only the offering does), so they are shown only
 * when they are known.
 */
function offeringLabel(offering: SubjectOfferingOption): string {
  const parts = [offering.code, offering.name];
  const context = [
    offering.semester !== undefined ? `Sem ${offering.semester}` : null,
    offering.year !== undefined ? `Year ${offering.year}` : null,
  ].filter(Boolean);
  return [...parts, ...(context.length > 0 ? [`(${context.join(' · ')})`] : [])].join(' · ');
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString();
}

