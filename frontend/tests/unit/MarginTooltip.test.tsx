import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MarginTooltip } from "@/components/forecast/MarginTooltip";
import type { MarginPoint } from "@/lib/forecast";

const POINT: MarginPoint = {
  month: "2026-11",
  label: "Nov 26",
  low: 45000,
  spread: 103000,
  middle: 124442,
  high: 148000,
};

describe("MarginTooltip", () => {
  it("names the month and all three values in plain words, higher first and lower last", () => {
    render(<MarginTooltip active payload={[{ payload: POINT }]} />);

    expect(screen.getByText("Nov 26")).toBeInTheDocument();
    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent("Higher outcome: RM 1,480.00");
    expect(rows[0]).toHaveTextContent("only 1 in 10 times you end up above this");
    expect(rows[1]).toHaveTextContent("Most likely: RM 1,244.42");
    expect(rows[1]).toHaveTextContent("the middle result");
    expect(rows[2]).toHaveTextContent("Lower outcome: RM 450.00");
    expect(rows[2]).toHaveTextContent("only 1 in 10 times you end up below this");
  });

  it("uses the chart's own band values, never a figure of its own", () => {
    const other: MarginPoint = { ...POINT, low: -2000, middle: 500, high: 9900, spread: 11900 };
    render(<MarginTooltip active payload={[{ payload: other }]} />);

    const rows = screen.getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("RM 99.00");
    expect(rows[1]).toHaveTextContent("RM 5.00");
    expect(rows[2]).toHaveTextContent("-RM 20.00");
  });

  it("marks the middle with a solid dot and the two edges with hollow ones, so shape says which is which", () => {
    render(<MarginTooltip active payload={[{ payload: POINT }]} />);

    const rows = screen.getAllByRole("listitem");
    const marker = (row: HTMLElement) => row.querySelector("[data-marker]") as SVGElement;
    expect(marker(rows[0])).toHaveAttribute("data-marker", "hollow");
    expect(marker(rows[1])).toHaveAttribute("data-marker", "solid");
    expect(marker(rows[2])).toHaveAttribute("data-marker", "hollow");
    for (const row of rows) expect(marker(row)).toHaveAttribute("aria-hidden", "true");
  });

  it("is a labelled list, so a screen reader hears the three values together", () => {
    render(<MarginTooltip active payload={[{ payload: POINT }]} />);

    expect(within(screen.getByRole("list", { name: /nov 26/i })).getAllByRole("listitem")).toHaveLength(3);
  });

  it("shows nothing when nothing is hovered", () => {
    const { container, rerender } = render(<MarginTooltip active={false} payload={[]} />);
    expect(container).toBeEmptyDOMElement();

    rerender(<MarginTooltip active payload={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
