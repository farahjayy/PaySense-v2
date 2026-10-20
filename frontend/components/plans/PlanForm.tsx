"use client";

import { useEffect, useMemo, useState } from "react";

import { PlanFields } from "@/components/plans/PlanFields";
import { PastInstalments } from "@/components/plans/PastInstalments";
import { PlanPreviewPanel } from "@/components/plans/PlanPreviewPanel";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { useCreatePlan, usePreviewPlan, useProviders } from "@/lib/api/queries";
import { plural, todayIso } from "@/lib/format";
import { formatRm } from "@/lib/money";
import { emptyDraft, pastInstalments, toPlanInput, type PlanDraft } from "@/lib/plans";

const DEBOUNCE_MS = 350;

const instalmentKey = (i: { seq: number; due_date: string }) => `${i.seq}:${i.due_date}`;

type Props = {
  onSaved: () => void;
  onCancel: () => void;
  /** Tells the dialog around the form not to close while the plan is being saved. */
  onSavingChange?: (saving: boolean) => void;
};

/** Enter a purchase; the server previews the split and schedule as you type; save when it looks right. */
export function PlanForm({ onSaved, onCancel, onSavingChange }: Props) {
  const providers = useProviders();
  const preview = usePreviewPlan();
  const create = useCreatePlan();
  const [today] = useState(() => todayIso());
  const [draft, setDraft] = useState<PlanDraft>(() => emptyDraft(today));
  // Past instalments count as paid unless unticked. An untick belongs to that instalment on that
  // day, so when the schedule moves the new instalments start out paid again.
  const [unpaid, setUnpaid] = useState<ReadonlySet<string>>(new Set());
  const [logPayments, setLogPayments] = useState(false);

  const provider = providers.data?.find((p) => p.key === draft.provider);
  const input = useMemo(() => toPlanInput(draft, provider), [draft, provider]);
  const inputKey = JSON.stringify(input);
  const { mutate: requestPreview, reset: resetPreview } = preview;
  // The preview on screen belongs to the input it was computed for; once the form moves on, Save
  // waits for the next one so what is saved is always what was shown.
  const previewIsCurrent =
    preview.data !== undefined && JSON.stringify(preview.variables) === inputKey;
  const savingNow = create.isPending;
  useEffect(() => onSavingChange?.(savingNow), [savingNow, onSavingChange]);

  useEffect(() => {
    if (!input) {
      resetPreview();
      return;
    }
    const timer = setTimeout(() => requestPreview(input), DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // `inputKey` stands for `input`: re-run only when its contents change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputKey, requestPreview, resetPreview]);

  function set<K extends keyof PlanDraft>(key: K, value: PlanDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    create.reset();
  }

  // Kept on screen while the preview catches up with an edit; Save waits for a current one.
  const past = useMemo(
    () => (input && preview.data ? pastInstalments(preview.data.installments, today) : []),
    [input, preview.data, today],
  );
  const paid = new Set(past.filter((i) => !unpaid.has(instalmentKey(i))).map((i) => i.seq));

  function toggleInstalment(seq: number) {
    const instalment = past.find((i) => i.seq === seq);
    if (!instalment) return;
    const key = instalmentKey(instalment);
    setUnpaid((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });
    create.reset();
  }

  function save(body: NonNullable<typeof input>) {
    create.mutate(
      {
        ...body,
        paid_seqs: [...paid].sort((a, b) => a - b),
        log_payments: logPayments && paid.size > 0,
      },
      { onSuccess: onSaved },
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (input && previewIsCurrent && !create.isPending) save(input);
      }}
    >
      <PlanFields draft={draft} set={set} providers={providers.data ?? []} />

      {providers.error && (
        <Banner tone="danger" title="Providers did not load">
          {providers.error.message}
        </Banner>
      )}
      <p role="status" className="text-[13px] text-ink-secondary">
        {!input
          ? "Fill in the purchase to see the schedule."
          : previewIsCurrent && preview.data
            ? `Pay ${formatRm(preview.data.cash_at_purchase_sen)} at checkout, then ${formatRm(
                preview.data.total_payable_sen,
              )} over ${plural(preview.data.installments.length, "instalment")}.`
            : preview.error
              ? ""
              : "Working it out…"}
      </p>
      {preview.data && input && (
        <PlanPreviewPanel preview={preview.data} stale={!previewIsCurrent} />
      )}
      {past.length > 0 && (
        <PastInstalments
          past={past}
          paid={paid}
          onToggle={toggleInstalment}
          logPayments={logPayments}
          onLogChange={(value) => {
            setLogPayments(value);
            create.reset();
          }}
          stale={!previewIsCurrent}
        />
      )}
      {preview.error && (
        <Banner tone="warning" title="We could not work this out yet">
          {preview.error.message}
        </Banner>
      )}
      {create.error && (
        <Banner tone="danger" title="Not saved">
          {create.error.message}
        </Banner>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={create.isPending}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="accent"
          disabled={!input || !previewIsCurrent || create.isPending}
        >
          {create.isPending ? "Saving…" : "Save plan"}
        </Button>
      </div>
    </form>
  );
}
