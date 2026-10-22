import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NotificationsScreen } from "@/components/screens/NotificationsScreen";
import { forgetNoticesForTests } from "@/lib/noticeStore";
import { saveSession } from "@/lib/session";

const get = vi.fn();
vi.mock("@/lib/api/client", () => ({ api: { GET: (...a: unknown[]) => get(...a) } }));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const FORECAST = {
  status: "ok",
  is_stale: false,
  stale_days: null,
  data_through: "2026-10-24",
  unmatched_items: [],
  simulation: null,
  suspect_months: [
    { month: "2026-08", reason: "low_spend", detail: "Spending is far below your usual." },
    { month: "2026-08", reason: "no_income", detail: "No income is logged this month." },
    { month: "2026-09", reason: "no_income", detail: "No income is logged this month." },
  ],
};
const OVERDUE = {
  rule: "overdue",
  severity: "high",
  title: "2 instalments are overdue",
  detail: "RM 140.50 is owed.",
  href: "/plans",
};

function serve(forecast: unknown = FORECAST, alerts: unknown[] = []) {
  get.mockImplementation(async (path: string) => {
    const data = path === "/api/forecast" ? forecast : path === "/api/alerts" ? { items: alerts } : null;
    if (data === null) throw new Error(`unexpected GET ${path}`);
    return { data, error: undefined, response: { ok: true, status: 200 } };
  });
}

beforeEach(() => {
  get.mockReset();
  window.localStorage.clear();
  forgetNoticesForTests();
  saveSession({
    token: "t",
    expiresAt: Date.now() + 60_000,
    user: { id: "u1", username: "amir", display_name: "Amir", persona: null },
  });
});

describe("NotificationsScreen (ADR D-62)", () => {
  it("lists every current notice and alert in one place, each month once", async () => {
    serve(FORECAST, [OVERDUE]);
    render(<NotificationsScreen />, { wrapper });

    const current = await screen.findByRole("region", { name: "Needs your attention" });
    expect(within(current).getByText("2 instalments are overdue")).toBeInTheDocument();
    expect(within(current).getAllByText(/looks incomplete/i)).toHaveLength(2);
    expect(within(current).getByText("August 2026 looks incomplete")).toBeInTheDocument();
    expect(within(current).getAllByRole("link", { name: "Import" })).toHaveLength(2);
  });

  it("moves a closed notice to a Closed list where it can be restored", async () => {
    serve();
    render(<NotificationsScreen />, { wrapper });
    const current = await screen.findByRole("region", { name: "Needs your attention" });

    await userEvent.click(within(current).getByRole("button", { name: /close: august 2026/i }));

    expect(within(current).queryByText("August 2026 looks incomplete")).not.toBeInTheDocument();
    const closed = screen.getByRole("region", { name: "Closed" });
    expect(within(closed).getByText("August 2026 looks incomplete")).toBeInTheDocument();

    await userEvent.click(within(closed).getByRole("button", { name: /restore: august 2026/i }));

    expect(screen.queryByRole("region", { name: "Closed" })).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Needs your attention" })).getByText(
        "August 2026 looks incomplete",
      ),
    ).toBeInTheDocument();
  });

  it("says plainly that nothing needs attention when all is well", async () => {
    serve({ ...FORECAST, suspect_months: [] }, []);
    render(<NotificationsScreen />, { wrapper });

    expect(await screen.findByText(/nothing needs your attention/i)).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Closed" })).not.toBeInTheDocument();
  });

  it("shows an error with a retry when the forecast cannot be read, never an empty list", async () => {
    get.mockResolvedValue({
      data: undefined,
      error: { detail: { code: "x", message: "down" } },
      response: { ok: false, status: 500 },
    });
    render(<NotificationsScreen />, { wrapper });

    expect(await screen.findByText(/down/)).toBeInTheDocument();
    expect(screen.queryByText(/nothing needs your attention/i)).not.toBeInTheDocument();
  });
});
