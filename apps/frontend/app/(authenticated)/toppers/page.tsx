'use client';

import { useState } from 'react';
import { Award, Trophy } from 'lucide-react';
import { Select } from '@/components/forms/Select';
import { Pagination } from '@/components/forms/Pagination';
import { TableSkeleton } from '@/components/forms/TableSkeleton';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';

import { useSubjectToppers, useClassToppers } from '@/hooks/useToppers';
import { useTablePagination } from '@/hooks/useTablePagination';
import { useBranches } from '@/hooks/useBranches';
import { useSchemes } from '@/hooks/useSchemes';
import { formatters } from '@/lib/utils/formatters';
import type {
  ClassTopperByRule,
  ClassTopper,
  ClassTopperFilters,
  RankingRule,
} from '@/lib/services/toppers.service';

type Tab = 'subject' | 'class';

export default function ToppersPage() {
  const [tab, setTab] = useState<Tab>('subject');
  const [branchId, setBranchId] = useState('');
  const [schemeId, setSchemeId] = useState('');
  const [semester, setSemester] = useState(1);
  const [rankingRule, setRankingRule] = useState<RankingRule>('percentage');

  const { data: branchesData } = useBranches();
  const { data: schemesData } = useSchemes();

  /**
   * The filters narrow the cohort; they never decide whether the screen
   * works. The server applies the caller's branch scope on its own
   * (`ScopeService.resolveBranchFilter`), so an empty branch means "every
   * branch I am allowed to see" and an empty scheme means "every scheme".
   * The charts are therefore there on arrival, without a selection step.
   */
  const filters: ClassTopperFilters = {
    branchId: branchId || undefined,
    schemeId: schemeId || undefined,
    semester,
  };

  const subjectQuery = useSubjectToppers(filters, tab === 'subject');
  const classQuery = useClassToppers({ ...filters, rankingRule }, tab === 'class');

  const branches = branchesData ?? [];
  const schemes = schemesData ?? [];

  const activeQuery = tab === 'subject' ? subjectQuery : classQuery;

  return (
    <section className="flex flex-col gap-6 md:gap-8">
      <PageHeader
        title="Toppers"
        description="The highest achievers per subject and across the class, for the scope you are entitled to see."
      />

      <article className="cb-surface-card" aria-label="Filters">
        <div className="grid grid-cols-1 gap-base md:grid-cols-2 lg:grid-cols-4">
          <Select
            label="Branch (optional)"
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
            label="Scheme (optional)"
            value={schemeId}
            onChange={(e) => setSchemeId(e.target.value)}
          >
            <option value="">All schemes</option>
            {schemes.map((scheme) => (
              <option key={scheme.id} value={scheme.id}>
                {scheme.name}
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
          <Select
            label="Ranking rule"
            value={rankingRule}
            onChange={(e) => setRankingRule(e.target.value as RankingRule)}
          >
            <option value="percentage">Percentage</option>
            <option value="marks">Total marks</option>
            <option value="credits">Credits earned</option>
          </Select>
        </div>
      </article>

      <div
        role="tablist"
        aria-label="Topper type"
        className="flex w-full gap-xs rounded-full bg-surface-strong p-xs md:w-auto md:self-start"
      >
        <TabButton active={tab === 'subject'} onClick={() => setTab('subject')}>
          <Award className="mr-1 h-4 w-4" aria-hidden /> Subject toppers
        </TabButton>
        <TabButton active={tab === 'class'} onClick={() => setTab('class')}>
          <Trophy className="mr-1 h-4 w-4" aria-hidden /> Class toppers
        </TabButton>
      </div>

      {activeQuery.isError ? (
        <ErrorBanner
          message="Could not load toppers."
          retry={() => activeQuery.refetch()}
        />
      ) : activeQuery.isLoading ? (
        <TableSkeleton columns={tab === 'class' ? 6 : 4} rows={6} />
      ) : tab === 'subject' ? (
        <SubjectToppersList data={subjectQuery.data ?? []} />
      ) : (
        <ClassToppersList data={classQuery.data} />
      )}
    </section>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex h-11 flex-1 items-center justify-center rounded-full px-md text-body-sm transition-colors md:flex-none ${
        active
          ? 'bg-canvas text-ink shadow-coinbase'
          : 'text-body hover:bg-surface-soft'
      }`}
    >
      {children}
    </button>
  );
}

function SubjectToppersList({
  data,
}: {
  data: Array<{
    subjectId: string;
    subjectCode: string;
    subjectName: string;
    topperMarks: number;
    maxMarks: number;
    toppers: Array<{
      studentId: string;
      rollNo: string;
      name: string;
      score: number;
      percentage: number;
      rank: number;
      isTie: boolean;
    }>;
  }>;
}) {
  if (data.length === 0) {
    return <EmptyState title="No subject toppers found" description="Try a different filter." />;
  }

  return (
    <div className="grid grid-cols-1 gap-base md:grid-cols-2 lg:grid-cols-3">
      {data.map((subject) => (
        <article
          key={subject.subjectId}
          className="cb-surface-card flex flex-col gap-base"
          aria-labelledby={`subject-${subject.subjectId}`}
        >
          <header className="flex items-start justify-between gap-sm">
            <div>
              <p className="text-caption text-muted">{subject.subjectCode}</p>
              <h3
                id={`subject-${subject.subjectId}`}
                className="font-display text-title-md text-ink"
              >
                {subject.subjectName}
              </h3>
            </div>
            <Award className="h-5 w-5 text-accent-yellow" aria-hidden />
          </header>

          <ul className="divide-y divide-hairline">
            {subject.toppers.map((t) => (
              <li
                key={t.studentId}
                className="flex items-center justify-between gap-sm py-sm"
              >
                <div className="flex items-center gap-sm">
                  <span className="num inline-flex h-8 w-8 items-center justify-center rounded-full bg-surface-strong text-body-sm font-semibold text-ink">
                    {t.rank}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-body-sm font-semibold text-ink">{t.name}</p>
                    <p className="text-caption text-muted">
                      <span className="num">{t.rollNo}</span>
                      {t.isTie ? ' · tied' : ''}
                    </p>
                  </div>
                </div>
                <span className="num text-body-sm text-ink">
                  {formatters.marks(t.score, subject.maxMarks)} ·{' '}
                  {formatters.percentage(t.percentage, 1)}
                </span>
              </li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}

/**
 * The class leaderboard comes back in one of two shapes: the plain ranking
 * (no explicit rule) or the rule-based result that also carries the rule name
 * and the student count. Both are rendered with the same columns.
 */
function ClassToppersList({
  data,
}: {
  data: ClassTopperByRule | ClassTopper | undefined;
}) {
  const rows =
    data && 'ranking' in data
      ? data.ranking.map((entry) => ({
          studentId: entry.studentId,
          rollNo: entry.rollNo,
          name: entry.name,
          rank: entry.rank,
          totalMarks:
            'totalMarks' in entry ? entry.totalMarks : entry.score,
          totalMaxMarks:
            'maxTotalMarks' in entry ? entry.maxTotalMarks : undefined,
          percentage: entry.percentage,
          isTie: 'isTie' in entry ? entry.isTie : false,
        }))
      : [];

  const { page, setPage, pageSize, setPageSize, total, pageItems } = useTablePagination(rows, {
    resetKey: data,
  });

  if (rows.length === 0) {
    return <EmptyState title="No class toppers found" description="Try a different filter." />;
  }

  return (
    <div className="cb-surface-card overflow-hidden rounded-md">
      <div className="overflow-x-auto">
        <table className="w-full text-body-sm">
          <thead className="bg-surface-soft">
            <tr>
              <th className="px-base py-sm text-left font-semibold text-muted">Rank</th>
              <th className="px-base py-sm text-left font-semibold text-muted">Roll</th>
              <th className="px-base py-sm text-left font-semibold text-muted">Name</th>
              <th className="px-base py-sm text-right font-semibold text-muted">Total</th>
              <th className="px-base py-sm text-right font-semibold text-muted">Percentage</th>
              <th className="px-base py-sm text-left font-semibold text-muted">Note</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((t) => (
              <tr key={t.studentId} className="border-t border-hairline first:border-t-0">
                <td className="num px-base py-sm text-ink">{t.rank}</td>
                <td className="num px-base py-sm text-ink">{t.rollNo}</td>
                <td className="px-base py-sm text-ink">{t.name}</td>
                <td className="num px-base py-sm text-right text-ink">
                  {t.totalMaxMarks !== undefined
                    ? formatters.marks(t.totalMarks, t.totalMaxMarks)
                    : t.totalMarks}
                </td>
                <td className="num px-base py-sm text-right text-ink">
                  {formatters.percentage(t.percentage, 2)}
                </td>
                <td className="px-base py-sm text-body-sm text-body">
                  {t.isTie ? 'Tied' : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {total > 0 ? (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          className="border-t border-hairline px-4 py-sm"
        />
      ) : null}
    </div>
  );
}
