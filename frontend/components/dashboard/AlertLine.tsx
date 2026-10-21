"use client";

import Link from "next/link";
import { useState } from "react";

import { useAlerts, type Alerts } from "@/lib/api/queries";

type Alert = Alerts["items"][number];

const GLYPH = { high: "▲", medium: "!" } as const;
const TONE = {
  high: "border-danger/30 bg-danger-bg text-danger",
  medium: "border-warning/30 bg-warning-bg text-warning",
} as const;

function Detail({ alert }: { alert: Alert }) {
  return (
    <p className="min-w-0 text-[13px] leading-snug text-ink">
      <span className="font-semibold">{alert.title}</span>.{" "}
      <span className="text-ink-secondary">{alert.detail}</span>
    </p>
  );
}

/**
 * What needs attention that the forecast card above does not already say (ADR D-52): an overdue
 * instalment, payments that fall close together, a provider limit nearly used. At most one slim
 * line, and nothing at all while it is loading, when the call fails, or when all is well, so it
 * can never show a wrong warning or add a card to a healthy dashboard.
 */
export function AlertLine() {
  const alerts = useAlerts();
  const [open, setOpen] = useState(false);
  const items = alerts.data?.items ?? [];
  const [first] = items;
  if (!first) return null;
  const worst = items.some((a) => a.severity === "high") ? "high" : "medium";
  const shell = `rounded-card border px-4 py-2.5 ${TONE[worst]}`;
  const glyph = (
    <span aria-hidden className="mt-0.5 w-4 shrink-0 text-center font-bold">
      {GLYPH[worst]}
    </span>
  );
  if (items.length === 1) {
    return (
      <div role="status" className={`flex items-start gap-3 ${shell}`}>
        {glyph}
        <div className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <Detail alert={first} />
          <Link href={first.href} className="shrink-0 text-[13px] font-semibold text-accent underline">
            See plans
          </Link>
        </div>
      </div>
    );
  }
  return (
    <div role="status" className={shell}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 text-left text-[13px] font-semibold"
      >
        {glyph}
        <span className="flex-1 text-ink">{items.length} things need your attention</span>
        <span className="text-accent underline">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <ul className="mt-2 space-y-2 border-t border-line/60 pt-2">
          {items.map((alert) => (
            <li key={`${alert.rule}-${alert.title}`} className="flex flex-wrap items-baseline justify-between gap-x-4">
              <Detail alert={alert} />
              <Link href={alert.href} className="shrink-0 text-[13px] font-semibold text-accent underline">
                See plans
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
