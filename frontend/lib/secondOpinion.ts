import type { RiskCheck } from "@/lib/api/queries";
import { formatMonth, plural } from "@/lib/format";
import { formatRm } from "@/lib/money";

export type SecondOpinion = NonNullable<RiskCheck["second_opinion"]>;

/**
 * The points the purchase adds, as the gap between the two percentages as they are shown, so the
 * three tiles always add up on screen (74% less 65% is 9, even when the figures underneath round
 * the other way). The server's own `added_probability` is the stored, unrounded figure.
 */
export function pointsAdded(opinion: SecondOpinion): number {
  const gap =
    Math.round(opinion.with_probability * 100) -
    Math.round(opinion.without_probability * 100);
  return Math.max(gap, 0);
}

export function formatPoints(points: number): string {
  return `+${points} ${points === 1 ? "point" : "points"}`;
}

/** One line for the closed "month by month" fold: the heaviest month, as the server found it. */
export function stackSummary(opinion: SecondOpinion): string {
  const { peak } = opinion;
  if (peak === null) return "Nothing owed in the months ahead";
  return `Most owed: ${formatRm(peak.total_sen)} in ${formatMonth(peak.month)}`;
}

/** One line for the closed "exposure" fold. */
export function exposureSummary(opinion: SecondOpinion): string {
  const { exposure } = opinion;
  return `${formatRm(exposure.unpaid_before_sen)} to ${formatRm(exposure.unpaid_after_sen)}, ${plural(
    exposure.providers_after.length,
    "provider",
  )}, ${plural(exposure.plans_after, "plan")}`;
}

/** A month with nothing owed and no confirmed income adds nothing to read, so it is left out. */
export function visibleMonths(opinion: SecondOpinion) {
  const months = opinion.stack.filter(
    (m) => m.total_sen > 0 || m.known_income_sen > 0,
  );
  return { months, hidden: opinion.stack.length - months.length };
}
