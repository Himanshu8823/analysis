'use client';

import {
  Bar,
  BarChart as ReBarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart as ReLineChart,
  Pie,
  PieChart as RePieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ReactElement } from 'react';

/**
 * Coinbase palette — chart colors are pulled from DESIGN.md only.
 * No custom palette allowed.
 */
export const CHART_COLORS = {
  primary: '#0052ff',
  up: '#05b169',
  down: '#cf202f',
  ink: '#0a0b0d',
  body: '#5b616e',
  muted: '#7c828a',
  hairline: '#dee1e6',
  surface: '#f7f7f7',
  surfaceStrong: '#eef0f3',
  accentYellow: '#f4b000',
  inkSoft: '#16181c',
} as const;

export const CHART_SERIES = [
  CHART_COLORS.primary,
  CHART_COLORS.up,
  CHART_COLORS.down,
  CHART_COLORS.accentYellow,
  CHART_COLORS.inkSoft,
];

const AXIS_STYLE = { fill: CHART_COLORS.muted, fontSize: 12 };

interface BaseProps {
  height?: number;
  className?: string;
  ariaLabel?: string;
}

interface NamedDataPoint {
  name: string;
  value: number;
  [key: string]: number | string;
}

export function PieChart({
  data,
  height = 240,
  className,
  ariaLabel,
  colors,
}: BaseProps & { data: NamedDataPoint[]; colors?: string[] }): ReactElement {
  const palette = colors && colors.length > 0 ? colors : CHART_SERIES;

  return (
    <div
      className={className}
      role="img"
      aria-label={ariaLabel ?? 'Pie chart'}
      style={{ width: '100%', height }}
    >
      <ResponsiveContainer>
        <RePieChart>
          <Tooltip
            contentStyle={{
              backgroundColor: CHART_COLORS.ink,
              border: `1px solid ${CHART_COLORS.inkSoft}`,
              borderRadius: 8,
              color: '#ffffff',
              fontSize: 12,
            }}
            itemStyle={{ color: '#ffffff' }}
          />
          <Legend
            wrapperStyle={{ color: CHART_COLORS.muted, fontSize: 12 }}
            iconType="square"
          />
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={2}
            stroke={CHART_COLORS.surface}
          >
            {data.map((entry, index) => (
              <Cell key={entry.name} fill={palette[index % palette.length]} />
            ))}
          </Pie>
        </RePieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BarChart({
  data,
  xKey,
  yKey,
  height = 240,
  className,
  ariaLabel,
  color,
  horizontal = false,
}: BaseProps & {
  data: Array<Record<string, number | string>>;
  xKey: string;
  yKey: string;
  color?: string;
  horizontal?: boolean;
}): ReactElement {
  return (
    <div
      className={className}
      role="img"
      aria-label={ariaLabel ?? 'Bar chart'}
      style={{ width: '100%', height }}
    >
      <ResponsiveContainer>
        <ReBarChart
          data={data}
          layout={horizontal ? 'vertical' : 'horizontal'}
          margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
        >
          <CartesianGrid stroke={CHART_COLORS.hairline} strokeDasharray="3 3" vertical={horizontal} />
          <XAxis
            dataKey={horizontal ? yKey : xKey}
            type={horizontal ? 'number' : 'category'}
            stroke={CHART_COLORS.hairline}
            tick={AXIS_STYLE}
          />
          <YAxis
            dataKey={horizontal ? xKey : undefined}
            type={horizontal ? 'category' : 'number'}
            stroke={CHART_COLORS.hairline}
            tick={AXIS_STYLE}
            width={horizontal ? 120 : 48}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: CHART_COLORS.ink,
              border: `1px solid ${CHART_COLORS.inkSoft}`,
              borderRadius: 8,
              color: '#ffffff',
              fontSize: 12,
            }}
            itemStyle={{ color: '#ffffff' }}
            cursor={{ fill: CHART_COLORS.surface }}
          />
          <Bar
            dataKey={horizontal ? xKey : yKey}
            fill={color ?? CHART_COLORS.primary}
            radius={[6, 6, 0, 0]}
          />
        </ReBarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LineChart({
  data,
  xKey,
  series,
  height = 240,
  className,
  ariaLabel,
}: BaseProps & {
  data: Array<Record<string, number | string>>;
  xKey: string;
  series: Array<{ key: string; label: string; color?: string }>;
}): ReactElement {
  return (
    <div
      className={className}
      role="img"
      aria-label={ariaLabel ?? 'Line chart'}
      style={{ width: '100%', height }}
    >
      <ResponsiveContainer>
        <ReLineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid stroke={CHART_COLORS.hairline} strokeDasharray="3 3" />
          <XAxis dataKey={xKey} stroke={CHART_COLORS.hairline} tick={AXIS_STYLE} />
          <YAxis stroke={CHART_COLORS.hairline} tick={AXIS_STYLE} width={48} />
          <Tooltip
            contentStyle={{
              backgroundColor: CHART_COLORS.ink,
              border: `1px solid ${CHART_COLORS.inkSoft}`,
              borderRadius: 8,
              color: '#ffffff',
              fontSize: 12,
            }}
            itemStyle={{ color: '#ffffff' }}
          />
          <Legend
            wrapperStyle={{ color: CHART_COLORS.muted, fontSize: 12 }}
            iconType="plainline"
          />
          {series.map((s, idx) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color ?? CHART_SERIES[idx % CHART_SERIES.length]}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          ))}
        </ReLineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StackedBar({
  data,
  xKey,
  series,
  height = 240,
  className,
  ariaLabel,
}: BaseProps & {
  data: Array<Record<string, number | string>>;
  xKey: string;
  series: Array<{ key: string; label: string; color?: string }>;
}): ReactElement {
  return (
    <div
      className={className}
      role="img"
      aria-label={ariaLabel ?? 'Stacked bar chart'}
      style={{ width: '100%', height }}
    >
      <ResponsiveContainer>
        <ReBarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid stroke={CHART_COLORS.hairline} strokeDasharray="3 3" />
          <XAxis dataKey={xKey} stroke={CHART_COLORS.hairline} tick={AXIS_STYLE} />
          <YAxis stroke={CHART_COLORS.hairline} tick={AXIS_STYLE} width={48} />
          <Tooltip
            contentStyle={{
              backgroundColor: CHART_COLORS.ink,
              border: `1px solid ${CHART_COLORS.inkSoft}`,
              borderRadius: 8,
              color: '#ffffff',
              fontSize: 12,
            }}
            itemStyle={{ color: '#ffffff' }}
          />
          <Legend
            wrapperStyle={{ color: CHART_COLORS.muted, fontSize: 12 }}
            iconType="square"
          />
          {series.map((s, idx) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              stackId="stack"
              fill={s.color ?? CHART_SERIES[idx % CHART_SERIES.length]}
              radius={idx === series.length - 1 ? [6, 6, 0, 0] : undefined}
            />
          ))}
        </ReBarChart>
      </ResponsiveContainer>
    </div>
  );
}