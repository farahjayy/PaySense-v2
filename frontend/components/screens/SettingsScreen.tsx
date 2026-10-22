"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";

import { ResetDialog } from "@/components/settings/ResetDialog";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card, CardCaption, CardTitle } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  useAccountSummary,
  useExportData,
  useResetAccount,
  type AccountScope,
} from "@/lib/api/queries";
import { restoreGettingStarted } from "@/lib/checklistStore";
import { saveBlob } from "@/lib/download";
import { todayIso } from "@/lib/format";
import { clearedSentence, SCOPE_LABEL, SCOPE_NOTE, SCOPES } from "@/lib/settings";

const TEMPLATE_HREF = "/paysense-import-template.csv";
const LINK_BUTTON =
  "inline-flex h-10 items-center rounded-lg border border-line bg-surface px-4 text-[13px] font-semibold text-ink hover:bg-surface-2";

type Dialogue = "clear" | "factory" | null;

/** Your own data and a few small preferences. Nothing here is a daily page. */
export function SettingsScreen() {
  const summary = useAccountSummary();
  const reset = useResetAccount();
  const exportData = useExportData();
  const [ticked, setTicked] = useState<ReadonlySet<AccountScope>>(new Set());
  const [dialogue, setDialogue] = useState<Dialogue>(null);
  const [done, setDone] = useState<string | null>(null);
  const doneBox = useRef<HTMLDivElement>(null);
  const inFlight = useRef(false); // a second Enter before the first request shows as pending

  const chosen = SCOPES.filter((s) => ticked.has(s));

  function toggle(scope: AccountScope) {
    setTicked((current) => {
      const next = new Set(current);
      if (!next.delete(scope)) next.add(scope);
      return next;
    });
  }

  function download(format: "csv" | "json") {
    exportData.mutate(format, {
      onSuccess: (blob) =>
        saveBlob(
          blob,
          format === "csv"
            ? `paysense-transactions-${todayIso()}.csv`
            : `paysense-data-${todayIso()}.json`,
        ),
    });
  }

  function openDialogue(kind: "clear" | "factory") {
    setDone(null); // last time's message must not sit beside a new question
    exportData.reset();
    setDialogue(kind);
  }

  function close() {
    setDialogue(null);
    reset.reset();
    exportData.reset();
  }

  function confirm() {
    const scopes = dialogue === "factory" ? [...SCOPES] : chosen;
    if (scopes.length === 0 || inFlight.current) return;
    inFlight.current = true;
    reset.mutate(scopes, {
      onSuccess: (result) => {
        setDone(clearedSentence(result.removed));
        setTicked(new Set());
        setDialogue(null);
        // the button that opened the dialog is now disabled, so put focus on the result
        requestAnimationFrame(() => doneBox.current?.focus());
      },
      onSettled: () => {
        inFlight.current = false;
      },
    });
  }

  const listId = useId();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title="Settings" intro="Your data, and a few small things that belong to you." />
      {done && (
        <div ref={doneBox} tabIndex={-1} className="outline-none">
          <Banner tone="success" title="Done">
            {done}
          </Banner>
        </div>
      )}

      <Card>
        <CardTitle>Download my data</CardTitle>
        <CardCaption>
          A copy to keep. The transactions file is in the import template&apos;s format, so you can
          import it back; the everything file holds your plans, recurring items, limits and
          categories as well (saved risk reports are not included).
        </CardCaption>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={exportData.isPending}
            onClick={() => download("csv")}
          >
            Download transactions (CSV)
          </Button>
          <Button
            variant="secondary"
            disabled={exportData.isPending}
            onClick={() => download("json")}
          >
            Download everything (JSON)
          </Button>
        </div>
        {exportData.error && dialogue === null && (
          <Banner tone="danger" className="mt-3" title="The download failed">
            {exportData.error.message}
          </Banner>
        )}
      </Card>

      <Card>
        <CardTitle>Clear my data</CardTitle>
        <CardCaption>
          Tick what to remove. Your account and username stay, and anything you leave unticked is
          untouched.
        </CardCaption>
        <fieldset className="mt-3 space-y-2">
          <legend className="sr-only">What to clear</legend>
          {SCOPES.map((scope) => (
            <label key={scope} className="flex items-start gap-2.5 text-[14px]">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-[var(--color-accent)]"
                checked={ticked.has(scope)}
                aria-labelledby={`${listId}-${scope}-name`}
                aria-describedby={`${listId}-${scope}-detail`}
                onChange={() => toggle(scope)}
              />
              <span>
                <span id={`${listId}-${scope}-name`} className="font-semibold text-ink">
                  {SCOPE_LABEL[scope]}
                </span>
                <span id={`${listId}-${scope}-detail`}>
                  <span className="ml-2 tabular-nums text-ink-secondary">
                    {summary.data ? summary.data[scope] : "…"}
                  </span>
                  {SCOPE_NOTE[scope] && (
                    <span className="block text-[12px] text-ink-secondary">
                      {SCOPE_NOTE[scope]}
                    </span>
                  )}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
        {summary.error && (
          <Banner tone="danger" className="mt-3" title="Your counts did not load">
            {summary.error.message}
            <span className="mt-2 block">
              <Button variant="secondary" size="sm" onClick={() => summary.refetch()}>
                Try again
              </Button>
            </span>
          </Banner>
        )}
        <div className="mt-4">
          <Button
            variant="dangerSoft"
            disabled={chosen.length === 0 || !summary.data}
            onClick={() => openDialogue("clear")}
          >
            Clear selected data…
          </Button>
        </div>
      </Card>

      <Card className="border-danger/40">
        <CardTitle>Factory reset</CardTitle>
        <CardCaption>
          Clears all of the above in one go and starts you from scratch, as on your first day,
          including the getting started checklist.
        </CardCaption>
        <div className="mt-3">
          <Button variant="danger" disabled={!summary.data} onClick={() => openDialogue("factory")}>
            Reset everything…
          </Button>
        </div>
      </Card>

      <Card>
        <CardTitle>Other</CardTitle>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={restoreGettingStarted}>
            Show the getting started checklist again
          </Button>
          <Link href="/categories" className={LINK_BUTTON}>
            Manage categories
          </Link>
          <a href={TEMPLATE_HREF} download className={LINK_BUTTON}>
            Download the import template
          </a>
        </div>
      </Card>

      <ResetDialog
        open={dialogue !== null}
        factory={dialogue === "factory"}
        scopes={dialogue === "factory" ? [...SCOPES] : chosen}
        counts={summary.data}
        pending={reset.isPending}
        error={reset.error?.message ?? null}
        onClose={close}
        onConfirm={confirm}
        onDownload={download}
        downloading={exportData.isPending}
        downloadError={exportData.error?.message ?? null}
      />
    </div>
  );
}
