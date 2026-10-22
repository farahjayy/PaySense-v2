import type { MarginPoint } from "@/lib/forecast";
import { formatRm } from "@/lib/money";

type Props = {
  active?: boolean;
  /** What recharts hands a custom tooltip: one entry per series, each carrying the whole row. */
  payload?: readonly { payload?: MarginPoint }[];
};

type Row = { key: string; label: string; sen: number; note: string; marker: "solid" | "hollow" };

function rowsFor(point: MarginPoint): Row[] {
  return [
    {
      key: "high",
      label: "Higher outcome",
      sen: point.high,
      note: "only 1 in 10 futures end above this",
      marker: "hollow",
    },
    {
      key: "middle",
      label: "Most likely",
      sen: point.middle,
      note: "the middle result",
      marker: "solid",
    },
    {
      key: "low",
      label: "Lower outcome",
      sen: point.low,
      note: "only 1 in 10 futures end below this",
      marker: "hollow",
    },
  ];
}

/** The same dots the chart draws on hover: solid for the middle, hollow for the edges of the band. */
function Marker({ kind }: { kind: Row["marker"] }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      aria-hidden="true"
      data-marker={kind}
      className="mt-0.5 shrink-0"
    >
      <circle
        cx="6"
        cy="6"
        r="4.5"
        strokeWidth="2"
        stroke="var(--color-accent)"
        fill={kind === "solid" ? "var(--color-accent)" : "var(--color-surface)"}
      />
    </svg>
  );
}

/**
 * What the hover shows for one month-end (plan P7f): all three values the three dots stand for,
 * in plain words, taken from the chart's own band. Nothing is computed here beyond choosing which
 * of the row's three numbers goes on which line.
 */
export function MarginTooltip({ active, payload }: Props) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="max-w-[15.5rem] rounded-lg border border-line bg-surface px-3 py-2.5 text-[12px] leading-snug text-ink shadow-md">
      <p className="mb-1.5 font-semibold">{point.label}</p>
      <ul aria-label={`${point.label}: the range of outcomes`} className="space-y-1.5">
        {rowsFor(point).map((row) => (
          <li key={row.key} className="flex gap-2">
            <Marker kind={row.marker} />
            <span>
              <span className="font-semibold">
                {row.label}: {formatRm(row.sen)}
              </span>
              <span className="block text-ink-secondary">({row.note})</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
