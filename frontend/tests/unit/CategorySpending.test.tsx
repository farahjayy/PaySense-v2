import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CategorySpending } from "@/components/transactions/CategorySpending";
import type { CategorySummary } from "@/lib/api/queries";

const SUMMARY: CategorySummary = {
  month: "2026-07",
  income_sen: 100000,
  spend_sen: 100000,
  gross_spend_sen: 100000,
  refund_sen: 0,
  savings_sen: 0,
  categories: [
    { category: "Food", spend_sen: 60000, count: 1, share: 0.6 },
    { category: "Transport", spend_sen: 35000, count: 1, share: 0.35 },
    { category: "Gifts", spend_sen: 3000, count: 1, share: 0.02 },
    { category: "Stationery", spend_sen: 2000, count: 1, share: 0.01 },
  ],
};

function show(onSelect = vi.fn(), selected?: string) {
  render(
    <CategorySpending
      month="2026-07"
      summary={SUMMARY}
      isPending={false}
      error={null}
      selected={selected}
      onSelect={onSelect}
    />,
  );
  return onSelect;
}

describe("CategorySpending", () => {
  it("draws the month as one bar whose description gives every share", () => {
    show();

    expect(
      screen.getByRole("img", {
        name: "Spending split: Food 60%, Transport 35%, Others 3%",
      }),
    ).toBeInTheDocument();
  });

  it("folds the small categories into one Others row that says how many it holds", () => {
    show();

    const others = screen.getByText("Others").closest("li");
    expect(others).toHaveTextContent("2 small ones");
    expect(others).toHaveTextContent("RM 50.00");
    expect(within(others as HTMLElement).queryByRole("button")).toBeNull();
  });

  it("makes a real category a button that filters, and a second press clears it", async () => {
    const onSelect = show();

    await userEvent.click(screen.getByRole("button", { name: /food/i }));
    expect(onSelect).toHaveBeenLastCalledWith("Food");
  });

  it("shows the chosen category as pressed, and pressing it again clears the filter", async () => {
    const onSelect = show(vi.fn(), "Food");

    const food = screen.getByRole("button", { name: /food/i });
    expect(food).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(food);
    expect(onSelect).toHaveBeenLastCalledWith(undefined);
  });
});
