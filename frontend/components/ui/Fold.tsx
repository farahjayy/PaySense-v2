"use client";

import { useState, type ReactNode } from "react";

type Props = {
  /** Used to tie the button to the region it controls. */
  id: string;
  title: string;
  /** One line that stays visible when the fold is closed, carrying the section's key figure. */
  summary: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
};

/**
 * A section whose working is one tap away (ADR D-52). Closed, it still states its key figure, so a
 * closed fold reads as evidence rather than as something hidden. The body mounts the first time
 * it opens and stays mounted (hidden) after that, so a chart is not rebuilt on every tap and
 * nothing the person opened is lost by closing it.
 */
export function Fold({ id, title, summary, open, onToggle, children }: Props) {
  const [opened, setOpened] = useState(open);
  if (open && !opened) setOpened(true);
  const headingId = `${id}-title`;
  const regionId = `${id}-body`;
  return (
    <section className="rounded-card border border-line bg-surface">
      <h3 id={headingId} className="text-sm font-semibold text-ink">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={regionId}
          onClick={onToggle}
          className="flex w-full items-center justify-between gap-4 rounded-card px-4 py-3.5 text-left transition-colors hover:bg-surface-2 sm:px-5"
        >
          <span className="min-w-0">
            <span className="block">{title}</span>
            <span className="mt-0.5 block text-[13px] font-normal leading-snug text-ink-secondary">
              {summary}
            </span>
          </span>
          <svg
            aria-hidden
            viewBox="0 0 20 20"
            className={`h-4 w-4 shrink-0 text-accent transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
          >
            <path
              d="M5 8l5 5 5-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </h3>
      <div
        id={regionId}
        role="region"
        aria-labelledby={headingId}
        hidden={!open}
        className="border-t border-line px-4 pb-4 pt-3 sm:px-5"
      >
        {opened && children}
      </div>
    </section>
  );
}
