"use client";

import { CatIcon } from "@/components/ui/CatIcon";
import type { Look } from "@/lib/categoryStyle";
import { formatDate } from "@/lib/format";
import { type ReviewRow, type RowType } from "@/lib/import";
import { formatRm } from "@/lib/money";

type Patch = Partial<Pick<ReviewRow, "category" | "type" | "include">>;
type Props = {
  rows: readonly ReviewRow[];
  /** Everything a row's category can be set to: the app's list plus the file's own categories. */
  categories: readonly string[];
  onChange: (row: number, patch: Patch) => void;
  /** The look the person gave a category (ADR D-64); absent means every category's default. */
  lookOf?: (name: string) => Look | undefined;
};

const TYPES: readonly { value: RowType; label: string }[] = [
  { value: "expense", label: "Spending" },
  { value: "income", label: "Income" },
  { value: "savings", label: "Savings" },
];

const SELECT =
  "h-9 w-full rounded-lg border border-field bg-surface px-2 text-[13px] text-ink hover:border-ink-muted";

// The type choice and the amount take the colour of what they are, so a statement reads at a glance.
const TYPE_SELECT: Record<RowType, string> = {
  expense: "border-pop/60 bg-pop-bg text-pop font-semibold",
  income: "border-income/60 bg-income-bg text-income font-semibold",
  savings: "border-accent/60 bg-accent-bg text-accent font-semibold",
};
const AMOUNT: Record<RowType, string> = {
  expense: "text-ink",
  income: "text-income",
  savings: "text-accent",
};

/** One line per statement row: a card on a phone, a table-like row from tablet width up. */
export function ReviewList({ rows, categories, onChange, lookOf }: Props) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
      {rows.map((r) => (
        <li
          key={r.row}
          className={`grid gap-x-3 gap-y-2 px-4 py-3 md:grid-cols-[auto_6.5rem_minmax(0,1fr)_8rem_8rem_7rem] md:items-center ${
            r.include ? "" : "bg-surface-2 text-ink-muted"
          }`}
        >
          <input
            type="checkbox"
            checked={r.include}
            onChange={(event) => onChange(r.row, { include: event.target.checked })}
            aria-label={`Include row ${r.row}: ${r.description || "no description"}, ${formatDate(r.date)}`}
            className="h-5 w-5 accent-[var(--color-accent)]"
          />
          <span className="text-[13px] tabular-nums">{formatDate(r.date)}</span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium">{r.description || "No description"}</p>
            {(r.duplicate || r.issues.length > 0) && (
              <p className="mt-0.5 text-[12px] text-warning">
                {r.duplicate && "Already in your ledger. "}
                {r.issues.join(". ")}
              </p>
            )}
          </div>
          <div className="relative">
            <span className="pointer-events-none absolute left-1.5 top-1/2 -translate-y-1/2">
              <CatIcon category={r.category} size={24} look={lookOf?.(r.category)} />
            </span>
            <select
              aria-label={`Category for row ${r.row}`}
              className={`${SELECT} pl-9`}
              value={r.category}
              onChange={(event) => onChange(r.row, { category: event.target.value })}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <select
            aria-label={`Type for row ${r.row}`}
            className={`${SELECT} ${TYPE_SELECT[r.type]}`}
            value={r.type}
            onChange={(event) => onChange(r.row, { type: event.target.value as RowType })}
          >
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <span
            className={`text-[14px] font-semibold tabular-nums md:text-right ${AMOUNT[r.type]}`}
          >
            {formatRm(r.amountSen)}
          </span>
        </li>
      ))}
    </ul>
  );
}
