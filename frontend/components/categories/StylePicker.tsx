"use client";

import { CatTile } from "@/components/ui/CatIcon";
import { COLOUR_HEX, ICON_GLYPH, styleOf, type ColourKey, type IconKey } from "@/lib/categoryStyle";

type Props = {
  /** The category being styled: the preview shows its default for whatever is not chosen yet. */
  name: string;
  icon: IconKey | null;
  colour: ColourKey | null;
  onChange: (look: { icon: IconKey | null; colour: ColourKey | null }) => void;
};

// What each icon is called to a screen reader, and on hover. The key is not always the plain word.
const ICON_LABEL: Readonly<Record<IconKey, string>> = {
  food: "Food",
  drink: "Drink",
  transport: "Transport",
  rent: "Home",
  shopping: "Shopping",
  bills: "Bills",
  entertainment: "Star",
  education: "Study",
  savings: "Coin",
  income: "Wallet",
  other: "Dots",
  tag: "Tag",
};

const capital = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);
const CHOICE =
  "inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2";

/**
 * Pick a colour and an icon for a category from the ones the app already uses (ADR D-64), with a
 * live preview. Each choice is a button with its name and a pressed state, so what is chosen is
 * never told by colour alone.
 */
export function StylePicker({ name, icon, colour, onChange }: Props) {
  const preview = styleOf(name || "Category", { icon, colour });
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <CatTile colour={preview.colour} glyph={preview.glyph} size={48} />
        <p className="break-words text-[14px] font-medium text-ink">{name || "Your category"}</p>
      </div>

      <div role="group" aria-label="Colour" className="flex flex-wrap gap-2">
        {(Object.keys(COLOUR_HEX) as ColourKey[]).map((key) => {
          const chosen = colour === key;
          return (
            <button
              key={key}
              type="button"
              aria-label={capital(key)}
              title={capital(key)}
              aria-pressed={chosen}
              onClick={() => onChange({ icon, colour: key })}
              className={`${CHOICE} ${chosen ? "border-ink ring-2 ring-ink/70" : "border-line"}`}
              style={{ background: COLOUR_HEX[key] }}
            >
              {chosen && (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M5 12l5 5 9-10" />
                </svg>
              )}
            </button>
          );
        })}
      </div>

      <div role="group" aria-label="Icon" className="flex flex-wrap gap-2">
        {(Object.keys(ICON_GLYPH) as IconKey[]).map((key) => {
          const chosen = icon === key;
          return (
            <button
              key={key}
              type="button"
              aria-label={ICON_LABEL[key]}
              title={ICON_LABEL[key]}
              aria-pressed={chosen}
              onClick={() => onChange({ icon: key, colour })}
              className={`${CHOICE} text-ink ${
                chosen
                  ? "border-ink bg-accent-bg ring-2 ring-ink/70"
                  : "border-line bg-surface hover:bg-surface-2"
              }`}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d={ICON_GLYPH[key]} />
              </svg>
            </button>
          );
        })}
      </div>
    </div>
  );
}
