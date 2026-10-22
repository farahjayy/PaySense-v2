"use client";

import { useSyncExternalStore } from "react";

import { currentTheme, subscribeToTheme, toggleTheme, type Theme } from "@/lib/theme";

/**
 * Light or dark, in the top bar (ADR D-58). A toggle button: its name stays "Dark mode" and
 * `aria-pressed` says whether it is on, so a screen reader hears the state rather than an action
 * that changes under it. The server snapshot is light; the page already carries the right
 * attribute before it hydrates (see the script in app/layout.tsx), so the button catches up at
 * once.
 */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeToTheme, currentTheme, (): Theme => "light");
  const dark = theme === "dark";
  return (
    <button
      type="button"
      aria-pressed={dark}
      onClick={toggleTheme}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${
        dark
          ? "border-accent/40 bg-accent-bg text-accent"
          : "border-line bg-surface text-ink-secondary hover:bg-surface-2"
      }`}
    >
      <span className="sr-only">Dark mode</span>
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill={dark ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
    </button>
  );
}
