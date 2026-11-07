import { describe, expect, it } from "vitest";

import { findSimilarItem } from "@/lib/recurring";

const RENT = {
  id: "r1",
  kind: "bill" as const,
  name: "Rent",
  match_text: "rent",
  amount_sen: 40000,
  cadence: "monthly" as const,
  custom_interval_days: null,
  anchor_date: "2026-09-01",
  active: true,
  origin: "manual" as const,
};

describe("findSimilarItem", () => {
  it("finds an item with the same kind, name, amount and cadence", () => {
    const candidate = {
      kind: "bill" as const,
      name: "Rent",
      amount_sen: 40000,
      cadence: "monthly" as const,
    };

    expect(findSimilarItem([RENT], candidate)).toBe(RENT);
  });

  it("ignores case and spaces around the name", () => {
    const candidate = {
      kind: "bill" as const,
      name: "  rent ",
      amount_sen: 40000,
      cadence: "monthly" as const,
    };

    expect(findSimilarItem([RENT], candidate)).toBe(RENT);
  });

  it("does not match a different amount, kind, name or cadence", () => {
    const base = {
      kind: "bill" as const,
      name: "Rent",
      amount_sen: 40000,
      cadence: "monthly" as const,
    };

    expect(findSimilarItem([RENT], { ...base, amount_sen: 40001 })).toBeUndefined();
    expect(findSimilarItem([RENT], { ...base, kind: "income" as const })).toBeUndefined();
    expect(findSimilarItem([RENT], { ...base, name: "Rental" })).toBeUndefined();
    expect(findSimilarItem([RENT], { ...base, cadence: "weekly" as const })).toBeUndefined();
  });

  it("tells two custom intervals apart", () => {
    const every10 = {
      ...RENT,
      cadence: "custom" as const,
      custom_interval_days: 10,
    };
    const candidate = {
      kind: "bill" as const,
      name: "Rent",
      amount_sen: 40000,
      cadence: "custom" as const,
    };

    expect(findSimilarItem([every10], { ...candidate, custom_interval_days: 10 })).toBe(every10);
    expect(findSimilarItem([every10], { ...candidate, custom_interval_days: 12 })).toBeUndefined();
  });

  it("returns undefined for an empty list", () => {
    const candidate = {
      kind: "bill" as const,
      name: "Rent",
      amount_sen: 40000,
      cadence: "monthly" as const,
    };

    expect(findSimilarItem([], candidate)).toBeUndefined();
  });
});
