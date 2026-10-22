import type { ReactNode } from "react";

type Tone = "info" | "success" | "warning" | "danger";

const TONES: Record<Tone, { box: string; icon: string; glyph: string }> = {
  info: { box: "border-accent/30 bg-accent-bg text-ink", icon: "text-accent", glyph: "i" },
  success: { box: "border-success/30 bg-success-bg text-ink", icon: "text-success", glyph: "✓" },
  warning: { box: "border-warning/30 bg-warning-bg text-ink", icon: "text-warning", glyph: "!" },
  danger: { box: "border-danger/30 bg-danger-bg text-ink", icon: "text-danger", glyph: "▲" },
};

type Props = {
  tone?: Tone;
  title?: string;
  children?: ReactNode;
  className?: string;
  /** Adds a close button, named after the title, for a message the person may put away. */
  onClose?: () => void;
};

/**
 * A message that qualifies a number or explains a state. Colour is never the only signal: every
 * tone has its own glyph, and a danger banner is announced immediately (role="alert").
 */
export function Banner({ tone = "info", title, children, className = "", onClose }: Props) {
  const style = TONES[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={`flex gap-3 rounded-card border px-4 py-3 text-[13px] leading-relaxed ${style.box} ${className}`}
    >
      <span aria-hidden className={`mt-0.5 w-4 shrink-0 text-center font-bold ${style.icon}`}>
        {style.glyph}
      </span>
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? "mt-0.5 text-ink-secondary" : ""}>{children}</div>}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label={title ? `Close: ${title}` : "Close"}
          className="-mr-1 -mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[16px] leading-none text-ink-secondary hover:bg-black/5 hover:text-ink"
        >
          <span aria-hidden>×</span>
        </button>
      )}
    </div>
  );
}
