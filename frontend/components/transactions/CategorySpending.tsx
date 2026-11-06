"use client";

import { Card, CardCaption, CardTitle } from "@/components/ui/Card";
import { CatIcon } from "@/components/ui/CatIcon";
import { Skeleton } from "@/components/ui/States";
import {
  groupSmallCategories,
  categoryColour,
  type Look,
  type SpendRow,
} from "@/lib/categoryStyle";
import type { CategorySummary } from "@/lib/api/queries";
import { formatMonth, formatPercent } from "@/lib/format";
import { formatRm } from "@/lib/money";

type Props = {
  month: string;
  summary: CategorySummary | undefined;
  isPending: boolean;
  error: string | null;
  selected: string | undefined;
  onSelect: (category: string | undefined) => void;
  /** The look the person gave a category (ADR D-64); absent, every category has its default. */
  lookOf?: (category: string) => Look | undefined;
};

/**
 * Where the month's spending went. Every figure is the server's (the same definition of "spent"
 * as the dashboard); a category is a button, so picking one filters the list beside it.
 */
export function CategorySpending({
  month,
  summary,
  isPending,
  error,
  selected,
  onSelect,
  lookOf,
}: Props) {
  const label = formatMonth(month);
  return (
    <Card>
      <CardTitle>Spending by category</CardTitle>
      <CardCaption>{label}</CardCaption>
      <div className="mt-4">
        {isPending ? (
          <Skeleton lines={5} label="Loading spending by category" />
        ) : error !== null || !summary ? (
          <p role="alert" className="text-[13px] text-danger">
            {error ?? "Spending by category did not load."}
          </p>
        ) : summary.categories.length === 0 ? (
          <p className="text-[13px] text-ink-secondary">Nothing spent in {label}.</p>
        ) : (
          <SpendingBreakdown
            rows={groupSmallCategories(summary.categories)}
            selected={selected}
            onSelect={onSelect}
            lookOf={lookOf}
          />
        )}
      </div>
      {summary && (
        <div
          role="group"
          aria-label={`Totals for ${label}`}
          className="mt-4 border-t border-line pt-3 text-[12px] text-ink-secondary"
        >
          <dl className="space-y-1">
            <Total label="Income" sen={summary.income_sen} />
            {summary.refund_sen > 0 && (
              <Total label="Before refunds" sen={summary.gross_spend_sen} />
            )}
            <Total label="Spent" sen={summary.spend_sen} />
            {summary.savings_sen > 0 && <Total label="Saved" sen={summary.savings_sen} />}
            {summary.refund_sen > 0 && <Total label="Refunded" sen={summary.refund_sen} />}
          </dl>
        </div>
      )}
    </Card>
  );
}

function Total({ label, sen }: { label: string; sen: number }) {
  return (
    <div className="flex justify-between gap-3">
      <dt>{label}</dt>
      <dd className="tabular-nums text-ink">{formatRm(sen)}</dd>
    </div>
  );
}

type BreakdownProps = {
  rows: SpendRow[];
  selected: string | undefined;
  onSelect: (category: string | undefined) => void;
  lookOf?: (category: string) => Look | undefined;
};

/** One bar for the month, then a row per category: its icon, name, amount and share. */
function SpendingBreakdown({ rows, selected, onSelect, lookOf }: BreakdownProps) {
  const summary = rows.map((r) => `${r.category} ${formatPercent(r.share)}`).join(", ");
  return (
    <>
      <div
        role="img"
        aria-label={`Spending split: ${summary}`}
        className="flex h-[22px] gap-[3px] overflow-hidden rounded-full"
      >
        {rows.map((r) => (
          <span
            key={r.category}
            style={{
              flex: `${r.spend_sen} 1 0`,
              background: categoryColour(r.category, lookOf?.(r.category)),
            }}
          />
        ))}
      </div>
      <ul className="mt-3.5 space-y-0.5">
        {rows.map((r) => (
          <li key={r.category}>
            {r.grouped > 0 ? (
              <RowBody row={r} active={false} look={lookOf?.(r.category)} />
            ) : (
              <button
                type="button"
                aria-pressed={selected === r.category}
                onClick={() => onSelect(selected === r.category ? undefined : r.category)}
                className={`block w-full rounded-[10px] text-left hover:bg-surface-2 ${
                  selected === r.category
                    ? "bg-accent-bg shadow-[inset_3px_0_0_var(--color-accent)]"
                    : ""
                }`}
              >
                <RowBody row={r} active={selected === r.category} look={lookOf?.(r.category)} />
              </button>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

function RowBody({ row, active, look }: { row: SpendRow; active: boolean; look?: Look }) {
  return (
    <span className="flex items-center gap-2.5 px-2 py-2 text-[14px]">
      <CatIcon category={row.category} look={look} size={28} />
      <span className={active ? "font-extrabold" : "font-bold"}>
        {row.category}
        {row.grouped > 0 && (
          <span className="ml-1.5 text-[12px] font-normal text-ink-muted">
            {row.grouped} small ones
          </span>
        )}
      </span>
      <span className="ml-auto tabular-nums text-ink">{formatRm(row.spend_sen)}</span>
      <span className="w-10 text-right tabular-nums text-ink-muted">
        {formatPercent(row.share)}
      </span>
    </span>
  );
}
