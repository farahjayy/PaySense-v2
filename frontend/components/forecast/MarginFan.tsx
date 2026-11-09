"use client";

import {
  Area,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { Forecast } from "@/lib/api/queries";
import { MarginLegend } from "@/components/forecast/MarginLegend";
import { MarginTooltip } from "@/components/forecast/MarginTooltip";
import { formatMonthName } from "@/lib/format";
import { chartSummary, marginPoints, marginTable } from "@/lib/forecast";

type Simulation = NonNullable<Forecast["simulation"]>;

/** Compact axis labels: "RM 1.2k" is readable at a glance; the table has the exact figures. */
function axisLabel(sen: number): string {
  const rm = sen / 100;
  const abs = Math.abs(rm);
  const text =
    abs >= 1000 ? `${(abs / 1000).toFixed(1).replace(/\.0$/, "")}k` : `${Math.round(abs)}`;
  return `${rm < 0 ? "-" : ""}RM ${text}`;
}

/**
 * Running margin month by month: the line is the most likely total, the shaded band is where it
 * lands in 8 of 10 simulated futures, and below the zero line means short of money. A legend above
 * says so, the hover names all three values, and the table beneath carries the same numbers.
 */
const DOT = { r: 5, fill: "var(--color-surface)", stroke: "var(--color-accent)", strokeWidth: 2 };
const MIDDLE_DOT = {
  r: 6,
  fill: "var(--color-accent)",
  stroke: "var(--color-surface)",
  strokeWidth: 2,
};
/** The chart is h-64 (16 rem = 256 px); the readout sits just under it, over nothing that matters. */
const CHART_HEIGHT = 256;
const CURSOR = { stroke: "var(--color-ink-muted)", strokeWidth: 1, strokeDasharray: "3 3" };

type CursorProps = {
  points?: readonly { x: number; y: number }[];
  x?: number;
  y?: number;
  width?: number;
  height?: number;
};

type LabelProps = { x?: number | string; y?: number | string; index?: number; lastIndex: number };

/** "Most likely" written beside the last point of the line, so the line names itself. */
function MostLikelyLabel({ x, y, index, lastIndex }: LabelProps) {
  if (index !== lastIndex || x === undefined || y === undefined) return <g />;
  return (
    <text
      x={Number(x)}
      y={Number(y) - 12}
      textAnchor="end"
      fontSize={12}
      fontWeight={600}
      fill="var(--color-accent)"
    >
      Most likely
    </text>
  );
}

type ZeroLabelProps = { viewBox?: { x?: number; y?: number; width?: number } };

/** "RM 0" written on the dashed line itself, just above its right end, clear of the month labels. */
function ZeroLabel({ viewBox }: ZeroLabelProps) {
  if (viewBox?.x === undefined || viewBox.y === undefined) return null;
  return (
    <text
      x={viewBox.x + (viewBox.width ?? 0) - 4}
      y={viewBox.y - 6}
      textAnchor="end"
      fontSize={11}
      fontWeight={600}
      fill="var(--color-danger)"
    >
      RM 0
    </text>
  );
}

/** Always a thin vertical line at the hovered month, never the outlined box recharts may choose. */
function LineCursor({ points, x, y, width, height }: CursorProps) {
  const at = points?.[0]?.x ?? (x ?? 0) + (width ?? 0) / 2;
  const top = points?.[0]?.y ?? y ?? 0;
  const bottom = points?.[1]?.y ?? top + (height ?? 0);
  return <line x1={at} x2={at} y1={top} y2={bottom} {...CURSOR} />;
}
export function MarginFan({ simulation }: { simulation: Simulation }) {
  const points = marginPoints(simulation);
  const rows = marginTable(simulation);
  const lastIndex = points.length - 1;
  return (
    <figure className="m-0">
      <MarginLegend />
      <div role="img" aria-label={chartSummary(simulation)} className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <ComposedChart
            accessibilityLayer={false}
            data={points}
            margin={{ top: 16, right: 12, bottom: 0, left: 0 }}
          >
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: "var(--color-line)" }}
              tick={{ fontSize: 12, fill: "var(--color-ink-secondary)" }}
            />
            <YAxis
              width={64}
              tickLine={false}
              axisLine={false}
              tickFormatter={axisLabel}
              domain={[(min: number) => Math.min(min, 0), (max: number) => Math.max(max, 0)]}
              tick={{ fontSize: 12, fill: "var(--color-ink-secondary)" }}
            />
            <ReferenceLine
              y={0}
              stroke="var(--color-danger)"
              strokeDasharray="4 3"
              label={<ZeroLabel />}
            />
            <Area
              dataKey="low"
              stackId="range"
              stroke="none"
              fill="transparent"
              isAnimationActive={false}
              legendType="none"
              activeDot={DOT}
            />
            <Area
              dataKey="spread"
              stackId="range"
              stroke="var(--color-chart-edge)"
              strokeOpacity={0.6}
              fill="var(--color-chart-blue)"
              fillOpacity={0.35}
              isAnimationActive={false}
              activeDot={DOT}
            />
            <Line
              dataKey="middle"
              stroke="var(--color-accent)"
              strokeWidth={2.5}
              dot={{ r: 3, fill: "var(--color-accent)" }}
              activeDot={MIDDLE_DOT}
              isAnimationActive={false}
              label={(props) => <MostLikelyLabel {...props} lastIndex={lastIndex} />}
            />
            <Tooltip
              content={<MarginTooltip />}
              cursor={<LineCursor />}
              position={{ y: CHART_HEIGHT + 4 }}
              allowEscapeViewBox={{ x: false, y: true }}
              wrapperStyle={{ pointerEvents: "none", zIndex: 20 }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-3 rounded-lg border border-line bg-surface-2 px-4 py-2.5 text-[13px]">
        <summary className="cursor-pointer font-medium text-ink">Show the numbers</summary>
        <div
          className="mt-3 overflow-x-auto"
          role="region"
          aria-label="Forecast numbers, scrollable"
          tabIndex={0}
        >
          <table className="w-full min-w-[30rem] text-left tabular-nums">
            <caption className="sr-only">Forecast running margin by month</caption>
            <thead className="text-[11px] uppercase tracking-wide text-ink-muted">
              <tr>
                <th scope="col" rowSpan={2} className="py-1.5 pr-3 align-bottom font-medium">
                  Month
                </th>
                <th
                  scope="col"
                  rowSpan={2}
                  className="py-1.5 pr-3 text-right align-bottom font-medium"
                >
                  This month alone
                </th>
                <th
                  scope="colgroup"
                  colSpan={3}
                  className="border-b border-line py-1.5 text-center font-medium"
                >
                  Total since {formatMonthName(simulation.months[0])}
                </th>
              </tr>
              <tr>
                <th scope="col" className="py-1.5 pr-3 text-right font-medium">
                  Lower
                </th>
                <th scope="col" className="py-1.5 pr-3 text-right font-medium">
                  Most likely
                </th>
                <th scope="col" className="py-1.5 text-right font-medium">
                  Higher
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.month} className="border-t border-line">
                  <th scope="row" className="py-1.5 pr-3 font-medium">
                    {r.monthLabel}
                    {r.isWorst && <span className="ml-1.5 text-[11px] text-warning">tightest</span>}
                  </th>
                  <td className="py-1.5 pr-3 text-right">{r.monthly}</td>
                  <td className="py-1.5 pr-3 text-right">{r.cumulativeLow}</td>
                  <td className="py-1.5 pr-3 text-right">{r.cumulativeMiddle}</td>
                  <td className="py-1.5 text-right">{r.cumulativeHigh}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-ink-secondary">
          The amounts won&apos;t always add up exactly, because each is worked out separately.
        </p>
      </details>
    </figure>
  );
}
