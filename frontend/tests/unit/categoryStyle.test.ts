import { describe, expect, it } from "vitest";

import {
  BUILT_IN_STYLES,
  categoryGlyph,
  categoryColour,
  groupSmallCategories,
  OWN_COLOURS,
} from "@/lib/categoryStyle";

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const CARD = "#fffef6";
const WHITE = "#ffffff";

describe("category colours", () => {
  const all = [...Object.values(BUILT_IN_STYLES).map((s) => s.colour), ...OWN_COLOURS];

  it.each(all)("%s is visible on a card and carries a white glyph (3:1)", (colour) => {
    expect(contrast(colour, CARD)).toBeGreaterThanOrEqual(3);
    expect(contrast(WHITE, colour)).toBeGreaterThanOrEqual(3);
  });

  it("gives a category the same colour every time, whatever its case", () => {
    expect(categoryColour("Food")).toBe(categoryColour("food"));
    expect(categoryColour("Boyfriend Tax")).toBe(categoryColour("Boyfriend Tax"));
  });

  it("gives the built-in categories their own colour and glyph", () => {
    expect(categoryColour("Food")).toBe("#105666");
    expect(categoryColour("BNPL")).toBe("#4b86b4");
    expect(categoryGlyph("Rent")).not.toBe(categoryGlyph("Food"));
  });

  it("gives a category of the person's own a colour from the own palette and a generic glyph", () => {
    expect(OWN_COLOURS).toContain(categoryColour("Self Care"));
    expect(categoryGlyph("Self Care")).toBe(categoryGlyph("Something Else"));
  });
});

describe("groupSmallCategories", () => {
  const item = (category: string, spend_sen: number, share: number) => ({
    category,
    spend_sen,
    share,
  });

  it("folds categories under 3% into one Others row, with how many it holds", () => {
    const rows = groupSmallCategories([
      item("Food", 90000, 0.9),
      item("Bills", 7000, 0.07),
      item("Hangout", 2000, 0.02),
      item("Gifts", 1000, 0.01),
    ]);

    expect(rows.map((r) => r.category)).toEqual(["Food", "Bills", "Others"]);
    expect(rows[2]).toMatchObject({ spend_sen: 3000, grouped: 2 });
    expect(rows[2].share).toBeCloseTo(0.03);
  });

  it("leaves a single small category as itself, since grouping one hides its name", () => {
    const rows = groupSmallCategories([item("Food", 98000, 0.98), item("Gifts", 2000, 0.02)]);

    expect(rows.map((r) => r.category)).toEqual(["Food", "Gifts"]);
    expect(rows.every((r) => r.grouped === 0)).toBe(true);
  });

  it("keeps the money the same: the rows add up to what went in", () => {
    const input = [
      item("A", 5000, 0.5),
      item("B", 4000, 0.4),
      item("C", 600, 0.06),
      item("D", 400, 0.04),
    ];

    expect(groupSmallCategories(input).reduce((sum, r) => sum + r.spend_sen, 0)).toBe(10000);
  });
});
