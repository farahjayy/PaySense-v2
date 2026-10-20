import { categoryColour, categoryGlyph } from "@/lib/categoryStyle";

/** A category as a coloured tile with a white glyph. Decorative: the name is always written beside it. */
export function CatIcon({ category, size = 28 }: { category: string; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center"
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.32),
        background: categoryColour(category),
      }}
    >
      <svg
        width={Math.round(size * 0.58)}
        height={Math.round(size * 0.58)}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={categoryGlyph(category)} />
      </svg>
    </span>
  );
}
