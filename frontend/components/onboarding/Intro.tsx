"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { BrandMark } from "@/components/ui/BrandMark";
import { Button } from "@/components/ui/Button";
import { Face } from "@/components/ui/Face";

type Slide = { title: string; text: string; picture: ReactNode };

// One entrance per element, started by a delay; reduced motion shows the finished picture.
const after = (seconds: number): CSSProperties => ({ animationDelay: `${seconds}s` });

/** A forecast line climbs, then the likely range opens out where the future starts. */
function ForecastPicture() {
  return (
    <svg viewBox="0 0 240 220" className="h-full w-full" aria-hidden>
      <line x1="10" y1="200" x2="230" y2="200" className="stroke-line" strokeWidth="2" />
      <path d="M130 118 L230 26 L230 144 Z" className="intro-rise fill-accent-bg" style={after(1)} />
      <path
        d="M10 176 L40 160 L70 168 L100 136 L130 118 L180 90 L230 62"
        pathLength={1}
        className="intro-draw fill-none stroke-accent"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line x1="130" y1="14" x2="130" y2="200" className="stroke-field" strokeDasharray="4 4" />
      <circle cx="130" cy="118" r="6" className="intro-pop fill-rosy" style={after(0.9)} />
    </svg>
  );
}

/** A purchase, then the three answers the check can give. */
function RiskPicture() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4" aria-hidden>
      <div className="intro-rise w-48 rounded-2xl border border-line bg-surface p-3.5 text-left shadow-sm">
        <p className="text-[14px] font-semibold text-ink">New phone</p>
        <p className="text-[13px] text-ink-muted">Pay later, in instalments</p>
      </div>
      <div className="flex items-end gap-3">
        {(["Safe", "Caution", "At Risk"] as const).map((band, i) => (
          <span
            key={band}
            className={`intro-pop flex flex-col items-center gap-1.5 ${i === 1 ? "mb-2" : ""}`}
            style={after(0.5 + 0.2 * i)}
          >
            <Face band={band} size={52} />
            <span className="rounded-full bg-page px-2.5 py-0.5 text-[11px] font-semibold text-ink">
              {band}
            </span>
          </span>
        ))}
      </div>
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
    text: "Your next few months, played forward from your own spending, income and bills.",
    picture: <ForecastPicture />,
  },
  {
    title: "Check a buy-now-pay-later plan before you commit",
    text: "Describe the purchase and get Safe, Caution or At Risk, the reasons from your own figures, and the smallest change that would make it safe.",
    picture: <RiskPicture />,
  },
  {
    title: "You stay in control",
    text: "Nothing is saved until you add it. You can download or clear everything from Your data, any time.",
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
  // Which way the student is moving, so the new slide comes in from that side (as in v3).
  const [dir, setDir] = useState<"next" | "back">("next");
  function go(to: number) {
    setDir(to > index ? "next" : "back");
    setIndex(to);
  }
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
        <div className="relative isolate flex min-h-48 flex-col items-center justify-center sm:min-h-[26rem] gap-6 overflow-hidden bg-sidebar p-8 text-sidebar-ink">
          <div aria-hidden className="ob-ring -z-10 h-[260px] w-[260px]" />
          <div aria-hidden className="ob-ring -z-10 h-[420px] w-[420px] opacity-70" />
          <div aria-hidden className="ob-ring -z-10 h-[580px] w-[580px] opacity-40" />
          <div className="absolute left-5 top-5 flex items-center gap-2">
            <BrandMark size={28} />
            <span className="font-display text-lg font-extrabold">
              Pay<span className="text-rosy">Sense</span>
            </span>
          </div>
          <div
            key={index}
            data-intro-slide
            className={`ob-in-${dir} mt-8 flex w-full justify-center sm:mt-6`}
          >
            <div
              data-intro-card
              className="ob-float flex aspect-[5/4] w-full max-w-80 sm:aspect-square items-center justify-center rounded-2xl bg-surface p-4 shadow-lg"
            >
              {slide.picture}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-5 p-6 sm:p-9">
          <div className="flex items-center gap-3">
            <div className="flex flex-1 gap-1.5" aria-hidden>
              {SLIDES.map((s, i) => (
                <span
                  key={s.title}
                  className={`h-1.5 flex-1 rounded-full transition-[background-color,box-shadow] duration-500 ${
                    i > index
                      ? "bg-line"
                      : i === index
                        ? "bg-rosy shadow-[0_0_10px_2px_rgba(211,150,140,0.55)]"
                        : "bg-rosy"
                  }`}
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
          <div key={index} data-intro-slide data-intro-text className={`ob-in-${dir} flex-1`}>
            <p className="text-[12px] font-bold uppercase tracking-wider text-accent">
              Step {index + 1} of {SLIDES.length}
            </p>
            <h2 className="mt-1.5 min-h-[3.75em] font-display text-[26px] font-extrabold leading-tight text-ink sm:min-h-[2.5em]">
              {slide.title}
            </h2>
            <p className="mt-3 min-h-[4.9em] text-[15px] leading-relaxed text-ink-secondary">{slide.text}</p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            {index > 0 ? (
              <Button variant="secondary" onClick={() => go(index - 1)}>
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
              <Button variant="accent" onClick={() => go(index + 1)}>
                Next
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
