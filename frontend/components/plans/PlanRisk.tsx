"use client";

import Link from "next/link";
import { useState } from "react";

import { BandBadge } from "@/components/ui/BandBadge";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Face } from "@/components/ui/Face";
import { Skeleton } from "@/components/ui/States";
import { useRiskReport, type Plan, type RiskCheck } from "@/lib/api/queries";
import { BAND_COPY, formatDate, formatPercent } from "@/lib/format";

const MAX_REASONS = 3;

/**
 * The risk check taken the day the plan was added, kept with the plan. It is a snapshot: it does
 * not change when the ledger does, and there is no "check again" here; a new purchase gets a new
 * check on the Risk check page.
 */
export function PlanRisk({ plan }: { plan: Plan }) {
  const [open, setOpen] = useState(false);
  const reportId = plan.risk_check_id;
  const report = useRiskReport(reportId ?? "", open && reportId !== null);

  if (reportId === null) {
    return (
      <p className="mt-3 text-[12px] text-ink-secondary">No risk check was taken for this plan.</p>
    );
  }

  return (
    <div className="mt-3">
      <Button
        variant="secondary"
        size="sm"
        aria-expanded={open}
        aria-controls={`analysis-${plan.id}`}
        onClick={() => setOpen(!open)}
      >
        {plan.risk_band && (
          <span className="mr-2 inline-flex">
            <Face band={plan.risk_band} size={20} />
          </span>
        )}
        Analysis from {formatDate(plan.added_on)}
        {plan.risk_band && <span className="sr-only">, {plan.risk_band}</span>}
      </Button>
      <div id={`analysis-${plan.id}`}>
        {open &&
          (report.isPending ? (
            <Skeleton lines={3} label="Loading the analysis" />
          ) : report.isError ? (
            <Banner tone="danger" className="mt-3" title="The analysis did not load">
              {report.error.message}
            </Banner>
          ) : (
            <Analysis plan={plan} check={report.data} reportId={reportId} />
          ))}
      </div>
    </div>
  );
}

function Analysis({ plan, check, reportId }: { plan: Plan; check: RiskCheck; reportId: string }) {
  const band = check.band;
  return (
    <div className="mt-3 space-y-3 rounded-lg border border-line p-3 text-[13px]">
      <p className="text-ink-secondary">
        Checked on {formatDate(plan.added_on)}, when you added it.
        {check.check_type === "current_state" &&
          " It covers only what was still left to pay; the instalments already due are a record and were not counted."}
      </p>
      {check.status === "ok" && band && check.probability !== null ? (
        <>
          <div className="flex items-center gap-3">
            <Face band={band} size={48} />
            <div>
              <BandBadge band={band} />
              <p className="mt-1 text-ink">{BAND_COPY[band].line}</p>
              <p className="text-ink-secondary">
                Estimated chance of running short: {formatPercent(check.probability)}.
              </p>
            </div>
          </div>
          {check.factors.length > 0 && (
            <div>
              <h3 className="font-semibold text-ink">Why</h3>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-ink">
                {check.factors.slice(0, MAX_REASONS).map((f) => (
                  <li key={f.feature}>{f.text}</li>
                ))}
              </ul>
            </div>
          )}
          {check.suggestion?.status === "found" && check.suggestion.changes.length > 0 && (
            <div>
              <h3 className="font-semibold text-ink">The smallest change that would have helped</h3>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-ink">
                {check.suggestion.changes.map((c) => (
                  <li key={`${c.kind}-${c.label}`}>{c.label}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        <p className="text-ink">
          There was not enough history to check this plan when it was added.
        </p>
      )}
      <Link
        href={`/risk/${reportId}`}
        className="inline-block font-medium text-accent hover:underline"
      >
        Open the full report
      </Link>
    </div>
  );
}
