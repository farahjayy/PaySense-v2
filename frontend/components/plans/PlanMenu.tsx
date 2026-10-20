"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  planName: string;
  onDelete: () => void;
};

/** The rarely used, destructive action lives behind a "⋯" so it never competes with the card. */
export function PlanMenu({ planName, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        ref={trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`More actions, ${planName}`}
        onClick={() => setOpen(!open)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface text-[16px] leading-none text-ink hover:bg-surface-2"
      >
        <span aria-hidden>⋯</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-10 mt-1 min-w-[9rem] rounded-lg border border-line bg-surface p-1 shadow-md"
        >
          <button
            type="button"
            role="menuitem"
            aria-label={`Delete plan, ${planName}`}
            autoFocus
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
            className="w-full rounded-md px-3 py-2 text-left text-[13px] font-semibold text-danger hover:bg-danger-bg"
          >
            Delete plan
          </button>
        </div>
      )}
    </div>
  );
}
