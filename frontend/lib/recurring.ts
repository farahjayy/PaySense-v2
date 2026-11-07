import type { RecurringInput, RecurringItem } from "@/lib/api/queries";

type Candidate = Pick<RecurringInput, "kind" | "name" | "amount_sen" | "cadence"> & {
  custom_interval_days?: number | null;
};

function normalised(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * An item already in the list that is the same thing as `candidate`: same kind, name (ignoring
 * case and spaces), amount and cadence. The start date is left out on purpose, so "Netflix, RM 35
 * a month" added by hand is caught even if its date differs. The page asks before adding another:
 * the same item counted twice doubles that money in the forecast.
 */
export function findSimilarItem(
  items: readonly RecurringItem[],
  candidate: Candidate,
): RecurringItem | undefined {
  const name = normalised(candidate.name);
  return items.find(
    (item) =>
      item.kind === candidate.kind &&
      normalised(item.name) === name &&
      item.amount_sen === candidate.amount_sen &&
      item.cadence === candidate.cadence &&
      (candidate.cadence !== "custom" ||
        item.custom_interval_days === (candidate.custom_interval_days ?? null)),
  );
}
