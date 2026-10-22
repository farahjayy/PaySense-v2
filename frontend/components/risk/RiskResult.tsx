"use client";

import dynamic from "next/dynamic";
import { useState, type ReactNode } from "react";

import { Notices } from "@/components/forecast/Notices";
import { PlanPreviewPanel } from "@/components/plans/PlanPreviewPanel";
import { RepaymentCard } from "@/components/risk/RepaymentCard";
import { AddsCard, ExposureDetails, StackTable } from "@/components/risk/SecondOpinion";
import { SuggestionCard } from "@/components/risk/SuggestionCard";
import { BandBadge } from "@/components/ui/BandBadge";
import { Banner } from "@/components/ui/Banner";
import { Card, CardCaption, CardTitle } from "@/components/ui/Card";
import { Face } from "@/components/ui/Face";
import { Fold } from "@/components/ui/Fold";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { LockedNote, Skeleton } from "@/components/ui/States";
import type { PlanInput, RiskCheck } from "@/lib/api/queries";
import { BAND_COPY, formatPercent, plural } from "@/lib/format";
import { formatRm } from "@/lib/money";
import { riskNotices } from "@/lib/risk";
import { exposureSummary, stackSummary } from "@/lib/secondOpinion";

const WithWithoutChart = dynamic(
  () => import("@/components/risk/WithWithoutChart").then((m) => m.WithWithoutChart),
  { ssr: false, loading: () => <Skeleton lines={6} label="Loading chart" /> },
);

type Props = {
  check: RiskCheck;
  onTrySuggestion?: (request: PlanInput) => void;
  busy?: boolean;
  /** Dimmed while the form has moved on from what was checked. */
  stale?: boolean;
  footer?: ReactNode;
};

type Section = { id: string; title: string; summary: ReactNode; body: ReactNode };

// The closed fold says how it stands in a few words; the note itself is inside.
const REPAYMENT_SUMMARY = {
  none: "Clear: nothing late or overdue",
  watch: "Worth watching",
  warning: "Needs attention",
} as const;

/** The sections whose working is one tap away (ADR D-52), each with the figure that summarises it. */
function sections(check: RiskCheck): Section[] {
  const out: Section[] = [];
  const opinion = check.second_opinion;
  const started = check.check_type === "current_state";
  if (opinion) {
    out.push({
      id: "month",
      title: "Month by month",
      summary: stackSummary(opinion),
      body: <StackTable opinion={opinion} started={started} />,
    });
    out.push({
      id: "exposure",
      title: "Your BNPL exposure",
      summary: exposureSummary(opinion),
      body: <ExposureDetails opinion={opinion} started={started} />,
    });
  }
  out.push({
    id: "schedule",
    title: "Instalment schedule and cost",
    summary: `${plural(check.plan.num_installments, "instalment")}, total cost ${formatRm(check.plan.total_cost_sen)}`,
    body: <PlanPreviewPanel preview={check.plan} />,
  });
  if (check.with_plan_curve && check.without_curve) {
    const worst = check.with_plan_curve.cumulative_p10_sen.at(-1);
    out.push({
      id: "margin",
      title: "Margin with and without",
      summary:
        worst === undefined
          ? "Your running margin, with and without this purchase"
          : `A bad run of months ends at ${formatRm(worst)} with it`,
      body: (
        <>
          <CardCaption>Your running margin, with and without this purchase.</CardCaption>
          <div className="mt-3">
            <WithWithoutChart withPlan={check.with_plan_curve} without={check.without_curve} />
          </div>
        </>
      ),
    });
  }
  out.push({
    id: "repayment",
    title: "Repayment history",
    summary: REPAYMENT_SUMMARY[check.repayment.level],
    body: <RepaymentCard repayment={check.repayment} bare />,
  });
  if (check.simulated_probability !== null && check.probability !== null) {
    out.push({
      id: "numbers",
      title: "How the two numbers differ",
      summary: `Estimate ${formatPercent(check.probability)}, direct simulation ${formatPercent(check.simulated_probability)}`,
      body: (
        <p className="text-[13px] leading-relaxed text-ink-secondary">
          The estimate decides the band. It comes from a model trained on many simulations like
          this one; the simulation is the slower, direct calculation of this exact purchase, shown
          so you can see how close they are.
        </p>
      ),
    });
  }
  return out;
}

export function RiskResult({ check, onTrySuggestion, busy, stale = false, footer }: Props) {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  if (check.status !== "ok" || check.probability === null || !check.band || check.score === null) {
    return <LockedNote reason={check.lock_reason} monthsOfHistory={check.months_of_history} />;
  }
  const copy = BAND_COPY[check.band];
  const folds = sections(check);
  const allOpen = folds.every((f) => open.has(f.id));
  const toggle = (id: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  return (
    <div className={`space-y-4 ${stale ? "opacity-60" : ""}`} aria-busy={stale}>
      <Card className="flex flex-col items-center gap-5 sm:flex-row sm:gap-8">
        <ScoreRing score={check.score} band={check.band} caption="out of 100" />
        <div className="text-center sm:text-left">
          <div className="flex items-center justify-center gap-3 sm:justify-start">
            <Face band={check.band} size={56} />
            <BandBadge band={check.band} large />
          </div>
          <p className="mt-3 max-w-md text-[15px] leading-relaxed text-ink">{copy.line}</p>
          <p className="mt-2 text-[13px] text-ink-secondary">
            Estimated chance of running short: {formatPercent(check.probability)}.
            {check.simulated_probability !== null && (
              <>
                {" "}
                A direct simulation of this purchase gives{" "}
                {formatPercent(check.simulated_probability)}.
              </>
            )}
          </p>
        </div>
      </Card>
      {check.simulated_band && check.simulated_band !== check.band && (
        <Banner tone="info" title="The two methods put this in different bands">
          The estimate says {check.band} and the direct simulation says {check.simulated_band}. The
          band above is the estimate&apos;s; treat this purchase as close to the line.
        </Banner>
      )}
      <Notices items={riskNotices(check)} />
      {check.second_opinion && (
        <AddsCard
          opinion={check.second_opinion}
          started={check.check_type === "current_state"}
        />
      )}
      <Card>
        <CardTitle>Why</CardTitle>
        {check.factors.length > 0 ? (
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[14px] leading-relaxed text-ink">
            {check.factors.map((f) => (
              <li key={f.feature}>{f.text}</li>
            ))}
          </ul>
        ) : (
          <CardCaption>
            Nothing in your numbers stands out as pushing the risk up. The result reflects your
            overall pattern.
          </CardCaption>
        )}
      </Card>
      {check.suggestion && (
        <SuggestionCard suggestion={check.suggestion} onTry={onTrySuggestion} busy={busy} />
      )}
      <div className="flex items-center justify-between gap-3 pt-1">
        <h2 className="text-sm font-semibold text-ink">The working</h2>
        <button
          type="button"
          aria-pressed={allOpen}
          onClick={() => setOpen(allOpen ? new Set() : new Set(folds.map((f) => f.id)))}
          className="rounded-md px-2 py-1 text-[13px] font-semibold text-accent underline-offset-2 hover:underline"
        >
          {allOpen ? "Close all" : "Open all"}
        </button>
      </div>
      <div className="space-y-2.5">
        {folds.map((fold) => (
          <Fold
            key={fold.id}
            id={`risk-${fold.id}`}
            title={fold.title}
            summary={fold.summary}
            open={open.has(fold.id)}
            onToggle={() => toggle(fold.id)}
          >
            {fold.body}
          </Fold>
        ))}
      </div>
      {footer}
    </div>
  );
}
