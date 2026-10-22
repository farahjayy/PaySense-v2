"use client";

import { useSyncExternalStore } from "react";

import { currentTheme, subscribeToTheme, toggleTheme, type Theme } from "@/lib/theme";

const ICON_PROPS = {
  width: 15,
  height: 15,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

function MoonIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

const SIDE = "relative z-10 flex flex-1 items-center justify-center gap-1.5 px-1 text-[11px] sm:px-3 font-bold tracking-wider transition-colors motion-reduce:transition-none";

/**
 * Light or dark: one pill with a DARK side and a LIGHT side and a black thumb that slides to the
 * side that is on (ADR D-59, replacing the round button of D-58). It is still a single toggle
 * button: its name stays "Dark mode" and `aria-pressed` says whether it is on, while the visible
 * words and icons are hidden from assistive technology so a screen reader hears one control, not
 * two labels. On a phone only the icons show. The server snapshot is light; the page already
 * carries the right attribute before it hydrates (see the script in app/layout.tsx), so the
 * thumb catches up at once.
 */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeToTheme, currentTheme, (): Theme => "light");
  const dark = theme === "dark";
  return (
    <button
      type="button"
      aria-pressed={dark}
      data-mode={theme}
      onClick={toggleTheme}
      className="relative inline-flex h-9 w-[3.75rem] shrink-0 items-center rounded-full border border-line bg-surface p-[3px] text-ink-secondary sm:w-[10rem]"
    >
      <span className="sr-only">Dark mode</span>
      <span
        data-thumb
        aria-hidden="true"
        className={`absolute inset-y-[3px] left-[3px] z-0 w-[calc(50%-3px)] rounded-full bg-switch-thumb shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2),inset_0_1px_0_rgba(255,255,255,0.18),0_2px_6px_rgba(0,0,0,0.25)] transition-transform duration-200 ease-out motion-reduce:transition-none ${
          dark ? "" : "translate-x-full"
        }`}
      />
      <span aria-hidden="true" className={`${SIDE} ${dark ? "text-on-switch" : ""}`}>
        <MoonIcon />
        <span className="hidden sm:inline">DARK</span>
      </span>
      <span aria-hidden="true" className={`${SIDE} ${dark ? "" : "text-on-switch"}`}>
        <SunIcon />
        <span className="hidden sm:inline">LIGHT</span>
      </span>
    </button>
  );
}
