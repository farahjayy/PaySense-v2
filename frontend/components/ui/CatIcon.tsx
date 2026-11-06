import { styleOf, type Look } from "@/lib/categoryStyle";

type TileProps = { colour: string; glyph: string; size?: number };

/** A coloured tile with a white glyph. Decorative: the name is always written beside it. */
export function CatTile({ colour, glyph, size = 28 }: TileProps) {
  return (
    <span
      aria-hidden
      data-testid="category-tile"
      className="inline-flex shrink-0 items-center justify-center"
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.32),
        background: colour,
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
        <path d={glyph} />
      </svg>
    </span>
  );
}

/** A category as its tile: the look the person chose, else the default for its name. */
export function CatIcon({
  category,
  size = 28,
  look,
}: {
  category: string;
  size?: number;
  look?: Look;
}) {
  const { colour, glyph } = styleOf(category, look);
  return <CatTile colour={colour} glyph={glyph} size={size} />;
}
