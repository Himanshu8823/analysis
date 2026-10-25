'use client';

import { useState } from 'react';
import { Users, Percent, TrendingUp, Award } from 'lucide-react';
import { Select } from '@/components/forms/Select';
import { PageHeader } from '@/components/layout/PageHeader';
import { Spinner } from '@/components/feedback/Spinner';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import {
  BarChart,
  LineChart,
  PieChart,
} from '@/components/charts';
import {
  useOverview,
  usePassFail,
  useSubjectDifficulty,
  usePerformanceTrends,
} from '@/hooks/useAnalytics';
import { useBranches } from '@/hooks/useBranches';
import { useSchemes } from '@/hooks/useSchemes';
import { formatters } from '@/lib/utils/formatters';
import type { AnalyticsFilters } from '@/lib/services/analytics.service';

export default function AnalyticsPage() {
  const [branchId, setBranchId] = useState('');
  const [schemeId, setSchemeId] = useState('');
  const [semester, setSemester] = useState(1);

  const { data: branchesData } = useBranches();
  const { data: schemesData } = useSchemes();

  /**
   * The filters are an *override*, not a precondition.
   *
   * The server resolves the caller's branch scope on its own
   * (`ScopeService.resolveBranchFilter`): a college-scoped member such as
   * the Principal or the Super Admin gets every branch, and a branch-scoped
   * member such as the HOD gets their own branch — whether or not a
   * `branchId` is sent. Leaving the filters empty therefore shows the
   * caller exactly the cohort they are entitled to see, with no manual
   * selection step.
   *
   * The same goes for the scheme and the semester: omitting them widens the
   * cohort rather than blocking the screen, because §5 asks for the charts
   * to be there on arrival.
   */
  const filters: AnalyticsFilters = {
    branchId: branchId || undefined,
    schemeId: schemeId || undefined,
    semester,
  };

  const overview = useOverview(filters);
  const passFail = usePassFail(filters);
  const subjectDifficulty = useSubjectDifficulty(filters);
  const performanceTrends = usePerformanceTrends(filters);

  const branches = branchesData ?? [];
  const schemes = schemesData ?? [];

  const kpiCards = [
    {
      label: 'Total students',
      value: String(overview.data?.totalStudents ?? 0),
      icon: Users,
      tone: 'text-primary',
    },
    {
      label: 'Pass percentage',
      value: formatters.percentage(overview.data?.overallPassPercentage ?? 0, 1),
      icon: Percent,
      tone: 'text-semantic-up',
    },
    {
      label: 'Average percentage',
      value: formatters.percentage(overview.data?.averagePercentage ?? 0, 1),
      icon: TrendingUp,
      tone: 'text-accent-yellow',
    },
    {
      label: 'Subjects',
      value: String(overview.data?.totalSubjects ?? 0),
      icon: Award,
      tone: 'text-primary',
    },
  ];

  const isLoadingAny =
    overview.isLoading ||
    passFail.isLoading ||
    subjectDifficulty.isLoading ||
    performanceTrends.isLoading;

  return (
    <section className="flex flex-col gap-6 md:gap-8">
      <PageHeader
        title="Analytics"
        description="Cohort-wide metrics and charts for the scope you are entitled to see. Narrow them with the filters below if you want a specific cohort."
      />

      <article className="cb-surface-card" aria-label="Filters">
        <div className="grid grid-cols-1 gap-base md:grid-cols-3">
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
        </div>
      </article>

      {isLoadingAny ? (
        <div className="flex items-center gap-sm text-body-sm text-body">
          <Spinner size={16} /> Loading analytics…
        </div>
      ) : (
        <div className="space-y-lg">
          {overview.isError ? (
            <ErrorBanner
              message="Could not load overview stats."
              retry={() => overview.refetch()}
            />
          ) : null}

          <div className="grid grid-cols-1 gap-sm md:grid-cols-2 lg:grid-cols-4">
            {kpiCards.map((kpi) => {
              const Icon = kpi.icon;
              return (
                <article
                  key={kpi.label}
                  className="cb-surface-card flex flex-col gap-sm"
                  aria-label={`${kpi.label}: ${kpi.value}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-caption uppercase tracking-wide text-muted">
                      {kpi.label}
                    </span>
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-surface-strong">
                      <Icon className={`h-5 w-5 ${kpi.tone}`} aria-hidden />
                    </span>
                  </div>
                  <p className="num font-display text-display-sm text-ink">{kpi.value}</p>
                </article>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-lg lg:grid-cols-2">
            <article className="cb-surface-card" aria-labelledby="pass-fail-title">
              <header className="mb-base">
                <h3 id="pass-fail-title" className="font-display text-title-md text-ink">
                  Pass / Fail distribution
                </h3>
              </header>
              {passFail.data && passFail.data.totalStudents > 0 ? (
                <PieChart
                  data={[
                    { name: 'Distinction', value: passFail.data.distinction },
                    { name: 'First class', value: passFail.data.firstClass },
                    { name: 'Second class', value: passFail.data.secondClass },
                    { name: 'ATKT', value: passFail.data.atktCount },
                    { name: 'Fail', value: passFail.data.failCount },
                  ].filter((bucket) => bucket.value > 0)}
                  ariaLabel="Pass and fail distribution pie chart"
                />
              ) : (
                <p className="text-body-sm text-muted">No pass/fail data yet.</p>
              )}
            </article>

            <article className="cb-surface-card" aria-labelledby="subject-diff-title">
              <header className="mb-base">
                <h3 id="subject-diff-title" className="font-display text-title-md text-ink">
                  Subject difficulty (avg %)
                </h3>
              </header>
              {subjectDifficulty.data && subjectDifficulty.data.length > 0 ? (
                <BarChart
                  data={subjectDifficulty.data.map((s) => ({
                    name: s.subjectCode,
                    value: s.averagePercentage,
                  }))}
                  xKey="name"
                  yKey="value"
                  ariaLabel="Subject difficulty bar chart"
                />
              ) : (
                <p className="text-body-sm text-muted">No subject data yet.</p>
              )}
            </article>

            <article
              className="cb-surface-card lg:col-span-2"
              aria-labelledby="trends-title"
            >
              <header className="mb-base">
                <h3 id="trends-title" className="font-display text-title-md text-ink">
                  Performance trends
                </h3>
              </header>
              {performanceTrends.data && performanceTrends.data.length > 0 ? (
                <LineChart
                  data={performanceTrends.data.map((t) => ({
                    year: t.year,
                    averagePercentage: t.averagePercentage,
                    passPercentage: t.passPercentage,
                  }))}
                  xKey="year"
                  series={[
                    { key: 'averagePercentage', label: 'Average %' },
                    { key: 'passPercentage', label: 'Pass %' },
                  ]}
                  ariaLabel="Performance trends line chart"
                />
              ) : (
                <p className="text-body-sm text-muted">No historical trends yet.</p>
              )}
            </article>
          </div>
        </div>
      )}
    </section>
  );
}