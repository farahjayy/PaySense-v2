import { render, screen, within } from "@testing-library/react";
import axe from "axe-core";
import { cloneElement, type ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

import { MarginFan } from "@/components/forecast/MarginFan";
import type { Forecast } from "@/lib/api/queries";

// jsdom has no layout, so give the responsive wrapper a size of its own and the chart really draws.
vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("recharts")>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactElement<{ width?: number; height?: number }> }) =>
      cloneElement(children, { width: 600, height: 256 }),
  };
});

const SIM = {
  months: ["2026-10", "2026-11"],
  monthly_margin_p10_sen: [-5000, -9000],
  monthly_margin_p50_sen: [20000, 15000],
  monthly_margin_p90_sen: [40000, 35000],
  cumulative_margin_p10_sen: [-5000, -20000],
  cumulative_margin_p50_sen: [20000, 35000],
  cumulative_margin_p90_sen: [40000, 80000],
  p_shortfall: 0.2,
  worst_month: "2026-11",
  weeks: 8,
  horizon_capped: false,
  bootstrap: "paths",
} satisfies NonNullable<Forecast["simulation"]>;

describe("MarginFan", () => {
  it("describes the chart in words and repeats every number in a table", () => {
    render(<MarginFan simulation={SIM} />);

    expect(
      screen.getByRole("img", {
        name: /most likely about RM 350\.00.*tightest point is November 2026/i,
      }),
    ).toBeInTheDocument();

    const table = screen.getByRole("table", { name: /forecast running margin by month/i });
    const november = within(table).getByRole("row", { name: /november 2026/i });
    expect(within(november).getByText("-RM 200.00")).toBeInTheDocument();
    expect(within(november).getByText("RM 350.00")).toBeInTheDocument();
    expect(within(november).getByText("RM 800.00")).toBeInTheDocument();
    expect(within(november).getByText("tightest")).toBeInTheDocument();
  });

  it("names the columns with the tooltip's own words: this month alone, then the total so far", () => {
    render(<MarginFan simulation={SIM} />);

    const table = screen.getByRole("table", { name: /forecast running margin by month/i });
    const headers = within(table)
      .getAllByRole("columnheader")
      .map((h) => h.textContent);
    expect(headers).toEqual([
      "Month",
      "This month alone",
      "Total so far, lower outcome",
      "Total so far, most likely",
      "Total so far, higher outcome",
    ]);
  });

  it("says why the columns do not add up, instead of leaving the reader to think it is a mistake", () => {
    render(<MarginFan simulation={SIM} />);

    expect(screen.getByText(/do not add up line by line/i)).toBeInTheDocument();
    expect(screen.getByText(/typical total is not the sum of the typical months/i)).toBeInTheDocument();
  });

  it("puts a legend above the chart with the three things a student needs to read it", () => {
    const { container } = render(<MarginFan simulation={SIM} />);

    const legend = screen.getByRole("list", { name: /how to read this chart/i });
    const items = within(legend).getAllByRole("listitem");
    expect(items.map((i) => i.textContent)).toEqual([
      "Most likely",
      "Where 8 out of 10 possible futures land",
      "RM 0: below this you would be short of money",
    ]);
    // above the chart, not under it
    const chart = screen.getByRole("img", { name: /most likely about/i });
    expect(legend.compareDocumentPosition(chart) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // shape carries the meaning, not colour: a solid line, a filled block, a dashed line
    expect(items[0].querySelector("svg line:not([stroke-dasharray])")).not.toBeNull();
    expect(items[1].querySelector("svg rect")).not.toBeNull();
    expect(items[2].querySelector("svg line[stroke-dasharray]")).not.toBeNull();
    // the old three sentences under the chart are gone: the legend says them once
    expect(container.querySelector("figcaption")).toBeNull();
  });

  it("labels the lines on the chart itself: Most likely beside the last point, and RM 0 on the dashed line", () => {
    const { container } = render(<MarginFan simulation={SIM} />);

    const svg = container.querySelector("svg.recharts-surface") as SVGElement;
    expect(svg).not.toBeNull();
    const texts = [...svg.querySelectorAll("text")].map((t) => t.textContent);
    expect(texts.filter((t) => t === "Most likely")).toHaveLength(1);
    expect(texts).toContain("RM 0");
  });

  it("always keeps RM 0 on the scale, so the dashed line and its legend entry can never be missing", () => {
    const allAbove = {
      ...SIM,
      monthly_margin_p10_sen: [9000, 9000],
      cumulative_margin_p10_sen: [90000, 120000],
      cumulative_margin_p50_sen: [120000, 150000],
      cumulative_margin_p90_sen: [150000, 200000],
    } satisfies NonNullable<Forecast["simulation"]>;
    const { container } = render(<MarginFan simulation={allAbove} />);

    expect(container.querySelector(".recharts-reference-line line")).not.toBeNull();
  });

  it("keeps a text alternative and the table, the keyboard route to every number", () => {
    render(<MarginFan simulation={SIM} />);

    expect(screen.getByRole("img", { name: /most likely about/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /forecast numbers, scrollable/i })).toHaveAttribute(
      "tabindex",
      "0",
    );
  });

  it("has no accessibility violations: legend, drawn chart and table together", async () => {
    const { container } = render(<MarginFan simulation={SIM} />);

    expect(container.querySelector("svg.recharts-surface")).not.toBeNull(); // really drawn, not empty
    expect((await axe.run(container)).violations).toEqual([]);
  });
});
