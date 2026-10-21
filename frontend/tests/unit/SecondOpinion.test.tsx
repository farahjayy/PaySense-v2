import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AddsCard, ExposureDetails, StackTable } from "@/components/risk/SecondOpinion";
import type { SecondOpinion } from "@/lib/secondOpinion";

function opinion(patch: Partial<SecondOpinion> = {}): SecondOpinion {
  return {
    without_probability: 0.65,
    with_probability: 0.74,
    added_probability: 0.09,
    without_band: "At Risk",
    already_at_risk: true,
    stack: [
      { month: "2026-10", by_provider: [], new_plan_sen: 0, total_sen: 0, known_income_sen: 0 },
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

describe("a plan that had already started", () => {
  it("talks about the plan and what is still owed, not about a purchase", () => {
    render(<AddsCard opinion={opinion()} started />);

    expect(screen.getByRole("heading", { name: /what this plan adds/i })).toBeInTheDocument();
    expect(screen.getByText(/what is still owed on this plan/i)).toBeInTheDocument();
    expect(screen.getByText(/before you add it/i)).toBeInTheDocument();
    expect(screen.queryByText(/this purchase/i)).not.toBeInTheDocument();
  });

  it("labels the table's own column the same way", () => {
    render(<StackTable opinion={opinion()} started />);

    expect(screen.getByRole("columnheader", { name: "This plan" })).toBeInTheDocument();
  });
});

describe("StackTable beyond the window", () => {
  it("says what falls due after the last month shown", () => {
    render(<StackTable opinion={opinion({ beyond_sen: 70000 })} />);

    expect(screen.getByText(/RM 700\.00 more falls due after December 2026/i)).toBeInTheDocument();
  });

  it("says nothing about it when nothing does", () => {
    render(<StackTable opinion={opinion()} />);

    expect(screen.queryByText(/more falls due/i)).not.toBeInTheDocument();
  });
});

describe("AddsCard", () => {
  it("shows the chance without the purchase, with it, and the points it adds", () => {
    render(<AddsCard opinion={opinion()} />);

    expect(screen.getByRole("heading", { name: /what this purchase adds/i })).toBeInTheDocument();
    expect(screen.getByText("Without it").nextSibling).toHaveTextContent("65%");
    expect(screen.getByText("With it").nextSibling).toHaveTextContent("74%");
    expect(screen.getByText("Adds").nextSibling).toHaveTextContent("+9 points");
  });

  it("says when the student was already At Risk before buying anything", () => {
    render(<AddsCard opinion={opinion()} />);

    expect(screen.getByText(/you are already at risk without this purchase/i)).toBeInTheDocument();
    expect(screen.getByText(/65% before you buy anything/i)).toBeInTheDocument();
  });

  it("does not say that when the student was not", () => {
    render(
      <AddsCard
        opinion={opinion({ already_at_risk: false, without_band: "Safe", without_probability: 0.04 })}
      />,
    );

    expect(screen.queryByText(/already at risk/i)).not.toBeInTheDocument();
  });
});

describe("StackTable", () => {
  it("lists each month's debt by provider, this purchase, the total and the confirmed income", () => {
    render(<StackTable opinion={opinion()} />);

    const table = screen.getByRole("table", { name: /what you owe each month/i });
    const november = within(table).getByRole("row", { name: /november 2026/i });
    expect(november).toHaveTextContent("Atome RM 50.00");
    expect(november).toHaveTextContent("RM 266.33");
    expect(november).toHaveTextContent("RM 316.33");
    expect(november).toHaveTextContent("RM 2,000.00");
    const december = within(table).getByRole("row", { name: /december 2026/i });
    expect(december).toHaveTextContent("Nothing");
    expect(december).toHaveTextContent("None confirmed");
  });

  it("leaves out a month with nothing in it and says so", () => {
    render(<StackTable opinion={opinion()} />);

    expect(screen.queryByRole("row", { name: /october 2026/i })).not.toBeInTheDocument();
    expect(screen.getByText(/1 month with nothing due and no confirmed income is left out/i)).toBeInTheDocument();
  });
});

describe("ExposureDetails", () => {
  it("states what is owed before and after, and the providers and plans", () => {
    render(<ExposureDetails opinion={opinion()} />);

    expect(screen.getByText(/RM 100\.00 to RM 899\.00 with this purchase/i)).toBeInTheDocument();
    expect(screen.getByText(/1 provider to 2, 1 plan to 2/i)).toBeInTheDocument();
  });

  it("points to the Plans page when no limits were recorded, and judges nothing", () => {
    render(<ExposureDetails opinion={opinion()} />);

    expect(screen.getByRole("link", { name: /plans page/i })).toHaveAttribute("href", "/plans");
    expect(screen.queryByText(/at or above/i)).not.toBeInTheDocument();
  });

  it("compares recorded limits with the Bank Negara line as information only", () => {
    const withLimits = opinion({
      exposure: { ...opinion().exposure, recorded_limits_sen: 160000, reaches_bnm_line: true },
    });
    render(<ExposureDetails opinion={withLimits} />);

    expect(screen.getByText(/limits add up to RM 1,600\.00/i)).toBeInTheDocument();
    expect(screen.getByText(/at or above RM 1,500\.00/i)).toBeInTheDocument();
    expect(screen.getByText(/not a judgement on any provider/i)).toBeInTheDocument();
  });
});
