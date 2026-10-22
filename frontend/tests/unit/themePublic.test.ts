/**
 * The welcome and login pages in both themes (ADR D-59), checked from the `--lg-*` tokens in
 * app/login/login.css the way theme.test.ts checks the app's. The light values must not move (the
 * light pages are unchanged); the dark values must keep every pairing readable. axe cannot judge
 * contrast in jsdom, so this is where it is enforced.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const LOGIN_CSS = readFileSync(path.join(ROOT, "app", "login", "login.css"), "utf8");
const WELCOME_CSS = readFileSync(path.join(ROOT, "app", "welcome", "welcome.css"), "utf8");
const GLOBALS = readFileSync(path.join(ROOT, "app", "globals.css"), "utf8");

const LIGHT_BLOCK = /\n\.login-theme\s*\{([^}]*)\}/.exec(LOGIN_CSS)?.[1] ?? "";
const DARK_BLOCK = /:root\[data-theme="dark"\]\s+\.login-theme\s*\{([^}]*)\}/.exec(LOGIN_CSS)?.[1] ?? "";

function tokens(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/--lg-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\b/g)) out[m[1]] = m[2];
  return out;
}

const light = tokens(LIGHT_BLOCK);
const darkOverrides = tokens(DARK_BLOCK);
const dark = { ...light, ...darkOverrides };

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

/** [foreground, background, minimum ratio, what it is] */
const PAIRS: [string, string, number, string][] = [
  ["ink", "page", 7, "headings on the page"],
  ["ink", "card", 7, "headings on the card"],
  ["ink-2", "page", 4.5, "secondary text on the page"],
  ["ink-2", "card", 4.5, "secondary text on the card"],
  ["ink-3", "card", 4.5, "hint text on the card"],
  ["teal-text", "page", 4.5, "teal links and accents on the page"],
  ["teal-text", "card", 4.5, "teal strokes and links on the card"],
  ["on-teal", "teal", 4.5, "the label on a teal panel or button"],
  ["on-teal", "teal-deep", 4.5, "the label on a hovered teal button"],
  ["teal", "on-teal", 4.5, "teal text on the cream light button"],
  ["placeholder", "input", 4.5, "placeholder text in an input"],
  ["ink", "input", 7, "typed text in an input"],
  ["field", "card", 3, "the input border against its card (WCAG 1.4.11)"],
  ["teal-text", "input", 3, "the focus and hover border of an input"],
  ["rosy", "teal", 3, "the large rosy words on the teal panel"],
];

describe.each([
  ["light", light],
  ["dark", dark],
] as const)("welcome and login pages, %s", (_name, theme) => {
  it.each(PAIRS)("%s on %s reaches %s:1 (%s)", (fg, bg, min) => {
    expect(theme[fg], `--lg-${fg} is defined`).toBeDefined();
    expect(theme[bg], `--lg-${bg} is defined`).toBeDefined();
    expect(contrast(theme[fg], theme[bg])).toBeGreaterThanOrEqual(min);
  });
});

describe("the light pages did not change (ADR D-59)", () => {
  it("keeps the original light values", () => {
    expect(light).toMatchObject({
      page: "#f7f4d5",
      card: "#fffef6",
      teal: "#105666",
      "teal-deep": "#0c4553",
      "teal-soft": "#1b6b7d",
      rosy: "#d3968c",
      ink: "#0a3323",
      "ink-2": "#3f5a54",
      "ink-3": "#4d655f",
      field: "#6b8a84",
      line: "#e4e0b8",
    });
  });

  it("gives the new roles the value the old token had in each place", () => {
    expect(light["teal-text"]).toBe(light.teal);
    expect(light["on-teal"]).toBe(light.page);
    expect(light.input).toBe("#ffffff");
    expect(light.placeholder).toBe("#5c756f"); // the one light value that moved: 3.9:1 -> 4.9:1
    expect(light.disabled).toBe("#a9c3c8");
  });
});

describe("the dark pages", () => {
  it("redefines every colour token the light page defines", () => {
    const missing = Object.keys(light).filter(
      (k) => !(k in darkOverrides) && !["rosy", "ink-fixed"].includes(k),
    );
    expect(missing).toEqual([]);
  });

  it("splits the teal into a deep fill and a light text colour", () => {
    expect(luminance(dark["teal-text"])).toBeGreaterThan(luminance(dark.teal) * 3);
  });

  it("no longer forces the light palette over the app's dark tokens", () => {
    expect(GLOBALS).not.toMatch(/\[data-theme="dark"\]\s+\.login-theme/);
  });
});

describe("no hard-coded colours that ignore the theme", () => {
  const STRIP = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

  it("login.css uses tokens for input, placeholder and disabled colours", () => {
    const css = STRIP(LOGIN_CSS).replace(/\.login-theme\s*\{[^}]*\}/, "").replace(/:root\[[^\]]*\]\s+\.login-theme\s*\{[^}]*\}/, "");
    expect(css).not.toMatch(/background:\s*#(fff|ffffff)\b/i);
    expect(css).not.toMatch(/#6f8680/i);
    expect(css).not.toMatch(/#a9c3c8/i);
  });

  it("neither stylesheet puts the page colour behind a label (it is the dark page in dark)", () => {
    for (const css of [STRIP(LOGIN_CSS), STRIP(WELCOME_CSS)]) {
      expect(css).not.toMatch(/\n\s*color:\s*var\(--lg-page\)/);
    }
  });

  it("neither stylesheet uses the teal fill as text", () => {
    for (const css of [STRIP(LOGIN_CSS), STRIP(WELCOME_CSS)]) {
      expect(css).not.toMatch(/\n\s*color:\s*var\(--lg-teal\)\s*;\s*\n\s*font/);
      expect(css).not.toMatch(/\n\s*stroke:\s*var\(--lg-teal\)/);
    }
  });
});
