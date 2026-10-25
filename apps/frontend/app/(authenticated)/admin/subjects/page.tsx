'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Pencil, Plus, Trash2, BookOpen, SearchX, X, Layers } from 'lucide-react';

import { DataTable, type DataTableColumn } from '@/components/forms/DataTable';
import { FilterBar } from '@/components/forms/FilterBar';
import { Pagination } from '@/components/forms/Pagination';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import {
  Select as FilterSelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { Spinner } from '@/components/feedback/Spinner';
import {
  useSubjects,
  useDeleteSubject,
  useSubjectCatalogueOfferings,
} from '@/hooks/useSubjects';
import { useTablePagination } from '@/hooks/useTablePagination';
import { useBranches } from '@/hooks/useBranches';
import { useSchemes } from '@/hooks/useSchemes';
import {
  normalizeComponents,
  type Subject,
  type SubjectOffering,
} from '@/lib/services/subjects.service';

/** The two views of a subject's structure. */
const TABS = [
  { key: 'catalogue', label: 'Catalogue' },
  { key: 'offerings', label: 'Offerings by semester' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];

export default function AdminSubjectsPage() {
  const [tab, setTab] = useState<TabKey>('catalogue');
  const [search, setSearch] = useState('');
  // Radix Select cannot use an empty string as an item value, so the
  // "no filter" state is the sentinel below and is translated to
  // `undefined` before the request goes out.
  const [branchFilter, setBranchFilter] = useState('all');
  const [schemeFilter, setSchemeFilter] = useState('all');
  const [semesterFilter, setSemesterFilter] = useState('all');

  const { data: branchesData } = useBranches();
  const { data: schemesData } = useSchemes();

  const branches = branchesData ?? [];
  const schemes = schemesData ?? [];

  const { data, isLoading, isError, refetch } = useSubjects();
  const { mutate: deleteSubject } = useDeleteSubject();

  /**
   * The offerings, fetched once for the whole page.
   *
   * The catalogue filters by branch / scheme / semester, and under the split
   * model a subject carries none of those — they live on the offering. The
   * offering list is therefore what the placement filters are resolved
   * against, and it is also what the offerings tab renders. One query serves
   * both tabs.
   */
  const {
    data: offeringsData,
    isLoading: offeringsLoading,
    isError: offeringsError,
    refetch: refetchOfferings,
  } = useSubjectCatalogueOfferings();
  const offerings = offeringsData ?? [];

  const rows = data ?? [];

  /**
   * The subject ids that match the placement filters.
   *
   * `null` means no placement filter is active, so every subject qualifies.
   * A subject matches when at least one of its offerings sits in the selected
   * branch / scheme / semester — a subject offered in Semester 1 and Semester
   * 3 matches both filters.
   */
  const placementMatches = useMemo<Set<string> | null>(() => {
    const branch = branchFilter === 'all' ? undefined : branchFilter;
    const scheme = schemeFilter === 'all' ? undefined : schemeFilter;
    const semester = semesterFilter === 'all' ? undefined : Number(semesterFilter);
    if (!branch && !scheme && !semester) return null;

    const ids = new Set<string>();
    for (const offering of offerings) {
      if (branch && offering.branchId !== branch) continue;
      if (scheme && offering.schemeId !== scheme) continue;
      if (semester !== undefined && offering.semester !== semester) continue;
      ids.add(offering.subjectId);
    }
    return ids;
  }, [offerings, branchFilter, schemeFilter, semesterFilter]);

  /**
   * The catalogue is fetched once and filtered on the client.
   *
   * The list is small reference data, and the placement filters are resolved
   * through the offerings rather than sent to the server — under the split
   * model a subject row carries no branch or semester of its own, so a
   * server-side filter on `branchId` would match nothing.
   */
  const visibleSubjects = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((subject) => {
      if (term) {
        const haystack = `${subject.code} ${subject.name}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      if (placementMatches && !placementMatches.has(subject.id)) return false;
      return true;
    });
  }, [rows, search, placementMatches]);

  const hasActiveFilters =
    search.trim().length > 0 ||
    branchFilter !== 'all' ||
    schemeFilter !== 'all' ||
    semesterFilter !== 'all';

  const { page, setPage, pageSize, setPageSize, total, pageItems } = useTablePagination(
    visibleSubjects,
    { resetKey: `${search}|${branchFilter}|${schemeFilter}|${semesterFilter}` },
  );

  const clearFilters = () => {
    setSearch('');
    setBranchFilter('all');
    setSchemeFilter('all');
    setSemesterFilter('all');
  };

  const columns: DataTableColumn<Subject>[] = [
    {
      key: 'code',
      header: 'Code',
      render: (row) => <span className="num font-semibold text-ink">{row.code}</span>,
    },
    {
      key: 'name',
      header: 'Name',
      render: (row) => <span className="text-ink">{row.name}</span>,
    },
    {
      key: 'credits',
      header: 'Credits',
      render: (row) => <span className="num text-body-sm text-body">{row.credits}</span>,
    },
    {
      key: 'maxMarks',
      header: 'Max marks',
      render: (row) => <span className="num text-body-sm text-body">{row.maxMarks}</span>,
    },
    {
      key: 'passingMarks',
      header: 'Passing',
      render: (row) => (
        <span className="num text-body-sm text-body">{row.passingMarks}</span>
      ),
    },
    {
      key: 'components',
      header: 'Components',
      render: (row) => <ComponentSummary subject={row} />,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <span className="cb-badge">{row.isActive === false ? 'Inactive' : 'Active'}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-xs">
          <Link
            href={`/admin/subjects/${row.id}/edit`}
            aria-label={`Edit ${row.code}`}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-strong hover:text-ink"
          >
            <Pencil className="h-4 w-4" aria-hidden />
          </Link>
          <button
            type="button"
            aria-label={`Delete ${row.code}`}
            onClick={() => {
              if (confirm(`Delete ${row.code}?`)) deleteSubject(row.id);
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
    <section className="flex flex-col gap-6 md:gap-8">
      <PageHeader
        title="Subjects"
        description="Define the subjects the exam cell teaches — their identity, credits and the assessment breakdown a teacher fills in."
        actions={
          <>
            <Button variant="secondary" asChild className="w-full md:w-auto">
              <Link href="/admin/subjects/offerings/new">
                <Layers aria-hidden />
                Offer subject
              </Link>
            </Button>
            <Button asChild className="w-full md:w-auto">
              <Link href="/admin/subjects/new">
                <Plus aria-hidden />
                Create subject
              </Link>
            </Button>
          </>
        }
      />

      {/* Tab bar — wraps on mobile. */}
      <div
        role="tablist"
        aria-label="Subject sections"
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

      {tab === 'catalogue' ? (
        <>
          <FilterBar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search by code or name"
            hasActiveFilters={hasActiveFilters}
            onClearFilters={clearFilters}
            resultCount={`${visibleSubjects.length} ${
              visibleSubjects.length === 1 ? 'subject' : 'subjects'
            }`}
          >
            <FilterSelect
              value={branchFilter}
              onValueChange={setBranchFilter}
            >
              <SelectTrigger className="w-full md:w-40" aria-label="Filter by branch">
                <SelectValue placeholder="All branches" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All branches</SelectItem>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.code} · {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </FilterSelect>

            <FilterSelect
              value={schemeFilter}
              onValueChange={setSchemeFilter}
            >
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

            <FilterSelect
              value={semesterFilter}
              onValueChange={setSemesterFilter}
            >
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
          </FilterBar>

          {isError ? (
            <ErrorBanner message="Could not load subjects." retry={() => refetch()} />
          ) : null}

          <DataTable
            columns={columns}
            rows={pageItems}
            keyExtractor={(row) => row.id}
            loading={isLoading}
            emptyState={
                hasActiveFilters ? (
                  // Filtered-empty: the subjects exist but are hidden by the
                  // filters, so the state explains the cause and offers a
                  // reset rather than repeating the create action.
                  <EmptyState
                    variant="plain"
                    title="No subjects match your filters"
                    description="Adjust the search or filters, or clear them to see every subject."
                    icon={<SearchX aria-hidden />}
                    action={
                      <Button variant="secondary" onClick={clearFilters}>
                        <X aria-hidden />
                        Clear filters
                      </Button>
                    }
                  />
                ) : (
                  // Never-populated: there is genuinely no data, so the
                  // primary create action belongs here.
                  <EmptyState
                    variant="plain"
                    title="No subjects yet"
                    description="Create a subject to define its credits, marks and assessment breakdown."
                    icon={<BookOpen aria-hidden />}
                    action={
                      <Button asChild>
                        <Link href="/admin/subjects/new">
                          <Plus aria-hidden />
                          Create subject
                        </Link>
                      </Button>
                    }
                  />
                )
              }
              footer={
                !isLoading && total > 0 ? (
                  <Pagination
                    page={page}
                    pageSize={pageSize}
                    total={total}
                    onPageChange={setPage}
                    onPageSizeChange={setPageSize}
                  />
                ) : undefined
              }
          />
        </>
      ) : (
        <OfferingsTab
          branches={branches}
          schemes={schemes}
          subjects={rows}
          offerings={offerings}
          isLoading={offeringsLoading}
          isError={offeringsError}
          onRetryOfferings={() => refetchOfferings()}
          branchFilter={branchFilter}
          schemeFilter={schemeFilter}
          semesterFilter={semesterFilter}
          onBranchChange={setBranchFilter}
          onSchemeChange={setSchemeFilter}
          onSemesterChange={setSemesterFilter}
        />
      )}
    </section>
  );
}

/**
 * The component summary — "CA1 20 · CA2 20 · MID_SEM 30 · WRITTEN 75".
 *
 * A long breakdown is truncated with a `+N more` marker rather than allowed
 * to push the table wider, so the row height stays stable across subjects
 * with different numbers of components.
 */
function ComponentSummary({ subject }: { subject: Subject }) {
  const components = normalizeComponents(subject.components);
  if (components.length === 0) {
    return <span className="text-body-sm text-muted">Single total</span>;
  }
  const shown = components.slice(0, 3);
  const rest = components.length - shown.length;
  return (
    <span className="text-body-sm text-body">
      {shown.map((component, index) => (
        <span key={`${component.type}-${component.maxMarks}-${index}`}>
          <span className="num">
            {component.type} {component.maxMarks}
          </span>
          {index < shown.length - 1 ? ' · ' : ''}
        </span>
      ))}
      {rest > 0 ? <span className="text-muted"> +{rest} more</span> : null}
    </span>
  );
}

/**
 * The offerings tab — the semester structure of the college.
 *
 * This is where the product's spine becomes visible: for the selected branch
 * and scheme, each semester shows the subjects offered in it. A subject that
 * is in the catalogue but offered in no semester is listed too — it is a
 * template nobody has scheduled yet, and hiding it would make the catalogue
 * look complete when it is not.
 */
function OfferingsTab({
  branches,
  schemes,
  subjects,
  offerings,
  isLoading,
  isError,
  onRetryOfferings,
  branchFilter,
  schemeFilter,
  semesterFilter,
  onBranchChange,
  onSchemeChange,
  onSemesterChange,
}: {
  branches: Array<{ id: string; code: string; name: string }>;
  schemes: Array<{ id: string; name: string }>;
  subjects: Subject[];
  offerings: SubjectOffering[];
  isLoading: boolean;
  isError: boolean;
  onRetryOfferings: () => void;
  branchFilter: string;
  schemeFilter: string;
  semesterFilter: string;
  onBranchChange: (value: string) => void;
  onSchemeChange: (value: string) => void;
  onSemesterChange: (value: string) => void;
}) {
  const hasActiveFilters =
    branchFilter !== 'all' || schemeFilter !== 'all' || semesterFilter !== 'all';

  const clearFilters = () => {
    onBranchChange('all');
    onSchemeChange('all');
    onSemesterChange('all');
  };

  return (
    <>
      <FilterBar
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
        resultCount={
          offerings
            ? `${offerings.length} ${
                offerings.length === 1 ? 'offering' : 'offerings'
              }`
            : undefined
        }
      >
        <FilterSelect value={branchFilter} onValueChange={onBranchChange}>
          <SelectTrigger className="w-full md:w-40" aria-label="Filter by branch">
            <SelectValue placeholder="All branches" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All branches</SelectItem>
            {branches.map((branch) => (
              <SelectItem key={branch.id} value={branch.id}>
                {branch.code} · {branch.name}
              </SelectItem>
            ))}
          </SelectContent>
        </FilterSelect>

        <FilterSelect value={schemeFilter} onValueChange={onSchemeChange}>
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

        <FilterSelect value={semesterFilter} onValueChange={onSemesterChange}>
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
      </FilterBar>

      {isError ? (
        <ErrorBanner message="Could not load subject offerings." retry={onRetryOfferings} />
      ) : null}

      {isLoading ? (
        <div className="flex items-center gap-sm text-body-sm text-body">
          <Spinner size={16} /> Loading offerings…
        </div>
      ) : (
        <SemesterGrid
          offerings={offerings}
          subjects={subjects}
          branches={branches}
          schemes={schemes}
          branchFilter={branchFilter}
          schemeFilter={schemeFilter}
          semesterFilter={semesterFilter}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={clearFilters}
        />
      )}
    </>
  );
}

/**
 * The semester grid.
 *
 * Each semester is a card listing the subjects offered in it, so the
 * structure reads top-to-bottom the way a syllabus does. On mobile the
 * semesters stack in one column; from the tablet breakpoint up they form a
 * two-column grid, and on a wide desktop a three-column grid.
 */
function SemesterGrid({
  offerings,
  subjects,
  branches,
  schemes,
  branchFilter,
  schemeFilter,
  semesterFilter,
  hasActiveFilters,
  onClearFilters,
}: {
  offerings: SubjectOffering[];
  subjects: Subject[];
  branches: Array<{ id: string; code: string; name: string }>;
  schemes: Array<{ id: string; name: string }>;
  branchFilter: string;
  schemeFilter: string;
  semesterFilter: string;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}) {
  const subjectById = useMemo(() => {
    const map = new Map<string, Subject>();
    for (const subject of subjects) map.set(subject.id, subject);
    return map;
  }, [subjects]);

  /**
   * Groups the offerings by semester.
   *
   * The offering may carry a joined `subject` (the new split) or only a
   * `subjectId` (the pre-split shape) — both are resolved against the
   * catalogue so the card always shows a code and a name.
   *
   * The placement filters are applied here rather than on the request, so
   * the page holds one offering query that serves both the catalogue's
   * placement filter and this grid.
   */
  const bySemester = useMemo(() => {
    const groups = new Map<number, Array<{ code: string; name: string }>>();
    for (const offering of offerings) {
      if (branchFilter !== 'all' && offering.branchId !== branchFilter) continue;
      if (schemeFilter !== 'all' && offering.schemeId !== schemeFilter) continue;
      const joined = offering.subject;
      const fallback = subjectById.get(offering.subjectId);
      const code = joined?.code ?? fallback?.code;
      const name = joined?.name ?? fallback?.name;
      if (!code || !name) continue;
      const list = groups.get(offering.semester) ?? [];
      list.push({ code, name });
      groups.set(offering.semester, list);
    }
    return groups;
  }, [offerings, subjectById, branchFilter, schemeFilter]);

  const semesters = SEMESTERS.filter(
    (n) => semesterFilter === 'all' || String(n) === semesterFilter,
  );

  const anyContent = Array.from(bySemester.values()).some((list) => list.length > 0);

  if (!anyContent) {
    return (
      <EmptyState
        variant="plain"
        title={
          hasActiveFilters
            ? 'No subject offerings match your filters'
            : 'No subject offerings yet'
        }
        description={
          hasActiveFilters
            ? 'Adjust the filters, or clear them to see every offering.'
            : 'Offer a subject to a branch and semester to build the class structure.'
        }
        icon={<Layers aria-hidden />}
        action={
          hasActiveFilters ? (
            <Button variant="secondary" onClick={onClearFilters}>
              <X aria-hidden />
              Clear filters
            </Button>
          ) : null
        }
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-base md:grid-cols-2 lg:grid-cols-3">
      {semesters.map((semester) => {
        const list = bySemester.get(semester) ?? [];
        return (
          <article
            key={semester}
            className="cb-surface-card flex flex-col gap-sm"
            aria-labelledby={`semester-${semester}`}
          >
            <header className="flex items-center justify-between gap-sm border-b border-hairline pb-sm">
              <h3
                id={`semester-${semester}`}
                className="font-display text-title-md text-ink"
              >
                Semester {semester}
              </h3>
              <span className="cb-badge">
                {list.length} {list.length === 1 ? 'subject' : 'subjects'}
              </span>
            </header>

            {list.length === 0 ? (
              <p className="text-body-sm text-muted">No subjects offered.</p>
            ) : (
              <ul className="flex flex-col gap-xs">
                {list.map((entry, index) => (
                  <li
                    key={`${entry.code}-${index}`}
                    className="flex items-baseline gap-sm text-body-sm"
                  >
                    <span className="num font-semibold text-ink">{entry.code}</span>
                    <span className="min-w-0 truncate text-body">{entry.name}</span>
                  </li>
                ))}
              </ul>
            )}

            {/*
              The scope the semester is shown under. It is only meaningful
              when a single branch or scheme is selected — otherwise the
              list spans several, and the scope line would be misleading.
            */}
            {branchFilter !== 'all' || schemeFilter !== 'all' ? (
              <p className="mt-auto border-t border-hairline pt-sm text-caption text-muted">
                {branchFilter !== 'all'
                  ? branchName(branches, branchFilter)
                  : 'All branches'}
                {' · '}
                {schemeFilter !== 'all'
                  ? schemeName(schemes, schemeFilter)
                  : 'All schemes'}
              </p>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

function branchName(
  branches: Array<{ id: string; code: string; name: string }>,
  id: string,
): string {
  const b = branches.find((branch) => branch.id === id);
  return b ? `${b.code} · ${b.name}` : '—';
}

function schemeName(
  schemes: Array<{ id: string; name: string }>,
  id: string,
): string {
  const scheme = schemes.find((s) => s.id === id);
  return scheme ? scheme.name : '—';
}
