"use client";

import { CADENCE_LABEL } from "@/components/recurring/RecurringForm";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import type { RecurringItem } from "@/lib/api/queries";
import { formatRm } from "@/lib/money";

type Props = {
  /** The item already in the list; null keeps the dialog closed. */
  existing: RecurringItem | null;
  saving: boolean;
  error: string | null;
  onKeep: () => void;
  onAddAnother: () => void;
};

/** Asked before a second copy of an item is added: counted twice, that money moves twice. */
export function DuplicateItemDialog({ existing, saving, error, onKeep, onAddAnother }: Props) {
  return (
    <Dialog
      open={existing !== null}
      title="You already have this one"
      onClose={onKeep}
      dismissible={!saving}
    >
      {existing && (
        <div className="space-y-4">
          <p className="text-[13px] text-ink-secondary">
            {existing.name}, {formatRm(existing.amount_sen)},{" "}
            {CADENCE_LABEL[existing.cadence].toLowerCase()}, is already in your list. If you add it
            again, your forecast counts that money twice. Add another one anyway?
          </p>
          {error && (
            <Banner tone="danger" title="Not added">
              {error}
            </Banner>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" disabled={saving} onClick={onKeep}>
              Don&apos;t add
            </Button>
            <Button variant="accent" disabled={saving} onClick={onAddAnother}>
              {saving ? "Adding…" : "Add another"}
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
