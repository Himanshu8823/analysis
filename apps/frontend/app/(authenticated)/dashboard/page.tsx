'use client';

import { Users, Percent, BookOpen, TrendingUp, FileSpreadsheet } from 'lucide-react';
import { useDashboard } from '@/hooks/useDashboard';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { EmptyState } from '@/components/feedback/EmptyState';
import { formatters } from '@/lib/utils/formatters';

interface Kpi {
  label: string;
  value: string;
  helper?: string;
  icon: typeof Users;
  accent: string;
}

export default function DashboardPage() {
  const { data, isLoading, isError, refetch } = useDashboard();

  if (isLoading) {
    return (
      <section aria-busy>
        <div className="grid grid-cols-1 gap-sm md:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-lg bg-surface-soft" />
          ))}
        </div>
      </section>
    );
  }

  if (isError) {
    return (
      <ErrorBanner
        message="We could not load your dashboard. Please try again."
        retry={() => refetch()}
      />
    );
  }

  const kpis: Kpi[] = [
    {
      label: 'Total Students',
      value: formatters.percentage(data?.kpis.totalStudents ?? 0, 0).replace('%', ''),
      helper: 'Enrolled this term',
      icon: Users,
      accent: 'text-primary',
    },
    {
      label: 'Pass %',
      value: formatters.percentage(data?.kpis.passPercentage ?? 0, 1),
      helper: 'Across all branches',
      icon: Percent,
      accent: 'text-semantic-up',
    },
    {
      label: 'Subjects',
      value: String(data?.kpis.totalSubjects ?? 0),
      helper: 'Active in scheme',
      icon: BookOpen,
      accent: 'text-accent-yellow',
    },
    {
      label: 'Avg %',
      value: formatters.percentage(data?.kpis.averagePercentage ?? 0, 1),
      helper: 'Class average',
      icon: TrendingUp,
      accent: 'text-semantic-up',
    },
  ];

  return (
    <section className="space-y-xl">
      <header className="flex flex-col gap-xs">
        <span className="cb-badge">Dashboard</span>
        <h1 className="font-display text-title-lg text-ink">Overview</h1>
        <p className="text-body-sm text-body">
          Real-time view of result analysis activity across branches and schemes.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-sm md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => {
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
                  <Icon className={`h-5 w-5 ${kpi.accent}`} aria-hidden />
                </span>
              </div>
              <p className="num font-display text-display-sm text-ink">{kpi.value}</p>
              {kpi.helper ? (
                <p className="text-body-sm text-muted">{kpi.helper}</p>
              ) : null}
            </article>
          );
        })}
      </div>

      <section className="cb-surface-card" aria-labelledby="recent-uploads-title">
        <header className="mb-base flex items-center justify-between">
          <div className="flex items-center gap-sm">
            <FileSpreadsheet className="h-5 w-5 text-primary" aria-hidden />
            <h2 id="recent-uploads-title" className="font-display text-title-md text-ink">
              Recent uploads
            </h2>
          </div>
        </header>

        {data?.recentUploads && data.recentUploads.length > 0 ? (
          <ul className="divide-y divide-hairline">
            {data.recentUploads.map((upload) => (
              <li
                key={upload.id}
                className="flex items-center justify-between gap-sm py-sm"
              >
                <div className="min-w-0">
                  <p className="truncate text-body-sm font-semibold text-ink">{upload.fileName}</p>
                  <p className="text-caption text-muted">
                    {formatters.date(upload.createdAt, 'long')}
                  </p>
                </div>
                <span className="cb-badge">{upload.status}</span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No uploads yet"
            description="Upload your first Excel or PDF result file from the Upload Results page."
          />
        )}
      </section>
    </section>
  );
}