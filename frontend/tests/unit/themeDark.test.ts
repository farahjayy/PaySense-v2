/**
 * The dark palette (ADR D-58), checked from the tokens in globals.css exactly as the light one is
 * in theme.test.ts: every text pairing reaches WCAG AA, every border or chart line that must be
 * seen reaches 3:1. axe cannot judge contrast in jsdom, so this is where it is enforced.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const CSS = readFileSync(path.join(ROOT, "app", "globals.css"), "utf8");

const DARK_BLOCK = /\[data-theme="dark"\]\s*\{([^}]*)\}/.exec(CSS)?.[1] ?? "";
const LIGHT_BLOCK = /@theme\s*\{([^}]*)\}/.exec(CSS)?.[1] ?? "";

function tokens(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)) out[m[1]] = m[2];
  return out;
}

const dark = tokens(DARK_BLOCK);
const light = tokens(LIGHT_BLOCK);

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

const TEXT_PAIRS: [string, string, number][] = [
  ["ink", "page", 7],
  ["ink", "surface", 7],
  ["ink-secondary", "page", 4.5],
  ["ink-secondary", "surface", 4.5],
  ["ink-muted", "page", 4.5],
  ["ink-muted", "surface", 4.5],
  ["accent", "page", 4.5],
  ["accent", "surface", 4.5],
  ["accent", "accent-bg", 4.5],
  ["success", "surface", 4.5],
  ["success", "success-bg", 4.5],
  ["warning", "surface", 4.5],
  ["warning", "warning-bg", 4.5],
  ["danger", "surface", 4.5],
  ["danger", "danger-bg", 4.5],
  ["sidebar-ink", "sidebar", 7],
  ["sidebar-muted", "sidebar", 4.5],
  ["on-accent", "accent", 4.5],
  ["on-accent", "danger", 4.5],
  ["page", "ink", 7], // the label on a solid ink button
  ["on-switch", "switch-thumb", 7], // DARK / LIGHT on the black thumb (ADR D-59)
];

const NON_TEXT_PAIRS: [string, string][] = [
  ["field", "surface"],
  ["field", "page"],
  ["chart-edge", "surface"],
  ["accent", "surface"],
  ["accent", "page"],
];

describe("dark palette (ADR D-58)", () => {
  it("is declared, and tells native controls (date pickers, scrollbars) to follow", () => {
    expect(DARK_BLOCK).not.toBe("");
    expect(DARK_BLOCK).toMatch(/color-scheme:\s*dark/);
  });

  it("redefines every colour the light theme defines, so no screen keeps a light leftover", () => {
    expect(Object.keys(dark).sort()).toEqual(Object.keys(light).sort());
  });

  it.each(TEXT_PAIRS)("%s on %s reaches %s:1", (fg, bg, target) => {
    expect(contrast(dark[fg], dark[bg])).toBeGreaterThanOrEqual(target);
  });

  it.each(NON_TEXT_PAIRS)("%s on %s reaches 3:1", (fg, bg) => {
    expect(contrast(dark[fg], dark[bg])).toBeGreaterThanOrEqual(3);
  });

  it("keeps each result's meaning: Safe stays green, Caution amber, At Risk red", () => {
    const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const [sr, sg, sb] = rgb(dark.success);
    const [wr, wg, wb] = rgb(dark.warning);
    const [dr, dg, db] = rgb(dark.danger);
    expect(sg).toBeGreaterThan(Math.max(sr, sb));
    expect(wr).toBeGreaterThan(wb);
    expect(wg).toBeGreaterThan(wb);
    expect(dr).toBeGreaterThan(Math.max(dg, db));
  });

  it("is a different surface from the light one: the page is dark and the ink is light", () => {
    expect(luminance(dark.page)).toBeLessThan(0.05);
    expect(luminance(dark.ink)).toBeGreaterThan(0.7);
  });
});

describe("text on a solid button, in both modes", () => {
  it.each([
    ["light", light],
    ["dark", dark],
  ] as const)("on-accent reads on the accent and on the danger button in %s", (_mode, t) => {
    expect(contrast(t["on-accent"], t.accent)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t["on-accent"], t.danger)).toBeGreaterThanOrEqual(4.5);
  });

  it("is white in the light theme, as before", () => {
    expect(light["on-accent"].toLowerCase()).toBe("#ffffff");
  });
});

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return full.endsWith(".tsx") ? [full] : [];
  });
}

describe("no fixed text colour on a themed background", () => {
  it("uses text-on-accent, never text-white, in the components", () => {
    const offenders = sourceFiles(path.join(ROOT, "components")).filter((file) =>
      /\btext-white\b/.test(readFileSync(file, "utf8")),
    );

    expect(offenders.map((f) => path.relative(ROOT, f))).toEqual([]);
  });
});


describe("the faces keep their bright look in both modes (ADR D-58)", () => {
  // Safe / Caution / At Risk are characters, drawn as pastel tiles with a dark face. In dark they
  // first took the dark result shades and looked burnt; they keep the same pastel in both modes.
  const FACE = ["face-safe", "face-safe-bg", "face-caution", "face-caution-bg", "face-risk", "face-risk-bg", "face-ink"];

  it.each(FACE)("%s is the same colour in light and dark", (name) => {
    expect(light[name]).toBeDefined();
    expect(dark[name]).toBe(light[name]);
  });

  it.each([
    ["face-safe", "face-safe-bg"],
    ["face-caution", "face-caution-bg"],
    ["face-risk", "face-risk-bg"],
    ["face-ink", "rosy"],
  ])("%s reads on %s at 4.5:1", (fg, bg) => {
    expect(contrast(dark[fg], dark[bg])).toBeGreaterThanOrEqual(4.5);
  });

  it("draws the faces from those tokens, not from colours that change with the theme", () => {
    const source = readFileSync(path.join(ROOT, "components", "ui", "Face.tsx"), "utf8");

    expect(source).not.toMatch(/(?:text|fill)-(?:success|warning|danger|ink)/);
    expect(source).toMatch(/face-safe/);
    expect(source).toMatch(/face-risk/);
  });
});


describe("the danger line and the divider in dark (contrast audit)", () => {
  it("use the audited colours", () => {
    expect(dark["chart-red"].toLowerCase()).toBe("#f89c9b");
    expect(dark.line.toLowerCase()).toBe("#35544f");
  });

  it("keep the danger line at least 3:1 against the chart band and against the card", () => {
    expect(contrast(dark["chart-red"], dark["chart-blue"])).toBeGreaterThanOrEqual(3);
    expect(contrast(dark["chart-red"], dark.surface)).toBeGreaterThanOrEqual(3);
  });

  it("keeps the divider visible without shouting: at least 1.8:1 on a card and 2:1 on the page", () => {
    expect(contrast(dark.line, dark.surface)).toBeGreaterThanOrEqual(1.8);
    expect(contrast(dark.line, dark.page)).toBeGreaterThanOrEqual(2);
  });

  it("leaves every other token as it was, so only the audited three changed", () => {
    const unchanged: Record<string, string> = {
      page: "#0e1f1d", surface: "#142a27", "surface-2": "#19332f", field: "#7da39b",
      ink: "#eef4ee", "ink-secondary": "#b7cbc4", "ink-muted": "#9cb5ad", accent: "#6cc4d3",
      "accent-bg": "#14414a", "on-accent": "#06262d", success: "#8fd16a", "success-bg": "#1f3519",
      warning: "#f2b865", "warning-bg": "#3b2a10", danger: "#f59a9a", "danger-bg": "#43201f",
      sidebar: "#0a2f37", "sidebar-ink": "#f1eecf", "sidebar-muted": "#b9d1cb", rosy: "#d3968c",
      "chart-blue": "#2b6672", "chart-edge": "#5fb4c4",
    };
    for (const [name, value] of Object.entries(unchanged)) {
      expect(dark[name].toLowerCase(), name).toBe(value);
    }
  });
});


describe("the danger lines the charts actually draw, in dark (they use --color-danger)", () => {
  it("are at least 3:1 against the chart band and the card", () => {
    expect(contrast(dark.danger, dark["chart-blue"])).toBeGreaterThanOrEqual(3);
    expect(contrast(dark.danger, dark.surface)).toBeGreaterThanOrEqual(3);
  });
});
