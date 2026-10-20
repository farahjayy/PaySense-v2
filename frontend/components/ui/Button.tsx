import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "dangerSoft" | "positive" | "accent";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: "sm" | "md";
};

const VARIANT_CLASSES: Record<Variant, string> = {
  // The main action of a screen: the brand teal. `primary` is the same colour, kept for older call sites.
  primary: "bg-accent text-white border-transparent hover:bg-accent/90",
  secondary: "bg-surface text-ink border-line hover:bg-surface-2",
  danger: "bg-danger text-white border-transparent hover:bg-danger/85",
  // A destructive action beside others (a row's Delete): red, so it never looks like Edit.
  dangerSoft: "bg-surface text-danger border-danger/60 hover:border-danger hover:bg-danger-bg",
  // An action that completes something (Mark paid): green.
  positive: "bg-surface text-success border-success/60 hover:border-success hover:bg-success-bg",
  accent: "bg-accent text-white border-transparent hover:bg-accent/90",
};

export function Button({ variant = "primary", size = "md", className = "", ...rest }: Props) {
  const sizeClasses = size === "sm" ? "h-8 px-3 text-xs" : "h-10 px-4 text-[13px]";
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${sizeClasses} ${className}`}
      {...rest}
    />
  );
}
