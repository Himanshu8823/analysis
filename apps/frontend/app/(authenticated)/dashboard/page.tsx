'use client';

import Link from 'next/link';
import {
  Users,
  Percent,
  BookOpen,
  TrendingUp,
  FileSpreadsheet,
  Upload,
  ArrowRight,
} from 'lucide-react';

import { useDashboard } from '@/hooks/useDashboard';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/PageHeader';
import { formatters } from '@/lib/utils/formatters';
import { cn } from '@/lib/utils';

interface Kpi {
  label: string;
  value: string;
  helper: string;
  icon: typeof Users;
  accent: string;
}

export default function DashboardPage() {
  const { data, isLoading, isError, refetch } = useDashboard();

  if (isLoading) {
    return <DashboardSkeleton />;
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
      label: 'Total students',
      value: String(data?.kpis.totalStudents ?? 0),
      helper: 'Enrolled this academic year',
      icon: Users,
      accent: 'text-primary',
    },
    {
      label: 'Pass rate',
      value: formatters.percentage(data?.kpis.passPercentage ?? 0, 1),
      helper: 'Across all branches',
      icon: Percent,
      accent: 'text-semantic-up',
    },
    {
      label: 'Subjects',
      value: String(data?.kpis.totalSubjects ?? 0),
      helper: 'Active in the current scheme',
      icon: BookOpen,
      accent: 'text-accent-yellow',
    },
    {
      label: 'Average score',
      value: formatters.percentage(data?.kpis.averagePercentage ?? 0, 1),
      helper: 'Class average across subjects',
      icon: TrendingUp,
      accent: 'text-primary',
    },
  ];

  const uploads = data?.recentUploads ?? [];

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      {/* Page intro */}
      <PageHeader
        title="Overview"
        description={
          data?.academicYear?.year
            ? `Result analysis activity for the ${data.academicYear.year} academic year.`
            : 'Result analysis activity across branches and schemes.'
        }
        actions={
          <Button asChild className="w-full md:w-auto">
            <Link href="/upload">
              <Upload aria-hidden />
              Upload results
            </Link>
          </Button>
        }
      />

      {/* KPI row */}
      <section
        aria-label="Key performance indicators"
        className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4"
      >
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <article
              key={kpi.label}
              className="flex flex-col gap-4 rounded-xl border border-hairline bg-card p-6 transition-colors hover:bg-surface-soft"
              aria-label={`${kpi.label}: ${kpi.value}`}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="text-caption-strong uppercase tracking-wide text-muted">
                  {kpi.label}
                </span>
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-strong">
                  <Icon className={cn('size-4', kpi.accent)} aria-hidden />
                </span>
              </div>
              <p className="num font-display text-display-sm text-ink">{kpi.value}</p>
              <p className="text-caption text-muted">{kpi.helper}</p>
            </article>
          );
        })}
      </section>

      {/* Recent uploads */}
      <section
        aria-labelledby="recent-uploads-title"
        className="overflow-hidden rounded-xl border border-hairline bg-card"
      >
        <header className="flex items-center justify-between gap-4 border-b border-hairline px-6 py-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-strong">
              <FileSpreadsheet className="size-4 text-primary" aria-hidden />
            </span>
            <div className="min-w-0">
              <h3
                id="recent-uploads-title"
                className="font-display text-title-md text-ink"
              >
                Recent uploads
              </h3>
              <p className="text-caption text-muted">
                The latest result files processed by the system
              </p>
            </div>
          </div>
          {uploads.length > 0 ? (
            <Button asChild variant="ghost" size="sm" className="shrink-0">
              <Link href="/upload">
                View all
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          ) : null}
        </header>

        {uploads.length > 0 ? (
          <>
            {/* Table on tablet and up; stacked rows on mobile. */}
            <table className="hidden w-full text-left md:table">
              <thead>
                <tr className="border-b border-hairline bg-surface-soft">
                  <th scope="col" className="px-6 py-3 text-caption-strong uppercase tracking-wide text-muted">
                    File
                  </th>
                  <th scope="col" className="px-6 py-3 text-caption-strong uppercase tracking-wide text-muted">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-caption-strong uppercase tracking-wide text-muted">
                    Uploaded
                  </th>
                </tr>
              </thead>
              <tbody>
                {uploads.map((upload) => (
                  <tr
                    key={upload.id}
                    className="border-b border-hairline last:border-b-0 transition-colors hover:bg-surface-soft"
                  >
                    <td className="px-6 py-4">
                      <span className="block max-w-md truncate text-body-sm font-semibold text-ink">
                        {upload.fileName}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <UploadStatusBadge status={upload.status} />
                    </td>
                    <td className="num whitespace-nowrap px-6 py-4 text-right text-body-sm text-muted">
                      {formatters.date(upload.createdAt, 'long')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <ul className="divide-y divide-hairline md:hidden">
              {uploads.map((upload) => (
                <li key={upload.id} className="flex flex-col gap-2 px-6 py-4">
                  <p className="truncate text-body-sm font-semibold text-ink">
                    {upload.fileName}
                  </p>
                  <div className="flex items-center justify-between gap-3">
                    <UploadStatusBadge status={upload.status} />
                    <span className="num whitespace-nowrap text-caption text-muted">
                      {formatters.date(upload.createdAt, 'long')}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div className="p-6">
            <EmptyState
              title="No uploads yet"
              description="Upload your first Excel or PDF result file to populate the dashboard."
              icon={<FileSpreadsheet className="size-6" aria-hidden />}
              action={
                <Button asChild>
                  <Link href="/upload">
                    <Upload aria-hidden />
                    Upload results
                  </Link>
                </Button>
              }
            />
          </div>
        )}
      </section>
    </div>
  );
}

/**
 * Status pill for an upload.
 *
 * Colour comes from the design system's semantic tokens only — green for a
 * completed parse, red for a failure, yellow for work still in flight.
 */
function UploadStatusBadge({ status }: { status: string }) {
  const normalized = status.toUpperCase();
  const tone =
    normalized === 'COMPLETED' || normalized === 'SUCCESS'
      ? 'bg-semantic-up'
      : normalized === 'FAILED' || normalized === 'ERROR'
        ? 'bg-semantic-down'
        : 'bg-accent-yellow';

  return (
    <span className="inline-flex items-center gap-2">
      <span className={cn('size-2 shrink-0 rounded-full', tone)} aria-hidden />
      <span className="text-body-sm capitalize text-body">{normalized.toLowerCase()}</span>
    </span>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6 md:gap-8" aria-busy>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-40 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}
