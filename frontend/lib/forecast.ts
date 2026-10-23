/**
 * Reading the forecast response for display. Nothing here computes a probability, score or band:
 * those come from the server. This module only arranges what was sent (chart rows, a table
 * alternative) and turns data-quality fields into plain sentences the person can act on.
 */
import type { Forecast } from "@/lib/api/queries";
import { formatDate, formatMonth, formatPercent, plural } from "@/lib/format";
import { formatRm } from "@/lib/money";

type Simulation = NonNullable<Forecast["simulation"]>;

export type MarginPoint = {
  month: string;
  label: string;
  /** Lower edge of the likely range, and its height above it (the area the chart shades). */
  low: number;
  spread: number;
  middle: number;
  high: number;
};

/** One point per month-end: where the running margin is likely to be (middle) and its range. */
export function marginPoints(sim: Simulation): MarginPoint[] {
  return sim.months.map((month, i) => {
    const low = sim.cumulative_margin_p10_sen[i];
    const high = sim.cumulative_margin_p90_sen[i];
    return {
      month,
      label: formatMonth(month, true),
      low,
      spread: high - low,
      middle: sim.cumulative_margin_p50_sen[i],
      high,
    };
  });
}

export type MarginTableRow = {
  month: string;
  monthLabel: string;
  monthly: string;
  cumulativeLow: string;
  cumulativeMiddle: string;
  cumulativeHigh: string;
  isWorst: boolean;
};

/** The same numbers as the chart, as text, for screen readers and anyone who prefers a table. */
export function marginTable(sim: Simulation): MarginTableRow[] {
  return sim.months.map((month, i) => ({
    month,
    monthLabel: formatMonth(month),
    monthly: formatRm(sim.monthly_margin_p50_sen[i]),
    cumulativeLow: formatRm(sim.cumulative_margin_p10_sen[i]),
    cumulativeMiddle: formatRm(sim.cumulative_margin_p50_sen[i]),
    cumulativeHigh: formatRm(sim.cumulative_margin_p90_sen[i]),
    isWorst: month === sim.worst_month,
  }));
}

/** A sentence that carries the chart's main message without the chart. */
export function chartSummary(sim: Simulation): string {
  const last = sim.months.length - 1;
  if (last < 0) return "No months to show.";
  const end = formatRm(sim.cumulative_margin_p50_sen[last]);
  const worst = sim.worst_month ? ` The tightest point is ${formatMonth(sim.worst_month)}.` : "";
  return `By ${formatMonth(sim.months[last])} your running margin is most likely about ${end}.${worst}`;
}

export type Notice = {
  id: string;
  tone: "info" | "warning";
  title: string;
  body: string;
  /** A link that helps put the notice right. */
  action?: { label: string; href: string };
  /**
   * Present only on a notice the person may close (ADR D-62). It names what is being closed,
   * reasons included, so a new reason on a closed month brings the notice back.
   */
  dismissKey?: string;
};

type SuspectMonth = Forecast["suspect_months"][number];

/**
 * One notice per month that looks incomplete, saying every reason, with a way to import what is
 * missing and a key to close it by. Months keep the order the server gave them.
 */
export function suspectNotices(months: readonly SuspectMonth[]): Notice[] {
  const byMonth = new Map<string, SuspectMonth[]>();
  for (const m of months) byMonth.set(m.month, [...(byMonth.get(m.month) ?? []), m]);
  return [...byMonth].map(([month, rows]) => ({
    id: `suspect-${month}`,
    tone: "warning",
    title: `${formatMonth(month)} looks incomplete`,
    body: rows.map((r) => r.detail).join(" "),
    action: { label: "Import", href: "/import" },
    dismissKey: `${month}:${rows
      .map((r) => r.reason)
      .sort()
      .join("+")}`,
  }));
}

const BOOTSTRAP_NOTES: Partial<Record<Simulation["bootstrap"], string>> = {
  block:
    "The range of outcomes is based on a short record of how far past forecasts missed, so treat it as rough.",
  plain:
    "The range of outcomes is based on a short record of how far past forecasts missed, so treat it as rough.",
  fallback:
    "There was not enough history to measure how far past forecasts missed, so the range uses the overall spread of your weekly spending.",
  none: "No variation could be measured from your history, so the range may be narrower than real life.",
};

/** Everything that qualifies the number, in the order it matters. */
export function notices(forecast: Forecast): Notice[] {
  const out: Notice[] = [];
  if (forecast.is_stale && forecast.data_through) {
    out.push({
      id: "stale",
      tone: "warning",
      title: "Your ledger is out of date",
      body: `Your last logged day is ${formatDate(forecast.data_through)}${
        forecast.stale_days ? `, ${forecast.stale_days} days ago` : ""
      }. The forecast only knows what you logged up to then, so import or add what has happened since.`,
    });
  }
  out.push(...suspectNotices(forecast.suspect_months));
  if (forecast.unmatched_items.length > 0) {
    out.push({
      id: "unmatched",
      tone: "info",
      title: "Some recurring items matched nothing",
      body: `${forecast.unmatched_items.join(", ")} did not match any logged transaction, so they are counted from their schedule alone. Check their matching text on the Recurring page.`,
    });
  }
  const sim = forecast.simulation;
  if (sim) {
    const note = BOOTSTRAP_NOTES[sim.bootstrap];
    if (note) out.push({ id: "bootstrap", tone: "info", title: "A rough range", body: note });
    if (sim.horizon_capped) {
      out.push({
        id: "capped",
        tone: "info",
        title: "Looking ahead is capped",
        body: "The forecast looks at most 52 weeks ahead, so anything beyond that is not included.",
      });
    }
  }
  return out;
}

/**
 * The chance of running short, in the words a student would use (the engine calls it the shortfall
 * probability: the share of simulated futures in which the running margin is below RM 0 at any
 * month-end). The figure is the server's `p_shortfall`; only its wording is made here. The detail
 * says what was counted and quotes no number of runs, because the response carries none.
 */
export function shortfallLine(
  pShortfall: number,
  months: number,
): { headline: string; detail: string } {
  const span = plural(months, "month");
  const detail =
    "We played your recent income and spending forward many times and counted how often your running total, starting from RM 0, ended a month below RM 0.";
  if (pShortfall === 0) {
    return {
      headline: `In none of the futures we simulated did you run short of money over the next ${span}.`,
      detail,
    };
  }
  const percent = formatPercent(pShortfall);
  // "an 8%", "an 11%", "an 18%", "an 85%", but "a 10%"
  const article = /^(8\d?|11|18)$/.test(String(Math.round(pShortfall * 100))) ? "an" : "a";
  const chance = percent === "under 1%" ? "under a 1% chance" : `${article} ${percent} chance`;
  return {
    headline: `There is ${chance} you would run short of money at some point in the next ${span}.`,
    detail,
  };
}

/** What the headline band means for the month-by-month outlook (not for one purchase). */
export const OUTLOOK_LINE = {
  Safe: "On your recent pattern, your income is likely to cover your spending and commitments.",
  Caution: "Most months should work, but a bad one could leave you short.",
  "At Risk": "On your recent pattern, you are likely to run short at some point.",
} as const;
