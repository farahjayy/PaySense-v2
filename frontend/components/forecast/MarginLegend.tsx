/** A small drawing of each thing on the chart, so the legend does not rely on colour alone. */
function Swatch({ kind }: { kind: "line" | "band" | "zero" }) {
  return (
    <svg width="28" height="12" viewBox="0 0 28 12" aria-hidden="true" className="shrink-0">
      {kind === "line" && (
        <line
          x1="1"
          y1="6"
          x2="27"
          y2="6"
          stroke="var(--color-accent)"
          strokeWidth="3"
          strokeLinecap="round"
        />
      )}
      {kind === "band" && (
        <rect
          x="1"
          y="1"
          width="26"
          height="10"
          rx="2"
          fill="var(--color-chart-blue)"
          fillOpacity="0.35"
          stroke="var(--color-chart-edge)"
          strokeOpacity="0.6"
        />
      )}
      {kind === "zero" && (
        <line
          x1="1"
          y1="6"
          x2="27"
          y2="6"
          stroke="var(--color-danger)"
          strokeWidth="2"
          strokeDasharray="4 3"
        />
      )}
    </svg>
  );
}

const ITEMS = [
  { kind: "line", text: "Most likely" },
  { kind: "band", text: "Where 8 out of 10 possible futures land" },
  { kind: "zero", text: "RM 0: below this you would be short of money" },
] as const;

/** What each mark on the running-margin chart means, above the chart where it is read first. */
export function MarginLegend() {
  return (
    <ul
      aria-label="How to read this chart"
      className="mb-3 flex flex-wrap gap-x-5 gap-y-2 text-[12px] leading-snug text-ink-secondary"
    >
      {ITEMS.map((item) => (
        <li key={item.kind} className="flex items-center gap-2">
          <Swatch kind={item.kind} />
          {item.text}
        </li>
      ))}
    </ul>
  );
}
