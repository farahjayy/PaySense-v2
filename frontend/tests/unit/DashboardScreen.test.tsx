import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardScreen } from "@/components/screens/DashboardScreen";

const get = vi.fn();
vi.mock("@/lib/api/client", () => ({ api: { GET: (...args: unknown[]) => get(...args) } }));
vi.mock("@/lib/session", () => ({
  useAuth: () => ({ session: { user: { display_name: "Amir" } } }),
}));
vi.mock("next/dynamic", () => ({
  default: () =>
    function Chart() {
      return <div data-testid="margin-fan" />;
    },
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const OK = {
  status: "ok",
  as_of: "2026-10-09",
  model: "lstm",
  months_of_history: 6,
  data_through: "2026-10-08",
  stale_days: 1,
  is_stale: false,
  unmatched_items: [],
  suspect_months: [],
  lock_reason: null,
  band: "Caution",
  health_score: 78,
  simulation: {
    months: ["2026-10", "2026-11"],
    monthly_margin_p10_sen: [0, 0],
    monthly_margin_p50_sen: [1, 1],
    monthly_margin_p90_sen: [2, 2],
    cumulative_margin_p10_sen: [0, 0],
    cumulative_margin_p50_sen: [1, 2],
    cumulative_margin_p90_sen: [2, 4],
    p_shortfall: 0.22,
    worst_month: "2026-10",
    weeks: 8,
    horizon_capped: false,
    bootstrap: "paths",
  },
};

const BILLS = {
  months: [
    {
      month: "2026-10",
      is_current: true,
      total_due_sen: 5000,
      paid_total_sen: 0,
      fully_paid: false,
      has_overdue: false,
      items: [
        {
          plan_id: "p1",
          item_name: "Headphones",
          provider: "atome",
          provider_label: "Atome",
          seq: 1,
          amount_sen: 5000,
          due_date: "2026-10-20",
          is_paid: false,
        },
      ],
    },
  ],
};

const SUMMARY = {
  months: [
    {
      month: "2026-09",
      income_sen: 200000,
      spend_sen: 150000,
      refund_sen: 0,
      savings_sen: 0,
      net_sen: 50000,
    },
  ],
  history: null,
};

function respond(forecast: unknown, extra: Record<string, unknown> = {}) {
  const data: Record<string, unknown> = {
    "/api/forecast": forecast,
    "/api/bills": BILLS,
    "/api/summary/months": SUMMARY,
    "/api/recurring-items": [],
    "/api/provider-limits": [],
    "/api/plans": [],
    ...extra,
  };
  get.mockImplementation(async (path: string) => ({
    data: data[path],
    error: undefined,
    response: { ok: true, status: 200 },
  }));
}

describe("DashboardScreen", () => {
  beforeEach(() => {
    get.mockReset();
  });

  it("shows the score, band, plain-language line and the chance of a shortfall", async () => {
    respond(OK);
    render(<DashboardScreen />, { wrapper });

    expect(
      await screen.findByRole("img", { name: /score 78 out of 100, caution/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/most months should work/i)).toBeInTheDocument();
    expect(screen.getByText(/there is a 22% chance you would run short of money/i)).toBeInTheDocument();
    expect(await screen.findByTestId("margin-fan")).toBeInTheDocument();
    expect(await screen.findByText("Headphones")).toBeInTheDocument();
    expect(await screen.findByText("RM 500.00")).toBeInTheDocument();
  });

  it("shows how far the person is from unlocking instead of a number when history is short", async () => {
    respond({
      ...OK,
      status: "locked",
      simulation: null,
      band: null,
      health_score: null,
      months_of_history: 2,
      lock_reason: "needs_four_months",
    });
    render(<DashboardScreen />, { wrapper });

    expect(await screen.findByText(/unlocks with four months/i)).toBeInTheDocument();
    expect(screen.getByText(/2 of 4 logged/i)).toBeInTheDocument();
    // one line with an Import link; the full box with its progress bar lives on Transactions
    expect(screen.queryByRole("progressbar", { name: /months of history/i })).toBeNull();
    expect(screen.getAllByRole("link", { name: "Import" }).length).toBeGreaterThan(0);
    expect(screen.queryByTestId("margin-fan")).not.toBeInTheDocument();
  });

  it("keeps the forecast's place on the page, locked and with no numbers, for the tour to point at", async () => {
    respond({
      ...OK,
      status: "locked",
      simulation: null,
      band: null,
      health_score: null,
      months_of_history: 0,
      lock_reason: "needs_four_months",
    });
    render(<DashboardScreen />, { wrapper });

    expect(await screen.findByText(/unlocks with four months/i)).toBeInTheDocument();
    const card = document.querySelector<HTMLElement>('[data-tour="forecast"]');
    expect(card).not.toBeNull();
    expect(card).toHaveTextContent(/financial health/i);
    expect(card).toHaveTextContent(/unlocks with four months/i);
    // the picture is a shape only: no score, no band, no chart data
    expect(screen.queryByRole("img", { name: /score/i })).toBeNull();
    expect(card?.textContent).not.toMatch(/\d{2,}/);
    expect(screen.queryByTestId("margin-fan")).not.toBeInTheDocument();
  });

  it("draws the locked card with a Locked badge and no empty chart box below it", async () => {
    respond({
      ...OK,
      status: "locked",
      simulation: null,
      band: null,
      health_score: null,
      months_of_history: 0,
      lock_reason: "needs_four_months",
    });
    render(<DashboardScreen />, { wrapper });

    await screen.findByText(/unlocks with four months/i);
    const card = document.querySelector<HTMLElement>('[data-tour="forecast"]') as HTMLElement;
    expect(card).toHaveTextContent("Locked");
    expect(
      screen.queryByText(/how much money you would have left over/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/chart appears here/i)).not.toBeInTheDocument();
  });

  it("puts data-quality warnings beside the number", async () => {
    respond({ ...OK, is_stale: true, stale_days: 30, data_through: "2026-09-09" });
    render(<DashboardScreen />, { wrapper });

    expect(await screen.findByText(/your ledger is out of date/i)).toBeInTheDocument();
  });

  it("explains a failure and lets the person retry", async () => {
    get.mockImplementation(async (path: string) =>
      path === "/api/forecast"
        ? {
            data: undefined,
            error: { detail: { code: "x", message: "Forecast is unavailable." } },
            response: { ok: false, status: 500 },
          }
        : {
            data: path === "/api/bills" ? BILLS : path === "/api/summary/months" ? SUMMARY : [],
            error: undefined,
            response: { ok: true, status: 200 },
          },
    );
    render(<DashboardScreen />, { wrapper });

    expect(await screen.findByText("Forecast is unavailable.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("states the chance of running short in plain words, not as a share of simulated futures", async () => {
    respond(OK);
    render(<DashboardScreen />, { wrapper });

    expect(
      await screen.findByText(/there is an? \d+% chance you would run short of money/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/dips below zero/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/of the futures we simulated over the next/i)).not.toBeInTheDocument();
  });

  it("titles the health card, like the cards below it, and drops the method line and the word futures", async () => {
    respond(OK);
    render(<DashboardScreen />, { wrapper });

    expect(await screen.findByRole("heading", { name: "Your financial health" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: /financial health forecast/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/played your recent income and spending forward/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/futures/i)).not.toBeInTheDocument();
  });

  it("says in plain words what the running margin starts from and what each point means", async () => {
    respond(OK);
    render(<DashboardScreen />, { wrapper });

    expect(
      await screen.findByRole("heading", {
        name: "How much money you would have left over, month by month",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Your running margin")).not.toBeInTheDocument();
    expect(await screen.findByText(/imagine you start october 2026 with rm 0/i)).toBeInTheDocument();
    expect(screen.getByText(/how much money you would have left by the end of that month/i)).toBeInTheDocument();
    expect(screen.getByText(/counting everything since october/i)).toBeInTheDocument();
    expect(screen.getByText(/if a point falls below rm 0, you would be short/i)).toBeInTheDocument();
    expect(screen.getByText(/your real savings aren't included/i)).toBeInTheDocument();
  });

  it("titles the logged-months card for what it holds, and marks the unfinished month", async () => {
    // The forecast starts in October 2026, so October is the month still going.
    const october = { ...SUMMARY.months[0], month: "2026-10", income_sen: 0, net_sen: -150000 };
    respond(OK, { "/api/summary/months": { months: [october, SUMMARY.months[0]], history: null } });
    render(<DashboardScreen />, { wrapper });

    expect(await screen.findByRole("heading", { name: "Monthly money summary" })).toBeInTheDocument();
    expect(screen.getByText("Logged income and spending, by month")).toBeInTheDocument();
    expect(screen.queryByText("Recent months")).not.toBeInTheDocument();
    expect(await screen.findByRole("rowheader", { name: "Oct 2026 (so far)" })).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: "Sep 2026" })).toBeInTheDocument();
  });

  it("tells a student what to do next, and why, while steps are still open", async () => {
    respond(OK);
    render(<DashboardScreen />, { wrapper });

    const steps = await screen.findByRole("list", { name: /getting started steps/i });
    expect(within(steps).getByText("Confirm your regular bills and income")).toBeInTheDocument();
    expect(within(steps).getByRole("link", { name: /recurring items/i })).toHaveAttribute(
      "href",
      "/recurring",
    );
  });

  it("puts the instalments and the recent months side by side, both on the page", async () => {
    respond(OK);
    render(<DashboardScreen />, { wrapper });

    expect(await screen.findByText("BNPL instalments due")).toBeInTheDocument();
    expect(await screen.findByRole("table", { name: /income, spending and net by month/i })).toBeInTheDocument();
  });
});
