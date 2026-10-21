"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { BrandMark } from "@/components/ui/BrandMark";
import { Button } from "@/components/ui/Button";
import { Face } from "@/components/ui/Face";

type Slide = { title: string; text: string; picture: ReactNode };

/** A forecast line drawing forward into a range, as on the welcome page. */
function ForecastPicture() {
  return (
    <svg viewBox="0 0 320 180" className="w-full max-w-72" aria-hidden>
      <line x1="10" y1="160" x2="310" y2="160" stroke="var(--color-line)" strokeWidth="3" />
      <path d="M170 98 L310 50 L310 146 Z" fill="var(--color-chart-blue)" opacity=".45" />
      <path
        d="M10 124 L45 112 L80 120 L115 96 L150 103 L170 98 L230 86 L310 98"
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line x1="170" y1="24" x2="170" y2="160" stroke="var(--color-ink-muted)" strokeDasharray="4 5" />
      <circle cx="170" cy="98" r="8" fill="var(--color-rosy)" />
    </svg>
  );
}

function FacesPicture() {
  return (
    <div className="flex items-end gap-3" aria-hidden>
      {(["Safe", "Caution", "At Risk"] as const).map((band, i) => (
        <div key={band} className={`flex flex-col items-center gap-2 ${i === 1 ? "mb-3" : ""}`}>
          <Face band={band} size={72} />
          <span className="rounded-full bg-surface px-2.5 py-0.5 text-[12px] font-semibold text-ink">
            {band}
          </span>
        </div>
      ))}
    </div>
  );
}

function ControlPicture() {
  return (
    <svg viewBox="0 0 180 180" className="w-40" aria-hidden>
      <circle cx="90" cy="90" r="46" fill="var(--color-accent)" />
      <path
        d="M68 92 L84 108 L114 74"
        fill="none"
        stroke="var(--color-page)"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {[0, 60, 120, 180, 240, 300].map((deg) => (
        <circle
          key={deg}
          cx={90 + 72 * Math.cos((deg * Math.PI) / 180)}
          cy={90 + 72 * Math.sin((deg * Math.PI) / 180)}
          r="5"
          fill={deg % 120 === 0 ? "var(--color-rosy)" : "var(--color-chart-edge)"}
        />
      ))}
    </svg>
  );
}

const SLIDES: readonly Slide[] = [
  {
    title: "See where your money is heading",
    text: "Your next few months, played forward from your own spending, income and bills, as a likely range rather than one guess.",
    picture: <ForecastPicture />,
  },
  {
    title: "Check before you split",
    text: "Describe a buy-now-pay-later purchase and get Safe, Caution or At Risk, the reasons behind it, and the smallest change that would make it safe.",
    picture: <FacesPicture />,
  },
  {
    title: "You stay in control",
    text: "Nothing is saved until you add it. You can download or clear everything from Settings, any time. These are estimates from your own records, not financial advice.",
    picture: <ControlPicture />,
  },
];

type Props = {
  /** The person wants the tour of the app. */
  onTour: () => void;
  /** The person wants neither the rest of the slides nor the tour. */
  onSkip: () => void;
};

/**
 * Three short slides on first sign-in (ADR D-53): what the app does, how to read an answer, and
 * that the person is in control. A modal that keeps focus inside, and can be left at any point.
 * The copy sits beside its picture, so no part of the card is left empty.
 */
export function Intro({ onTour, onSkip }: Props) {
  const [index, setIndex] = useState(0);
  const panel = useRef<HTMLDivElement>(null);
  const slide = SLIDES[index] ?? SLIDES[0];
  const last = index === SLIDES.length - 1;

  // Focus the card as it opens and again on each slide, so a screen reader hears the new heading.
  useEffect(() => {
    panel.current?.focus();
  }, [index]);

  function handleKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onSkip();
      return;
    }
    if (event.key !== "Tab" || !panel.current) return;
    const controls = [
      ...panel.current.querySelectorAll<HTMLElement>("button:not([disabled]), [href]"),
    ];
    const first = controls[0];
    const final = controls[controls.length - 1];
    if (!first || !final) return;
    if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) {
      event.preventDefault();
      final.focus();
    } else if (!event.shiftKey && document.activeElement === final) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-page/95 p-4">
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Welcome to PaySense"
        tabIndex={-1}
        onKeyDown={handleKey}
        className="grid w-full max-w-3xl overflow-hidden rounded-card border border-line bg-surface shadow-xl outline-none sm:grid-cols-[0.9fr_1.1fr]"
      >
        <div className="relative flex min-h-48 flex-col items-center justify-center gap-6 bg-sidebar p-8 text-sidebar-ink">
          <div className="absolute left-5 top-5 flex items-center gap-2">
            <BrandMark size={28} />
            <span className="font-display text-lg font-extrabold">
              Pay<span className="text-rosy">Sense</span>
            </span>
          </div>
          <div className="mt-8 flex w-full justify-center sm:mt-6">{slide.picture}</div>
        </div>
        <div className="flex flex-col justify-center gap-5 p-6 sm:p-9">
          <div className="flex items-center gap-3">
            <div className="flex flex-1 gap-1.5" aria-hidden>
              {SLIDES.map((s, i) => (
                <span
                  key={s.title}
                  className={`h-1 flex-1 rounded-full ${i <= index ? "bg-accent" : "bg-line"}`}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={onSkip}
              className="rounded-md px-1.5 py-1 text-[13px] font-semibold text-ink-secondary hover:text-ink"
            >
              Skip
            </button>
          </div>
          <div>
            <p className="text-[12px] font-bold uppercase tracking-wider text-accent">
              Step {index + 1} of {SLIDES.length}
            </p>
            <h2 className="mt-1.5 font-display text-[26px] font-extrabold leading-tight text-ink">
              {slide.title}
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-secondary">{slide.text}</p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            {index > 0 ? (
              <Button variant="secondary" onClick={() => setIndex(index - 1)}>
                Back
              </Button>
            ) : (
              <span />
            )}
            {last ? (
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={onSkip}>
                  Skip the tour
                </Button>
                <Button variant="accent" onClick={onTour}>
                  Take a quick tour
                </Button>
              </div>
            ) : (
              <Button variant="accent" onClick={() => setIndex(index + 1)}>
                Next
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
