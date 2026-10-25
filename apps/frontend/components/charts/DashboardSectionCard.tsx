'use client';

import { BarChart, CHART_COLORS, PieChart } from '@/components/charts';
import type { DashboardSection } from '@/lib/services/dashboard.service';

/**
 * The colour of a dashboard chart is chosen by what the chart *means*, not by
 * its position on the page. Within the Coinbase palette:
 *
 * - structural counts (enrolment, curriculum) use neutral blues, ink and grey —
 *   volume is information, not a verdict;
 * - achievement charts (pass rate, a student's subject scores) use the
 *   semantic "up" green, because a taller bar really is better;
 * - the year-on-year trend uses the accent yellow: it is the one series the
 *   reader is meant to follow across time;
 * - data-quality gaps use the semantic "down" red, because they are a problem
 *   to fix, not a neutral count.
 *
 * Keys come from the backend (`apps/backend/.../dashboard.service.ts`), so the
 * colour stays attached to the metric even if the render order changes.
 */
const SECTION_COLORS: Record<string, string> = {
  // Structural counts — neutral.
  'students-per-branch': CHART_COLORS.primary,
  'students-per-semester': CHART_COLORS.ink,
  'subjects-per-semester': CHART_COLORS.muted,

  // Achievement — green means "more is better".
  'pass-percentage-per-branch': CHART_COLORS.up,
  'subject-performance': CHART_COLORS.up,

  // The series the reader is following across years.
  'performance-trend': CHART_COLORS.accentYellow,

  // Data-quality gaps — a problem, not a count.
  'branches-with-missing-data': CHART_COLORS.down,
};

/**
 * Categorical colours for a donut.
 *
 * A donut's slices are categories (semesters), not good/bad values, so the
 * semantic green and red are deliberately left out — a red slice must never
 * look like a failure. The slices step through neutral/informational tones
 * that stay distinguishable from one another.
 */
const CATEGORICAL_COLORS = [
  CHART_COLORS.primary,
  CHART_COLORS.accentYellow,
  CHART_COLORS.body,
  CHART_COLORS.muted,
  CHART_COLORS.ink,
  CHART_COLORS.inkSoft,
];

/**
 * Renders one dashboard chart block.
 *
 * The backend decides the *shape* of every block — its kind, its title and
 * its items — from the caller's effective permissions, so this component
 * does not second-guess it. It only decides how the block is laid out.
 *
 * Layout contract (3 breakpoints):
 * - Mobile (< 768px): a single column of cards; charts keep a fixed height
 *   so they never collapse.
 * - Tablet (768–1023px): still one column, because a chart at this width
 *   needs the full row to keep its labels legible.
 * - Desktop (>= 1024px): two columns, so a wide dashboard shows several
 *   blocks at once instead of one long scroll.
 */
export function DashboardSectionCard({
  section,
}: {
  section: DashboardSection;
}): React.ReactElement | null {
  if (section.items.length === 0) return null;

  return (
    <article
      className="cb-surface-card flex flex-col gap-base"
      aria-labelledby={`dashboard-section-${section.key}`}
    >
      <header>
        <h3
          id={`dashboard-section-${section.key}`}
          className="font-display text-title-md text-ink"
        >
          {section.title}
        </h3>
      </header>

      {section.kind === 'bar' ? (
        <BarChart
          data={section.items.map((item) => ({
            name: item.label,
            value: item.value,
          }))}
          xKey="name"
          yKey="value"
          color={SECTION_COLORS[section.key]}
          ariaLabel={`${section.title} bar chart`}
        />
      ) : null}

      {section.kind === 'donut' ? (
        <PieChart
          data={section.items.map((item) => ({
            name: item.label,
            value: item.value,
          }))}
          colors={CATEGORICAL_COLORS}
          ariaLabel={`${section.title} pie chart`}
        />
      ) : null}

      {section.kind === 'list' ? (
        <ListSection section={section} />
      ) : null}
    </article>
  );
}

/**
 * A list block — the ranked, human-readable blocks such as "Toppers per
 * branch" and "Subject offerings awaiting marks".
 *
 * The list is a definition list so the label and the value are programmatically
 * associated; a screen reader announces "Computer Science and Engineering,
 * 42" rather than two unrelated strings.
 */
function ListSection({ section }: { section: DashboardSection }) {
  return (
    <dl className="flex flex-col divide-y divide-hairline">
      {section.items.map((item, index) => (
        <div
          key={`${section.key}-${item.label}-${index}`}
          className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
        >
          <div className="flex min-w-0 flex-col gap-0.5">
            <dt className="truncate text-body-sm font-semibold text-ink">{item.label}</dt>
            {item.secondary ? (
              <dd className="truncate text-caption text-muted">{item.secondary}</dd>
            ) : null}
          </div>
          <dd className="num shrink-0 font-display text-title-md text-ink">
            {formatValue(item.value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Values are counts in most sections and percentages in others (a pass
 * percentage, a subject score). A value that is not a whole number is
 * shown with one decimal place; a whole number is shown as-is.
 */
function formatValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
