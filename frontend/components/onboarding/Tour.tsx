"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
} from "react";

import { Button } from "@/components/ui/Button";

type Stop = { target: string; title: string; text: string };

// Each stop points at the element marked data-tour="<target>". A stop with nothing on screen when
// the tour opens is left out (the forecast card is only on the dashboard).
const STOPS: readonly Stop[] = [
  {
    target: "forecast",
    title: "Where your money is heading",
    text: "Your health score and the next few months, played forward from your own records.",
  },
  {
    target: "transactions",
    title: "Everything you've spent",
    text: "Add transactions or import a statement. The forecast learns from these, and you check every line before it is saved.",
  },
  {
    target: "risk",
    title: "Check before you split",
    text: "Describe a pay-later purchase and see whether it fits. If you go ahead, save it as a plan.",
  },
  {
    target: "plans",
    title: "Your BNPL plans",
    text: "Every plan and its instalments in one place. Mark each one paid as you go.",
  },
  {
    target: "model",
    title: "How the scores are made",
    text: "How the forecast and the risk check work, what they were built from, and where they are weak.",
  },
  {
    target: "settings",
    title: "Your data",
    text: "Download or clear everything PaySense holds about you, and replay this tour, any time.",
  },
];

/** The marked element that is actually on screen: the sidebar on a laptop, the bottom bar on a phone. */
function find(target: string): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`)) {
    const box = el.getBoundingClientRect();
    if (box.width > 0 && box.height > 0) return el;
  }
  return null;
}

const PAD = 6; // spotlight margin around the target
const GAP = 14; // spotlight to bubble, room for the arrow
const EDGE = 16; // the bubble never comes closer than this to the window's edge
const BUBBLE_WIDTH = 300;
const BUBBLE_HEIGHT = 190; // an upper estimate, used only to choose below or above

type Box = { top: number; left: number; width: number; height: number };
type Placement = { side: "right" | "below" | "above"; left: number; top: number; arrow: number; width: number };

const clamp = (n: number, low: number, high: number) => Math.min(Math.max(n, low), high);

/** To the right of a narrow target near the left edge (the sidebar), else below it, else above. */
function place(box: Box): Placement {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(BUBBLE_WIDTH, vw - 2 * EDGE);
  const midX = box.left + box.width / 2;
  const midY = box.top + box.height / 2;
  if (box.width < 280 && box.left + box.width + PAD + GAP + width + EDGE <= vw) {
    const top = clamp(midY - 48, EDGE, vh - BUBBLE_HEIGHT - EDGE);
    return { side: "right", left: box.left + box.width + PAD + GAP, top, arrow: clamp(midY - top, 20, 150), width };
  }
  const left = clamp(midX - width / 2, EDGE, vw - EDGE - width);
  const arrow = clamp(midX - left, 20, width - 20);
  if (box.top + box.height + PAD + GAP + BUBBLE_HEIGHT <= vh) {
    return { side: "below", left, top: box.top + box.height + PAD + GAP, arrow, width };
  }
  return { side: "above", left, top: Math.max(EDGE, box.top - PAD - GAP - BUBBLE_HEIGHT), arrow, width };
}

const lastBox = new Map<string, Box>();

/**
 * Where a marked control is on screen right now, kept current as the window is resized or scrolled.
 * The box is read from the page (an external system), and the same object comes back until it
 * actually moves, as `useSyncExternalStore` needs.
 */
function useTargetBox(target: string | undefined): Box | null {
  const subscribe = useCallback((notify: () => void) => {
    window.addEventListener("resize", notify);
    window.addEventListener("scroll", notify, true);
    // the page can move under the tour with no resize or scroll (a banner appears above the card)
    const watcher = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(notify);
    watcher?.observe(document.body);
    return () => {
      window.removeEventListener("resize", notify);
      window.removeEventListener("scroll", notify, true);
      watcher?.disconnect();
    };
  }, []);
  const read = (): Box | null => {
    const el = target ? find(target) : null;
    if (!target || !el) return null;
    const { top, left, width, height } = el.getBoundingClientRect();
    const before = lastBox.get(target);
    if (before && before.top === top && before.left === left && before.width === width && before.height === height) {
      return before;
    }
    const box = { top, left, width, height };
    lastBox.set(target, box);
    return box;
  };
  return useSyncExternalStore(subscribe, read, () => null);
}

/**
 * A spotlight tour of the real controls (ADR D-53): each stop dims the page, lights the control it
 * is about, and says in a sentence what it is for. Skippable at every stop; Escape skips it.
 * It is mounted after the page it points at, and a stop whose control is not on screen then is
 * left out.
 */
export function Tour({ onDone }: { onDone: () => void }) {
  const [stops] = useState<readonly Stop[]>(() => STOPS.filter((s) => find(s.target)));
  const [index, setIndex] = useState(0);
  const bubble = useRef<HTMLDivElement>(null);
  const stop = stops[index];
  const box = useTargetBox(stop?.target);
  const ready = box !== null;

  useEffect(() => {
    if (stops.length === 0) onDone();
  }, [stops, onDone]);

  // bring the control into view; the scroll event then updates its box
  useEffect(() => {
    if (stop) find(stop.target)?.scrollIntoView?.({ block: "nearest" });
  }, [stop]);

  useEffect(() => {
    if (ready) bubble.current?.querySelector<HTMLElement>("[data-next]")?.focus();
  }, [index, ready]);

  if (!stop || !box) return null;
  const spot = place(box);
  const last = index === stops.length - 1;

  function handleKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onDone();
      return;
    }
    if (event.key !== "Tab" || !bubble.current) return;
    const controls = [...bubble.current.querySelectorAll<HTMLElement>("button")];
    const first = controls[0];
    const final = controls[controls.length - 1];
    if (!first || !final) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      final.focus();
    } else if (!event.shiftKey && document.activeElement === final) {
      event.preventDefault();
      first.focus();
    }
  }

  const spotlight: CSSProperties = {
    top: box.top - PAD,
    left: box.left - PAD,
    width: box.width + 2 * PAD,
    height: box.height + 2 * PAD,
  };
  const arrowStyle: CSSProperties =
    spot.side === "right"
      ? { left: -6, top: spot.arrow - 6 }
      : spot.side === "below"
        ? { top: -6, left: spot.arrow - 6 }
        : { bottom: -6, left: spot.arrow - 6 };

  return (
    <div className="fixed inset-0 z-50" onKeyDown={handleKey}>
      <div aria-hidden className="absolute inset-0" />
      <div
        aria-hidden
        data-testid="tour-spotlight"
        className="pointer-events-none absolute rounded-2xl shadow-[0_0_0_9999px_rgba(10,51,35,0.58)] ring-2 ring-page transition-all duration-200 motion-reduce:transition-none"
        style={spotlight}
      />
      <div
        ref={bubble}
        role="dialog"
        aria-modal="true"
        aria-label="Tour of PaySense"
        aria-describedby="tour-text"
        className="absolute rounded-card border border-line bg-surface p-4 shadow-xl"
        style={{ top: spot.top, left: spot.left, width: spot.width }}
      >
        <span
          aria-hidden
          className="absolute h-3 w-3 rotate-45 border-line bg-surface"
          style={{
            ...arrowStyle,
            borderWidth: spot.side === "right" ? "0 0 1px 1px" : spot.side === "below" ? "1px 0 0 1px" : "0 1px 1px 0",
          }}
        />
        <p className="text-[12px] font-bold text-accent">
          {index + 1} of {stops.length}
        </p>
        <h2 className="mt-0.5 font-display text-[17px] font-extrabold text-ink">{stop.title}</h2>
        <p id="tour-text" className="mt-1.5 text-[14px] leading-relaxed text-ink-secondary">
          {stop.text}
        </p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onDone}
            className="rounded-md px-1.5 py-1 text-[13px] font-semibold text-ink-secondary hover:text-ink"
          >
            Skip tour
          </button>
          <div className="flex gap-2">
            {index > 0 && (
              <Button variant="secondary" size="sm" onClick={() => setIndex(index - 1)}>
                Back
              </Button>
            )}
            <Button
              data-next
              variant="accent"
              size="sm"
              onClick={last ? onDone : () => setIndex(index + 1)}
            >
              {last ? "Done" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
