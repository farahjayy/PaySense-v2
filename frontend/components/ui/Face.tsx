import type { ReactNode } from "react";

import type { Band } from "@/lib/format";

/**
 * The three result faces from the login page: pastel tiles with a dark face, the same colours in
 * light and dark mode (ADR D-58), so on a dark surface they stand out like stickers instead of
 * turning into muddy dark shades.
 */

export type FaceKind = Band | "Hello" | "Locked";

const TONE = {
  Hello: "text-face-ink",
  Locked: "text-face-locked",
  Safe: "text-face-safe",
  Caution: "text-face-caution",
  "At Risk": "text-face-risk",
} as const;

const TILE = {
  Hello: "fill-rosy",
  Locked: "fill-face-locked-bg",
  Safe: "fill-face-safe-bg",
  Caution: "fill-face-caution-bg",
  "At Risk": "fill-face-risk-bg",
} as const;

const SHAPES: Record<FaceKind, ReactNode> = {
  Hello: (
    <>
      <circle cx="35" cy="42" r="5.5" fill="currentColor" />
      <circle cx="65" cy="42" r="5.5" fill="currentColor" />
      <path
        d="M32 59q18 18 36 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="5.5"
        strokeLinecap="round"
      />
    </>
  ),
  // X_X: nothing to read yet, so no band face. Crossed-out eyes and a flat mouth.
  Locked: (
    <>
      <path
        d="M27 36l15 15M42 36L27 51M58 36l15 15M73 36L58 51"
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M36 70h28"
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </>
  ),
  Safe: (
    <>
      <circle cx="35" cy="43" r="5" fill="currentColor" />
      <circle cx="65" cy="43" r="5" fill="currentColor" />
      <path
        d="M34 60q16 15 32 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <circle cx="23" cy="58" r="6" fill="currentColor" fillOpacity=".18" />
      <circle cx="77" cy="58" r="6" fill="currentColor" fillOpacity=".18" />
    </>
  ),
  Caution: (
    <>
      <circle cx="35" cy="45" r="5" fill="currentColor" />
      <circle cx="65" cy="45" r="5" fill="currentColor" />
      <path d="M27 33l15-3" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
      <path
        d="M36 66q7-5 14 0t14 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  "At Risk": (
    <>
      <circle cx="35" cy="47" r="5" fill="currentColor" />
      <circle cx="65" cy="47" r="5" fill="currentColor" />
      <path
        d="M27 38l15-7M73 38l-15-7"
        stroke="currentColor"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      <path
        d="M38 69q12-9 24 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path d="M80 28q5 7 0 11-5-4 0-11z" fill="currentColor" fillOpacity=".55" />
    </>
  ),
};

/** Decorative: the band's name is always written next to it. */
export function Face({ band, size = 48 }: { band: FaceKind; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden="true"
      className={`shrink-0 ${TONE[band]}`}
    >
      <rect className={TILE[band]} width="100" height="100" rx="30" />
      {SHAPES[band]}
    </svg>
  );
}
