import Link from "next/link";

import { Banner } from "@/components/ui/Banner";
import { Card, CardCaption, CardTitle } from "@/components/ui/Card";
import { formatMonth, formatPercent, plural } from "@/lib/format";
import { formatRm } from "@/lib/money";
import { formatPoints, pointsAdded, visibleMonths, type SecondOpinion } from "@/lib/secondOpinion";

function Tile({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-center">
      <p className="text-[12px] text-ink-secondary">{label}</p>
      <p
        className={`mt-0.5 tabular-nums text-ink ${strong ? "text-xl font-bold" : "text-lg font-semibold"}`}
      >
        {value}
      </p>
    </div>
  );
}

/**
 * What this one purchase adds (ADR D-51): the chance of running short without it, with it, and
 * the points between. All three come from one simulation with one seed, so they can differ a few
 * points from the headline estimate. Every figure is the server's.
 */
export function AddsCard({
  opinion,
  started = false,
}: {
  opinion: SecondOpinion;
  started?: boolean;
}) {
  return (
    <Card>
      <CardTitle>{started ? "What this plan adds" : "What this purchase adds"}</CardTitle>
      <CardCaption>
        A direct test of your coming months, run without and with{" "}
        {started ? "what is still owed on this plan" : "this purchase"}. It can differ a few points
        from the risk model&apos;s estimate above.
      </CardCaption>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Tile label="Without it" value={formatPercent(opinion.without_probability)} />
        <Tile label="With it" value={formatPercent(opinion.with_probability)} />
        <Tile label="Adds" value={formatPoints(pointsAdded(opinion))} strong />
      </div>
      <p className="mt-2 text-[12px] text-ink-muted">
        The chance of running short is how often your running total dips below RM 0 across the many
        ways we tried your coming months.
      </p>
      {opinion.already_at_risk && (
        <Banner
          tone="warning"
          title={`You are already At Risk without this ${started ? "plan" : "purchase"}`}
          className="mt-3"
        >
          Your chance of running short is {formatPercent(opinion.without_probability)} before you{" "}
          {started ? "add it" : "buy anything"}, so {started ? "the plan" : "the purchase"} is not
          the only thing to look at.
        </Banner>
      )}
    </Card>
  );
}

/** Every unpaid instalment across providers, by month, with this purchase added. */
export function StackTable({
  opinion,
  started = false,
}: {
  opinion: SecondOpinion;
  started?: boolean;
}) {
  const { months, hidden } = visibleMonths(opinion);
  const lastShown = opinion.stack.at(-1)?.month;
  return (
    <div>
      <p className="text-[12px] leading-relaxed text-ink-secondary">
        Every unpaid instalment across your providers, with this {started ? "plan" : "purchase"}{" "}
        added. Anything overdue counts in this month.
        {hidden > 0 &&
          ` ${plural(hidden, "month")} with nothing due and no confirmed income ${hidden === 1 ? "is" : "are"} left out.`}
        {opinion.beyond_sen > 0 &&
          lastShown &&
          ` ${formatRm(opinion.beyond_sen)} more falls due after ${formatMonth(lastShown)}.`}
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[30rem] text-left text-[13px]">
          <caption className="sr-only">What you owe each month</caption>
          <thead className="text-[12px] text-ink-secondary">
            <tr className="border-b border-line">
              <th scope="col" className="py-1.5 pr-3 font-medium">
                Month
              </th>
              <th scope="col" className="py-1.5 pr-3 font-medium">
                Already owed
              </th>
              <th scope="col" className="py-1.5 pr-3 text-right font-medium">
                {started ? "This plan" : "This purchase"}
              </th>
              <th scope="col" className="py-1.5 pr-3 text-right font-medium">
                Total
              </th>
              <th scope="col" className="py-1.5 text-right font-medium">
                Confirmed income
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {months.map((m) => (
              <tr key={m.month}>
                <th scope="row" className="py-2 pr-3 font-medium text-ink">
                  {formatMonth(m.month)}
                </th>
                <td className="py-2 pr-3 text-ink-secondary">
                  {m.by_provider.length === 0
                    ? "Nothing"
                    : m.by_provider.map((p) => (
                        <span key={p.provider_label} className="block tabular-nums">
                          {p.provider_label} {formatRm(p.amount_sen)}
                        </span>
                      ))}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {m.new_plan_sen > 0 ? formatRm(m.new_plan_sen) : "–"}
                </td>
                <td className="py-2 pr-3 text-right font-semibold tabular-nums">
                  {formatRm(m.total_sen)}
                </td>
                <td className="py-2 text-right tabular-nums text-ink-secondary">
                  {m.known_income_sen > 0 ? formatRm(m.known_income_sen) : "None confirmed"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** What is owed across all providers before and after, and the recorded limits beside the Bank
 * Negara line, shown as information about the person's own limits and never as a judgement. */
export function ExposureDetails({
  opinion,
  started = false,
}: {
  opinion: SecondOpinion;
  started?: boolean;
}) {
  const { exposure } = opinion;
  return (
    <div className="space-y-1.5 text-[14px] leading-relaxed text-ink">
      <p>
        Unpaid across all providers: {formatRm(exposure.unpaid_before_sen)} to{" "}
        {formatRm(exposure.unpaid_after_sen)} with this {started ? "plan" : "purchase"}.
      </p>
      <p>
        {plural(exposure.providers_before.length, "provider")} to {exposure.providers_after.length},{" "}
        {plural(exposure.plans_before, "plan")} to {exposure.plans_after}.
      </p>
      {exposure.recorded_limits_sen !== null ? (
        <p>
          Your recorded limits add up to {formatRm(exposure.recorded_limits_sen)}. That is{" "}
          {exposure.reaches_bnm_line ? "at or above" : "below"} {formatRm(exposure.bnm_line_sen)}, the
          combined BNPL limit at which Bank Negara Malaysia&apos;s 2025 policy on personal financing
          asks banks that offer BNPL to run a full affordability assessment.
        </p>
      ) : (
        <p className="text-ink-secondary">
          Record your provider limits on the{" "}
          <Link href="/plans" className="font-medium text-accent hover:underline">
            Plans page
          </Link>{" "}
          to see them added up against the {formatRm(exposure.bnm_line_sen)} level Bank Negara
          Malaysia uses.
        </p>
      )}
      <p className="text-[12px] text-ink-muted">
        Shown as information about your own limits, not a judgement on any provider.
      </p>
    </div>
  );
}
