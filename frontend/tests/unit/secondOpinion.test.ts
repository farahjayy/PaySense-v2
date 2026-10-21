import { describe, expect, it } from "vitest";

import {
  exposureSummary,
  formatPoints,
  pointsAdded,
  stackSummary,
  visibleMonths,
  type SecondOpinion,
} from "@/lib/secondOpinion";

function opinion(patch: Partial<SecondOpinion> = {}): SecondOpinion {
  return {
    without_probability: 0.65,
    with_probability: 0.74,
    added_probability: 0.09,
    without_band: "At Risk",
    already_at_risk: true,
    stack: [
      {
        month: "2026-10",
        by_provider: [],
        new_plan_sen: 0,
        total_sen: 0,
        known_income_sen: 0,
      },
      {
        month: "2026-11",
        by_provider: [{ provider_label: "Atome", amount_sen: 5000 }],
        new_plan_sen: 26633,
        total_sen: 31633,
        known_income_sen: 200000,
      },
      {
        month: "2026-12",
        by_provider: [],
        new_plan_sen: 26633,
        total_sen: 26633,
        known_income_sen: 0,
      },
    ],
    peak: { month: "2026-11", total_sen: 31633 },
    beyond_sen: 0,
    exposure: {
      unpaid_before_sen: 10000,
      unpaid_after_sen: 89900,
      providers_before: ["Atome"],
      providers_after: ["Atome", "SPayLater"],
      plans_before: 1,
      plans_after: 2,
      recorded_limits_sen: null,
      reaches_bnm_line: null,
      bnm_line_sen: 150000,
    },
    ...patch,
  };
}

describe("pointsAdded", () => {
  it("is the gap between the two percentages as they are shown, so the tiles add up", () => {
    expect(pointsAdded(opinion())).toBe(9);
    // 74.6% shows as 75% and 65.4% as 65%: the tile says 10, not the 9.2 underneath
    expect(
      pointsAdded(
        opinion({ with_probability: 0.746, without_probability: 0.654 }),
      ),
    ).toBe(10);
  });

  it("is never negative", () => {
    expect(
      pointsAdded(opinion({ with_probability: 0.3, without_probability: 0.3 })),
    ).toBe(0);
  });
});

describe("formatPoints", () => {
  it("reads as points, singular for one", () => {
    expect(formatPoints(9)).toBe("+9 points");
    expect(formatPoints(1)).toBe("+1 point");
    expect(formatPoints(0)).toBe("+0 points");
  });
});

describe("stackSummary", () => {
  it("names the heaviest month and what is owed in it", () => {
    expect(stackSummary(opinion())).toBe(
      "Most owed: RM 316.33 in November 2026",
    );
  });

  it("says so when nothing is owed", () => {
    expect(stackSummary(opinion({ peak: null }))).toBe(
      "Nothing owed in the months ahead",
    );
  });
});

describe("exposureSummary", () => {
  it("shows the unpaid total before and after, and how many providers and plans", () => {
    expect(exposureSummary(opinion())).toBe(
      "RM 100.00 to RM 899.00, 2 providers, 2 plans",
    );
  });

  it("is singular for one provider and one plan", () => {
    const one = opinion({
      exposure: {
        ...opinion().exposure,
        unpaid_before_sen: 0,
        unpaid_after_sen: 79900,
        providers_after: ["SPayLater"],
        plans_after: 1,
      },
    });
    expect(exposureSummary(one)).toBe(
      "RM 0.00 to RM 799.00, 1 provider, 1 plan",
    );
  });
});

describe("visibleMonths", () => {
  it("leaves out a month with nothing owed and no confirmed income, and says how many", () => {
    const { months, hidden } = visibleMonths(opinion());

    expect(months.map((m) => m.month)).toEqual(["2026-11", "2026-12"]);
    expect(hidden).toBe(1);
  });
});
