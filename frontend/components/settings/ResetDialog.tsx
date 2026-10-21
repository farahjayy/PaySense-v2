"use client";

import { useId, useState } from "react";

import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import type { AccountScope, AccountSummary } from "@/lib/api/queries";
import { countPhrase } from "@/lib/settings";

const WORD = "RESET";

type Props = {
  open: boolean;
  scopes: AccountScope[];
  counts: AccountSummary | undefined;
  /** Everything is being cleared, so this is the factory reset. */
  factory: boolean;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
  onDownload: (format: "csv" | "json") => void;
  /** A copy is being prepared; the buttons wait so a click is never repeated. */
  downloading: boolean;
  /** The copy could not be made. Said here, because the page behind the dialog is out of reach. */
  downloadError: string | null;
};

/** What is about to go, a reminder to keep a copy, and the word that has to be typed. */
export function ResetDialog({ open, ...rest }: Props) {
  return (
    <Dialog
      open={open}
      title={rest.factory ? "Reset everything?" : "Clear this data?"}
      onClose={rest.onClose}
      dismissible={!rest.pending}
    >
      {open && <Body {...rest} />}
    </Dialog>
  );
}

function Body({
  scopes,
  counts,
  factory,
  pending,
  error,
  onClose,
  onConfirm,
  onDownload,
  downloading,
  downloadError,
}: Omit<Props, "open">) {
  const [typed, setTyped] = useState("");
  const fieldId = useId();
  const keepsPayments = scopes.includes("plans") && !scopes.includes("transactions");
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (typed === WORD && !pending) onConfirm();
      }}
    >
      {factory && (
        <p className="text-[13px] text-ink">
          This is a factory reset: it starts you from scratch, as on your first day. Your account
          and username stay.
        </p>
      )}
      <div>
        <p className="text-[13px] font-semibold text-ink">This will permanently remove:</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[13px] text-ink">
          {scopes.map((scope) => (
            <li key={scope}>{counts ? countPhrase(scope, counts[scope]) : scope}</li>
          ))}
        </ul>
        {keepsPayments && (
          <p className="mt-2 text-[12px] text-ink-secondary">
            The payments those plans logged stay in your transactions. Clear transactions too to
            remove them.
          </p>
        )}
      </div>
      <Banner tone="warning" title="This cannot be undone">
        Download a copy first if you might want any of it back.
      </Banner>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={downloading}
          onClick={() => onDownload("csv")}
        >
          Download transactions (CSV)
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={downloading}
          onClick={() => onDownload("json")}
        >
          Download everything (JSON)
        </Button>
      </div>
      {downloadError && (
        <Banner tone="danger" title="The copy could not be made">
          {downloadError}
        </Banner>
      )}
      <div className="flex flex-col gap-1.5">
        <label htmlFor={fieldId} className="text-xs font-medium text-ink-secondary">
          Type {WORD} to confirm
        </label>
        <input
          id={fieldId}
          data-autofocus
          autoComplete="off"
          spellCheck={false}
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          className="h-10 rounded-lg border border-field bg-surface px-3.5 text-[14px] text-ink"
        />
      </div>
      {error && (
        <Banner tone="danger" title="Not cleared">
          {error}
        </Banner>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" variant="danger" disabled={typed !== WORD || pending}>
          {pending ? "Clearing…" : factory ? "Reset everything" : "Clear data"}
        </Button>
      </div>
    </form>
  );
}
