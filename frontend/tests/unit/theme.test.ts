/**
 * The pond theme's colours, checked from the tokens in globals.css. axe cannot judge contrast in
 * jsdom, so this is where it is enforced: every text pairing reaches WCAG AA (4.5:1), and every
 * border or chart line that must be seen reaches 3:1 (WCAG 1.4.11).
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const CSS = readFileSync(path.join(process.cwd(), "app", "globals.css"), "utf8");

function token(name: string): string {
  const match = new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`).exec(CSS);
  if (!match) throw new Error(`--color-${name} is not defined in globals.css`);
  return match[1];
}

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

const WHITE = "#ffffff";

const TEXT_PAIRS: [string, string, string, number][] = [
  ["ink", "page", "body text on the page", 7],
  ["ink", "surface", "body text on a card", 7],
  ["ink-secondary", "page", "secondary text on the page", 4.5],
  ["ink-secondary", "surface", "secondary text on a card", 4.5],
  ["ink-muted", "page", "muted text on the page", 4.5],
  ["ink-muted", "surface", "muted text on a card", 4.5],
  ["accent", "page", "links and the active nav label on the page", 4.5],
  ["accent", "surface", "links on a card", 4.5],
  ["accent", "accent-bg", "accent text on its tint", 4.5],
  ["success", "surface", "Safe text on a card", 4.5],
  ["success", "success-bg", "Safe badge", 4.5],
  ["warning", "surface", "Caution text on a card", 4.5],
  ["warning", "warning-bg", "Caution badge", 4.5],
  ["danger", "surface", "At Risk text on a card", 4.5],
  ["danger", "danger-bg", "At Risk badge", 4.5],
  ["sidebar-ink", "sidebar", "sidebar labels", 7],
  ["sidebar-muted", "sidebar", "sidebar secondary text", 4.5],
];

const NON_TEXT_PAIRS: [string, string, string][] = [
  ["field", "surface", "input border on a card"],
  ["field", "page", "input border on the page"],
  ["chart-edge", "surface", "chart outline"],
  ["accent", "surface", "focus ring on a card"],
  ["accent", "page", "focus ring on the page"],
];

describe("pond theme contrast", () => {
  it.each(TEXT_PAIRS)("%s on %s reaches the target for %s", (fg, bg, _what, target) => {
    expect(contrast(token(fg), token(bg))).toBeGreaterThanOrEqual(target);
  });

  it.each(NON_TEXT_PAIRS)("%s on %s reaches 3:1 for %s", (fg, bg) => {
    expect(contrast(token(fg), token(bg))).toBeGreaterThanOrEqual(3);
  });

  it("puts white text on the accent button at AA", () => {
    expect(contrast(WHITE, token("accent"))).toBeGreaterThanOrEqual(4.5);
  });

  it("uses the login page's cream and teal", () => {
    expect(token("page").toLowerCase()).toBe("#f7f4d5");
    expect(token("accent").toLowerCase()).toBe("#105666");
    expect(token("sidebar").toLowerCase()).toBe("#105666");
  });

  it("keeps the result colours unchanged, because colour carries their meaning", () => {
    expect(
      [token("success"), token("warning"), token("danger")].map((c) => c.toLowerCase()),
    ).toEqual(["#3b6d11", "#854f0b", "#a32d2d"]);
  });
});
