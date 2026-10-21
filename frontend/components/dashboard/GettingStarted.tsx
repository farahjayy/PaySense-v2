"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/Button";
import { Card, CardCaption, CardTitle } from "@/components/ui/Card";
import { Face } from "@/components/ui/Face";
import { useForecast, usePlans, useProviderLimits, useRecurringItems } from "@/lib/api/queries";
import {
  checklistHidden,
  hideGettingStarted,
  restoreGettingStarted,
  subscribeToChecklist,
} from "@/lib/checklistStore";
import { gettingStartedSteps } from "@/lib/onboarding";

/**
 * The route from an empty app to a first risk check, ticking itself off from what the person has
 * actually done. It shows nothing while it is unsure (loading, or a failed call) and goes away when
 * every step is done, so it never shows a wrong checklist or nags a finished student. A student who
 * will never do every step (no BNPL, so no limits and no plans) can hide it; the choice is kept in
 * this browser only.
 */
export function GettingStarted() {
  const stored = useSyncExternalStore(subscribeToChecklist, checklistHidden, () => false);
  const [hiddenNow, setHiddenNow] = useState(false); // covers a browser that will not store it
  const hidden = stored || hiddenNow;
  function hide() {
    setHiddenNow(true); // hidden for this visit even if the browser will not keep the choice
    hideGettingStarted();
  }
  function show() {
    setHiddenNow(false); // also covers a browser that would not keep the choice
    restoreGettingStarted();
  }
  const forecast = useForecast();
  const recurring = useRecurringItems();
  const limits = useProviderLimits();
  const plans = usePlans();

  if (!forecast.data || !recurring.data || !limits.data || !plans.data) return null;
  const steps = gettingStartedSteps({
    monthsOfHistory: forecast.data.months_of_history,
    recurringCount: recurring.data.length,
    limitsRecorded: limits.data.filter((l) => l.limit_sen !== null).length,
    forecastReady: forecast.data.status === "ok",
    riskChecked: plans.data.some((p) => p.risk_score_at_creation !== null),
  });
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;
  if (hidden) {
    return (
      <p className="flex items-center gap-2 text-[13px] text-ink-secondary">
        The getting started checklist is hidden.
        <button
          type="button"
          onClick={show}
          className="font-semibold text-accent underline-offset-2 hover:underline"
        >
          Show getting started
        </button>
      </p>
    );
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Face band="Hello" size={40} />
          <div>
            <CardTitle>Getting started</CardTitle>
            <CardCaption>
              {done} of {steps.length} done
            </CardCaption>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={hide}>
          Hide this
        </Button>
      </div>
      <ol aria-label="Getting started steps" className="mt-4 space-y-3.5">
        {steps.map((step) => (
          <li key={step.id} className="flex gap-3">
            <span
              aria-hidden
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold ${
                step.done
                  ? "border-success bg-success-bg text-success"
                  : "border-field bg-surface text-ink-muted"
              }`}
            >
              {step.done ? "✓" : ""}
            </span>
            <span className="sr-only">{step.done ? "Done" : "To do"}</span>
            <div className="min-w-0 flex-1">
              <p
                className={`text-[14px] font-medium ${step.done ? "text-ink-secondary" : "text-ink"}`}
              >
                {step.title}
                {step.detail && (
                  <span className="ml-2 text-[12px] font-normal text-ink-secondary">
                    {step.detail}
                  </span>
                )}
              </p>
              {!step.done && (
                <>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-ink-secondary">
                    {step.why}
                  </p>
                  {step.href && (
                    <Link
                      href={step.href}
                      className="mt-1 inline-block text-[13px] font-semibold text-accent underline-offset-2 hover:underline"
                    >
                      {step.action ?? "Open"}
                    </Link>
                  )}
                </>
              )}
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}
