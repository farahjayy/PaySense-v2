import Link from "next/link";

import { Card } from "@/components/ui/Card";
import { Face } from "@/components/ui/Face";
import { lockedText, type LockedProps } from "@/components/ui/States";

const RING = 148;
const STROKE = 12;
const RADIUS = (RING - STROKE) / 2;
const PADLOCK = "M7 11V8a5 5 0 0 1 10 0v3M5 11h14v9H5z";

function Padlock({ size, strokeWidth }: { size: number; strokeWidth: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PADLOCK} />
    </svg>
  );
}

/** The score ring with nothing in it: a plain slate ring and a padlock, never a number. */
function LockedRing() {
  return (
    <div className="relative inline-flex text-locked" style={{ width: RING, height: RING }}>
      <svg width={RING} height={RING} viewBox={`0 0 ${RING} ${RING}`}>
        <circle
          cx={RING / 2}
          cy={RING / 2}
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.35}
          strokeWidth={STROKE}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <Padlock size={30} strokeWidth={1.9} />
        <span className="mt-1 text-[11px]">financial health</span>
      </div>
    </div>
  );
}

/**
 * What the forecast looks like before it exists: the score card, drawn the way the real one is
 * (ring, face, badge, one line) but with no figures, and the reason it is locked. Showing the
 * place keeps the layout steady and gives the tour something to point at on a first visit.
 * Nothing here is a value; the numbers appear only once the forecast does. The colour is a cool
 * slate, apart from the teal of the buttons, so the locked state does not read as something to
 * click.
 */
export function LockedOutlook(props: LockedProps) {
  return (
    <section aria-labelledby="outlook-heading">
      <Card data-tour="forecast" className="flex flex-col items-center gap-5 sm:flex-row sm:gap-8">
        <div aria-hidden className="shrink-0">
          <LockedRing />
        </div>
        <div className="text-center sm:text-left">
          <h2 id="outlook-heading" className="sr-only">
            Your financial health forecast
          </h2>
          <div className="flex items-center justify-center gap-3 sm:justify-start">
            <Face band="Locked" size={56} />
            <span className="inline-flex items-center gap-1.5 rounded-full border border-locked/30 bg-locked/10 px-3.5 py-1.5 text-sm font-semibold text-locked">
              <Padlock size={14} strokeWidth={2.2} />
              Locked
            </span>
          </div>
          <p role="status" className="mt-3 max-w-md text-[15px] font-medium leading-relaxed text-ink">
            {lockedText(props)}
          </p>
          <Link
            href="/import"
            className="mt-2 inline-block text-[13px] font-semibold text-accent underline-offset-2 hover:underline"
          >
            Import
          </Link>
        </div>
      </Card>
    </section>
  );
}
