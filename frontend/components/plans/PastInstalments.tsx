import type { PlanPreview } from "@/lib/api/queries";
import { formatDate } from "@/lib/format";
import { formatRm } from "@/lib/money";

type Props = {
  past: PlanPreview["installments"];
  /** The seqs the person says were paid. */
  paid: ReadonlySet<number>;
  onToggle: (seq: number) => void;
  logPayments: boolean;
  onLogChange: (value: boolean) => void;
  /** The preview is catching up with an edit: shown dimmed, and Save waits. */
  stale?: boolean;
};

/**
 * Shown only when the plan started before today. Whether those instalments were paid is a record:
 * it never changes the forecast or the risk check, which look at what is still to come.
 */
export function PastInstalments({
  past,
  paid,
  onToggle,
  logPayments,
  onLogChange,
  stale = false,
}: Props) {
  return (
    <fieldset
      className={`space-y-3 rounded-lg border border-line p-3 ${stale ? "opacity-60" : ""}`}
      aria-describedby="past-instalments-note"
    >
      <legend className="px-1 text-[13px] font-semibold text-ink">
        Instalments that already fell due
      </legend>
      <p id="past-instalments-note" className="text-[12px] text-ink-secondary">
        Tick the ones you have already paid. These are a record of the past and do not change what
        comes next: the forecast and the risk check look only at what is still left to pay.
      </p>
      <ul className="divide-y divide-line text-[13px]">
        {past.map((i) => (
          <li key={i.seq}>
            <label className="flex items-center justify-between gap-3 py-2">
              <span>
                Instalment {i.seq}, {formatDate(i.due_date)}, {formatRm(i.amount_sen)}
              </span>
              <span className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--color-accent)]"
                  checked={paid.has(i.seq)}
                  onChange={() => onToggle(i.seq)}
                />
                <span>Paid</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <label className="flex items-start gap-2 text-[13px]">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]"
          checked={logPayments}
          onChange={(event) => onLogChange(event.target.checked)}
        />
        <span>
          Also add these payments to my transactions
          <span className="block text-[12px] text-ink-secondary">
            Leave this off if they are already in a statement you imported, so they are not counted
            twice.
          </span>
        </span>
      </label>
    </fieldset>
  );
}
