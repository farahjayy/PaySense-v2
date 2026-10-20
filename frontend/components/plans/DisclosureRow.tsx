import type { ReactNode } from "react";

type Props = {
  open: boolean;
  onToggle: () => void;
  /** The id of the panel this row opens. */
  controls: string;
  children: ReactNode;
};

/** A full-width row that opens its panel in place, so the card shows two rows instead of a pile of buttons. */
export function DisclosureRow({ open, onToggle, controls, children }: Props) {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={controls}
      onClick={onToggle}
      className="flex w-full items-center justify-between gap-3 rounded-lg border border-line bg-surface px-3 py-2.5 text-left text-[13px] font-semibold text-ink hover:bg-surface-2"
    >
      <span className="flex min-w-0 items-center gap-2">{children}</span>
      <span
        aria-hidden
        className={`shrink-0 text-ink-secondary transition-transform ${open ? "rotate-180" : ""}`}
      >
        ⌄
      </span>
    </button>
  );
}
