'use client';

import Link from 'next/link';
import {
  Users,
  Percent,
  BookOpen,
  TrendingUp,
  FileSpreadsheet,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Info,
} from 'lucide-react';

import {
  useDashboardHeader,
  useDashboardMetrics,
  useDashboardSections,
  useDashboardRecentUploads,
} from '@/hooks/useDashboard';
import { useCurrentUser } from '@/hooks/useAuth';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/PageHeader';
import { DashboardSectionCard } from '@/components/charts/DashboardSectionCard';
import { formatters } from '@/lib/utils/formatters';
import { cn } from '@/lib/utils';
import type { DashboardMetric } from '@/lib/services/dashboard.service';

/**
 * The dashboard renders four independent blocks: the scope header, the KPI
 * row, the chart sections and the upload feed.
 *
 * Each block has its own query and its own skeleton. That is deliberate: the
 * page used to wait for one composite request, so a slow chart query held the
 * entire page behind a single skeleton. Now the chrome paints immediately and
 * every block fills in as soon as its own data arrives — a slow block never
 * blocks a fast one.
 */
export default function DashboardPage() {
  const header = useDashboardHeader();
  const metrics = useDashboardMetrics();
  const sections = useDashboardSections();
  const uploads = useDashboardRecentUploads();
  const { data: user } = useCurrentUser();

  const scope = header.data?.scope;
  const isStudent = scope === 'own';
  /**
   * The upload feed belongs to the people who work with uploads (§5). The
   * Super Admin supervises the college and uploads nothing (§3.2), so the
   * section is not rendered for them at all — not even empty.
   */
  const canSeeUploads = (user?.permissions ?? []).includes('upload:read');

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <PageHeader title="Overview" />

      {header.isError ? (
        <ErrorBanner
          message="We could not load your dashboard scope. Please try again."
          retry={() => header.refetch()}
        />
      ) : null}

      {/* Degraded data sources */}
      {sections.data?.degraded && sections.data.degraded.length > 0 ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-hairline bg-surface-soft p-4 text-body-sm text-body"
        >
          <Info className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
          <p>
            Some figures could not be computed and are omitted:{' '}
            <span className="font-semibold">{sections.data.degraded.join(', ')}</span>.
          </p>
        </div>
      ) : null}

      {/* Metric row */}
      <section
        aria-label="Key performance indicators"
        aria-busy={metrics.isPending}
        className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4"
      >
        {metrics.isPending ? (
          <MetricSkeletons />
        ) : metrics.isError ? (
          <div className="md:col-span-2 lg:col-span-4">
            <ErrorBanner
              message="We could not load your key figures."
              retry={() => metrics.refetch()}
            />
          </div>
        ) : (
          metrics.data.metrics.map((metric) => <MetricCard key={metric.key} metric={metric} />)
        )}
      </section>

      {/* Charts — each block is rendered by its own card; the section-level
          skeleton only covers the first paint. */}
      <section
        aria-label="Charts"
        aria-busy={sections.isPending}
        className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-2"
      >
        {sections.isPending ? (
          <SectionSkeletons />
        ) : sections.isError ? (
          <div className="lg:col-span-2">
            <ErrorBanner
              message="We could not load your charts."
              retry={() => sections.refetch()}
            />
          </div>
        ) : (
          sections.data.sections.map((section) => (
            <DashboardSectionCard key={section.key} section={section} />
          ))
        )}
      </section>

      {/* Recent uploads — the feed is read-only, and it belongs to the roles
          that work with uploads. A student never sees it, and neither does a
          member without `upload:read`, so the section is not rendered at
          all rather than shown empty. */}
      {isStudent || !canSeeUploads ? null : (
        <section
          aria-labelledby="recent-uploads-title"
          aria-busy={uploads.isPending}
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
            {uploads.data && uploads.data.recentUploads.length > 0 ? (
              <Button asChild variant="ghost" size="sm" className="shrink-0">
                <Link href="/upload-history">
                  View all
                  <ArrowRight aria-hidden />
                </Link>
              </Button>
            ) : null}
          </header>

          {uploads.isPending ? (
            <UploadsSkeleton />
          ) : uploads.isError ? (
            <div className="p-6">
              <ErrorBanner
                message="We could not load recent uploads."
                retry={() => uploads.refetch()}
              />
            </div>
          ) : uploads.data.recentUploads.length > 0 ? (
            <UploadsTable uploads={uploads.data.recentUploads} />
          ) : (
            <div className="p-6">
              {/* The feed is read-only, so the empty state offers no upload
                  action — the section reports what happened, and the Upload
                  Results screen is where a file is put in. */}
              <EmptyState
                title="No uploads yet"
                description="Once a result file is processed, it appears here."
                icon={<FileSpreadsheet className="size-6" aria-hidden />}
              />
            </div>
          )}
        </section>
      )}
    </div>
  );
}

/**
 * One metric card.
 *
 * The metric's own `trend` decides the icon and the colour, so the card
 * reads the same way for every role — a "pending" metric trends down, a
 * "pass percentage" metric trends up.
 */
function MetricCard({ metric }: { metric: DashboardMetric }) {
  const Icon = metricIcon(metric.key);
  const TrendIcon =
    metric.trend === 'up' ? ArrowUpRight : metric.trend === 'down' ? ArrowDownRight : Minus;

  const trendTone =
    metric.trend === 'up'
      ? 'text-semantic-up'
      : metric.trend === 'down'
        ? 'text-semantic-down'
        : 'text-muted';

  return (
    <article
      className="flex flex-col gap-4 rounded-xl border border-hairline bg-card p-6 transition-colors hover:bg-surface-soft"
      aria-label={`${metric.label}: ${formatMetricValue(metric)}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-caption-strong uppercase tracking-wide text-muted">
          {metric.label}
        </span>
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-strong">
          <Icon className="size-4 text-primary" aria-hidden />
        </span>
      </div>
      <p className="num font-display text-display-sm text-ink">
        {formatMetricValue(metric)}
      </p>
      {metric.hint || metric.trend ? (
        <p className="flex items-center gap-1.5 text-caption text-muted">
          {metric.trend ? (
            <TrendIcon className={cn('size-3.5 shrink-0', trendTone)} aria-hidden />
          ) : null}
          {metric.hint}
        </p>
      ) : null}
    </article>
  );
}

/** Four metric-shaped placeholders, matching the desktop grid. */
function MetricSkeletons() {
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex flex-col gap-4 rounded-xl border border-hairline bg-card p-6"
        >
          <div className="flex items-start justify-between gap-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="size-9 rounded-full" />
          </div>
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-3 w-32" />
        </div>
      ))}
    </>
  );
}

/** Two chart-shaped placeholders, matching the desktop two-column grid. */
function SectionSkeletons() {
  return (
    <>
      {[0, 1].map((i) => (
        <div key={i} className="flex flex-col gap-6 rounded-xl border border-hairline bg-card p-6">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-56 w-full" />
        </div>
      ))}
    </>
  );
}

/**
 * The recent-uploads block: a header row and three rows on tablet and up, and
 * stacked rows on mobile, so the loading shape matches the loaded shape.
 */
function UploadsSkeleton() {
  return (
    <>
      <div className="hidden md:block">
        <div className="grid grid-cols-4 gap-4 border-b border-hairline bg-surface-soft px-6 py-3">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="ml-auto h-3 w-20" />
        </div>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="grid grid-cols-4 items-center gap-4 border-b border-hairline px-6 py-4 last:border-b-0"
          >
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="ml-auto h-4 w-24" />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-4 px-6 py-4 md:hidden">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-32" />
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/**
 * The known upload feed, once loaded.
 *
 * Read-only by design: the feed reports what the system has processed. It
 * carries no upload action — putting a file in is the Upload Results
 * screen's job.
 */
function UploadsTable({
  uploads,
}: {
  uploads: Array<{
    id: string;
    fileName: string;
    status: string;
    createdAt: string;
    uploadedBy?: { id: string; email: string; name: string } | null;
  }>;
}) {
  return (
    <>
      {/* Table on tablet and up; stacked rows on mobile. */}
      <table className="hidden w-full text-left md:table">
        <thead>
          <tr className="border-b border-hairline bg-surface-soft">
            <th scope="col" className="px-6 py-3 text-caption-strong uppercase tracking-wide text-muted">
              File
            </th>
            <th scope="col" className="px-6 py-3 text-caption-strong uppercase tracking-wide text-muted">
              Uploaded by
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
                <span className="block max-w-xs truncate text-body-sm text-body">
                  {upload.uploadedBy?.name ?? upload.uploadedBy?.email ?? '—'}
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
            {upload.uploadedBy?.name || upload.uploadedBy?.email ? (
              <p className="truncate text-caption text-muted">
                Uploaded by {upload.uploadedBy?.name ?? upload.uploadedBy?.email}
              </p>
            ) : null}
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
  );
}

/**
 * The icon for a metric, chosen by its key.
 *
 * The backend names the metric (`total-students`, `pass-percentage`, …), so
 * the key is the stable contract between the two sides.
 */
function metricIcon(key: string): typeof Users {
  switch (key) {
    case 'total-students':
      return Users;
    case 'pass-percentage':
      return Percent;
    case 'total-subjects':
      return BookOpen;
    case 'average-percentage':
      return TrendingUp;
    default:
      return TrendingUp;
  }
}

/**
 * A metric's value is a count, a percentage or a short string (a roll
 * number, a pass/fail verdict). Numbers are shown as-is; the caller formats
 * percentages.
 */
function formatMetricValue(metric: DashboardMetric): string {
  if (typeof metric.value === 'string') return metric.value;
  return Number.isInteger(metric.value)
    ? String(metric.value)
    : String(Math.round(metric.value * 10) / 10);
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
