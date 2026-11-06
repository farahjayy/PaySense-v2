import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ReviewList } from "@/components/import/ReviewList";
import type { ReviewRow } from "@/lib/import";

function row(patch: Partial<ReviewRow>): ReviewRow {
  return {
    row: 1,
    date: "2026-06-01",
    amountSen: 1223,
    type: "expense",
    category: "Food",
    description: "KFC",
    issues: [],
    duplicate: false,
    include: true,
    ...patch,
  };
}

const CATEGORIES = ["Food", "Other", "Salary"];

function renderRows(rows: ReviewRow[], lookOf?: (name: string) => undefined) {
  return render(
    <ReviewList rows={rows} categories={CATEGORIES} onChange={vi.fn()} lookOf={lookOf} />,
  );
}

describe("ReviewList colours", () => {
  it("shows each row's category as its coloured tile beside the category choice", () => {
    renderRows([row({ row: 1, category: "Food" }), row({ row: 2, category: "Other" })]);

    const items = screen.getAllByRole("listitem");
    for (const item of items) expect(within(item).getByTestId("category-tile")).toBeInTheDocument();
    const tiles = items.map((i) => within(i).getByTestId("category-tile").getAttribute("style"));
    expect(tiles[0]).not.toBe(tiles[1]);
  });

  it("colours the type choice by what it is: green for income, salmon for spending, teal for savings", () => {
    renderRows([
      row({ row: 1, type: "income" }),
      row({ row: 2, type: "expense" }),
      row({ row: 3, type: "savings" }),
    ]);

    expect(screen.getByLabelText("Type for row 1")).toHaveClass("text-income", "bg-income-bg");
    expect(screen.getByLabelText("Type for row 2")).toHaveClass("text-pop", "bg-pop-bg");
    expect(screen.getByLabelText("Type for row 3")).toHaveClass("text-accent", "bg-accent-bg");
  });

  it("shows income amounts in green and leaves spending in the normal ink", () => {
    renderRows([
      row({ row: 1, type: "income", amountSen: 5687 }),
      row({ row: 2, type: "expense", amountSen: 1223 }),
    ]);

    expect(screen.getByText("RM 56.87")).toHaveClass("text-income");
    expect(screen.getByText("RM 12.23")).not.toHaveClass("text-income");
  });
});
