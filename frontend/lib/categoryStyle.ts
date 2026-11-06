/**
 * One fixed colour and icon per category, the same every month, so a category is recognised at a
 * glance (ADR D-48). The built-in categories have their own; a category of the person's own takes a
 * colour from the own palette, chosen by its name so it never changes. Every colour reaches 3:1
 * against the card and carries a white glyph at 3:1 (tests/unit/categoryStyle.test.ts); the name
 * is always written next to the icon, so colour is never the only signal.
 */

import type { Category } from "@/lib/api/queries";

type Style = { colour: string; glyph: string };
export type ColourKey = NonNullable<Category["colour"]>;
export type IconKey = NonNullable<Category["icon"]>;
/** What the person chose for a category (ADR D-64); a part left null keeps its default. */
export type Look = { icon?: IconKey | null; colour?: ColourKey | null };

const GLYPH = {
  food: "M7 3v7a2 2 0 0 0 4 0V3M9 12v9M17 3c-2.2 1.6-3 4-3 7h3v11",
  transport: "M5 5h14a1 1 0 0 1 1 1v10H4V6a1 1 0 0 1 1-1zM4 12h16M8 20v-2M16 20v-2",
  rent: "M4 11l8-7 8 7M6 10v10h12V10M10 20v-6h4v6",
  shopping: "M5 8h14l-1 12H6zM9 8a3 3 0 0 1 6 0",
  bills: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6",
  entertainment: "M12 4l2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8z",
  education: "M2 9l10-5 10 5-10 5zM6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5",
  bnpl: "M3 6h18v12H3zM3 10h18M7 15h3",
  other: "M6 12h.01M12 12h.01M18 12h.01",
  income: "M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4zM4 7l12-3v3M16 13h2",
  refund: "M9 7L4 12l5 5M4 12h11a5 5 0 0 1 0 10",
  transfer: "M4 8h14l-3-3M20 16H6l3 3",
  savings:
    "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 8v8M9.5 10.5h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4",
  tag: "M4 4h8l8 8-8 8-8-8zM8 8h.01",
  drink: "M6 4h12l-1.5 14a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2zM6 9h12",
} as const;

export const BUILT_IN_STYLES: Readonly<Record<string, Style>> = {
  food: { colour: "#105666", glyph: GLYPH.food },
  transport: { colour: "#43998a", glyph: GLYPH.transport },
  rent: { colour: "#7b5e92", glyph: GLYPH.rent },
  shopping: { colour: "#7b8c4b", glyph: GLYPH.shopping },
  bills: { colour: "#a87b20", glyph: GLYPH.bills },
  entertainment: { colour: "#7373ab", glyph: GLYPH.entertainment },
  education: { colour: "#c0705f", glyph: GLYPH.education },
  academic: { colour: "#c0705f", glyph: GLYPH.education },
  bnpl: { colour: "#4b86b4", glyph: GLYPH.bnpl },
  other: { colour: "#8a8876", glyph: GLYPH.other },
  others: { colour: "#8a8876", glyph: GLYPH.other },
  salary: { colour: "#2f7d5b", glyph: GLYPH.income },
  allowance: { colour: "#3b8a78", glyph: GLYPH.income },
  refund: { colour: "#4b86b4", glyph: GLYPH.refund },
  transfer: { colour: "#6f7f86", glyph: GLYPH.transfer },
  savings: { colour: "#2f7d5b", glyph: GLYPH.savings },
};

/**
 * The colours a person may give a category (ADR D-64), by the key the server stores. Typed against
 * the generated API, so a key added on the server without a colour here fails the typecheck.
 */
export const COLOUR_HEX: Readonly<Record<ColourKey, string>> = {
  ocean: "#105666",
  teal: "#43998a",
  plum: "#7b5e92",
  olive: "#7b8c4b",
  amber: "#a87b20",
  iris: "#7373ab",
  coral: "#c0705f",
  sky: "#4b86b4",
  stone: "#8a8876",
  forest: "#2f7d5b",
  clay: "#c27f5a",
  berry: "#9a5a78",
  moss: "#4f8a6b",
  rust: "#b0653f",
  slate: "#5c7fa0",
};

/** The icons a person may give a category, by key. */
export const ICON_GLYPH: Readonly<Record<IconKey, string>> = {
  food: GLYPH.food,
  drink: GLYPH.drink,
  transport: GLYPH.transport,
  rent: GLYPH.rent,
  shopping: GLYPH.shopping,
  bills: GLYPH.bills,
  entertainment: GLYPH.entertainment,
  education: GLYPH.education,
  savings: GLYPH.savings,
  income: GLYPH.income,
  other: GLYPH.other,
  tag: GLYPH.tag,
};

/** For a category of the person's own that they have not styled, in turn by name. */
export const OWN_COLOURS: readonly string[] = [
  COLOUR_HEX.clay,
  COLOUR_HEX.berry,
  COLOUR_HEX.moss,
  COLOUR_HEX.rust,
  COLOUR_HEX.slate,
];

function stableIndex(name: string, modulo: number): number {
  let hash = 5381;
  for (const ch of name.toLowerCase()) hash = (hash * 33 + ch.charCodeAt(0)) % 1_000_003;
  return hash % modulo;
}

function defaultStyle(category: string): Style {
  return (
    BUILT_IN_STYLES[category.trim().toLowerCase()] ?? {
      colour: OWN_COLOURS[stableIndex(category, OWN_COLOURS.length)],
      glyph: GLYPH.tag,
    }
  );
}

/** The tile for a category: what the person chose, else the default for that name. */
export function styleOf(category: string, look?: Look): Style {
  const base = defaultStyle(category);
  return {
    colour: look?.colour ? COLOUR_HEX[look.colour] : base.colour,
    glyph: look?.icon ? ICON_GLYPH[look.icon] : base.glyph,
  };
}

export const categoryColour = (category: string, look?: Look): string =>
  styleOf(category, look).colour;
export const categoryGlyph = (category: string, look?: Look): string =>
  styleOf(category, look).glyph;

const SMALL_SHARE = 0.03;

type Spend = { category: string; spend_sen: number; share: number };
export type SpendRow = Spend & {
  /** How many small categories this row stands for; 0 for an ordinary category. */
  grouped: number;
};

/**
 * Categories under 3% of the month are folded into one "Others" row so the bar and the list stay
 * readable. One small category on its own is left as itself (grouping one would only hide its
 * name). The rows add up to exactly what went in.
 */
export function groupSmallCategories(categories: readonly Spend[]): SpendRow[] {
  const small = categories.filter((c) => c.share < SMALL_SHARE);
  if (small.length < 2) return categories.map((c) => ({ ...c, grouped: 0 }));
  const large = categories.filter((c) => c.share >= SMALL_SHARE).map((c) => ({ ...c, grouped: 0 }));
  return [
    ...large,
    {
      category: "Others",
      spend_sen: small.reduce((sum, c) => sum + c.spend_sen, 0),
      share: small.reduce((sum, c) => sum + c.share, 0),
      grouped: small.length,
    },
  ];
}
