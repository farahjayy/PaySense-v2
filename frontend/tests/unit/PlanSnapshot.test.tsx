import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PlansScreen } from "@/components/screens/PlansScreen";

const get = vi.fn();
const post = vi.fn();
vi.mock("@/lib/api/client", () => ({
  api: {
    GET: (...a: unknown[]) => get(...a),
    POST: (...a: unknown[]) => post(...a),
    PUT: vi.fn(),
    DELETE: vi.fn(),
  },
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const PROVIDERS = [
  {
    key: "spaylater",
    label: "SPayLater",
    rule_driven: true,
    checkout_instalments: 0,
    start_rule: "months_after_purchase",
    start_offset_months: 1,
    monthly_fee_applies: true,
  },
];

// Dates far from today on both sides, so the test never depends on the day it runs.
function preview(installments: Array<[number, string, boolean?]>) {
  return {
    provider: "spaylater",
    provider_label: "SPayLater",
    schedule_source: "provider_rule",
    total_price_sen: 60000,
    financed_sen: 60000,
    upfront_sen: 0,
    total_payable_sen: 60000,
    fee_sen: 0,
    total_cost_sen: 60000,
    cash_at_purchase_sen: 0,
    monthly_fee_rate_pct: 0,
    num_installments: installments.length,
    purchase_date: "2020-01-01",
    first_payment_date: installments[0][1],
    limit_known: false,
    remaining_limit_sen: null,
    installments: installments.map(([seq, due, checkout]) => ({
      seq,
      due_date: due,
      amount_sen: 60000 / installments.length,
      paid_at_checkout: checkout ?? false,
    })),
  };
}

const STARTED = preview([
  [1, "2020-02-01"],
  [2, "2020-03-01"],
  [3, "2099-04-01"],
]);
const NOT_STARTED = preview([
  [1, "2099-02-01"],
  [2, "2099-03-01"],
]);

const PLAN = {
  id: "p1",
  item_name: "Headphones",
  provider: "spaylater",
  provider_label: "SPayLater",
  schedule_source: "provider_rule",
  total_price_sen: 30000,
  financed_sen: 30000,
  upfront_sen: 0,
  monthly_fee_rate_pct: 0,
  num_installments: 3,
  purchase_date: "2026-10-01",
  first_payment_date: "2026-10-01",
  status: "active",
  installment_amount_sen: 10000,
  total_payable_sen: 30000,
  paid_count: 1,
  remaining_count: 2,
  next_due_date: "2026-11-01",
  risk_score_at_creation: 58,
  risk_check_id: "chk1",
  risk_check_type: "before_purchase",
  risk_band: "At Risk",
  added_on: "2026-10-01",
  installments: [
    {
      seq: 1,
      due_date: "2026-10-01",
      amount_sen: 10000,
      is_paid: true,
      paid_date: "2026-10-01",
    },
    {
      seq: 2,
      due_date: "2026-11-01",
      amount_sen: 10000,
      is_paid: false,
      paid_date: null,
    },
    {
      seq: 3,
      due_date: "2026-12-01",
      amount_sen: 10000,
      is_paid: false,
      paid_date: null,
    },
  ],
};

const REPORT = {
  status: "ok",
  lock_reason: null,
  months_of_history: 6,
  stale_days: 1,
  unmatched_items: [],
  suspect_months: [],
  plan: STARTED,
  probability: 0.42,
  band: "At Risk",
  score: 58,
  simulated_probability: null,
  simulated_band: null,
  probability_without_purchase: 0.1,
  factors: [
    {
      feature: "dsr",
      text: "About 40% of your monthly income would go on BNPL.",
      contribution: 0.08,
    },
  ],
  suggestion: {
    status: "found",
    basis: "model",
    changes: [{ kind: "instalments", label: "Spread it over 6 instalments" }],
    probability: 0.07,
    band: "Safe",
    request: null,
    evaluated: 3,
  },
  repayment: {
    level: "none",
    overdue_count: 0,
    overdue_sen: 0,
    late_paid_count: 0,
  },
  with_plan_curve: null,
  without_curve: null,
  versions: null,
  check_id: "chk1",
  check_type: "before_purchase",
};

function ok(data: unknown, status = 200) {
  return { data, error: undefined, response: { ok: true, status } };
}

function serve(plans: unknown[], schedule: unknown, report: unknown = REPORT) {
  get.mockImplementation(async (path: string) => {
    if (path === "/api/plans") return ok(plans);
    if (path === "/api/providers") return ok(PROVIDERS);
    if (path === "/api/risk/checks/{check_id}") return ok(report);
    return ok([]);
  });
  post.mockImplementation(async (path: string) =>
    path === "/api/plans/preview" ? ok(schedule) : ok({ ...PLAN, id: "p2" }, 201),
  );
}

async function fillAndWait(schedule: ReturnType<typeof preview>) {
  await userEvent.click(screen.getAllByRole("button", { name: "Add a plan" })[0]);
  const dialog = await screen.findByRole("dialog");
  await userEvent.type(within(dialog).getByLabelText(/what are you buying/i), "Old phone");
  await userEvent.clear(within(dialog).getByLabelText(/number of instalments/i));
  await userEvent.type(
    within(dialog).getByLabelText(/number of instalments/i),
    String(schedule.installments.length),
  );
  await userEvent.type(within(dialog).getByLabelText(/^price/i), "600");
  await waitFor(
    () => expect(within(dialog).getByRole("button", { name: "Save plan" })).toBeEnabled(),
    {
      timeout: 3000,
    },
  );
  return dialog;
}

function createCall() {
  return post.mock.calls.find((c) => c[0] === "/api/plans");
}

describe("adding a plan that has already started", () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
  });

  it("asks about the instalments already due, all ticked as paid, and not the future ones", async () => {
    serve([], STARTED);
    render(<PlansScreen />, { wrapper });
    await screen.findByText("No plans yet");
    const dialog = await fillAndWait(STARTED);

    const section = within(dialog).getByRole("group", {
      name: /already fell due/i,
    });
    const boxes = within(section).getAllByRole("checkbox", { name: /paid/i });
    expect(boxes).toHaveLength(2);
    for (const box of boxes) expect(box).toBeChecked();
    expect(within(section).getByText(/do not change what comes next/i)).toBeInTheDocument();
    expect(
      within(section).getByRole("checkbox", {
        name: /also add these payments to my transactions/i,
      }),
    ).not.toBeChecked();
  });

  it("sends the ticked instalments as paid and does not log them unless asked", async () => {
    serve([], STARTED);
    render(<PlansScreen />, { wrapper });
    await screen.findByText("No plans yet");
    const dialog = await fillAndWait(STARTED);

    await userEvent.click(within(dialog).getByRole("checkbox", { name: /instalment 2.*paid/i }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Save plan" }));

    await waitFor(() => expect(createCall()).toBeDefined());
    expect(createCall()?.[1].body).toMatchObject({
      paid_seqs: [1],
      log_payments: false,
    });
  });

  it("logs the payments as transactions only when the switch is on", async () => {
    serve([], STARTED);
    render(<PlansScreen />, { wrapper });
    await screen.findByText("No plans yet");
    const dialog = await fillAndWait(STARTED);

    await userEvent.click(
      within(dialog).getByRole("checkbox", {
        name: /also add these payments to my transactions/i,
      }),
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "Save plan" }));

    await waitFor(() => expect(createCall()).toBeDefined());
    expect(createCall()?.[1].body).toMatchObject({
      paid_seqs: [1, 2],
      log_payments: true,
    });
  });

  it("forgets an untick when the schedule changes, so a different instalment is not left unpaid", async () => {
    serve([], STARTED);
    render(<PlansScreen />, { wrapper });
    await screen.findByText("No plans yet");
    const dialog = await fillAndWait(STARTED);

    await userEvent.click(within(dialog).getByRole("checkbox", { name: /instalment 2.*paid/i }));
    expect(within(dialog).getByRole("checkbox", { name: /instalment 2.*paid/i })).not.toBeChecked();

    // the purchase date moves, so instalment 2 now falls on another day
    const moved = preview([
      [1, "2020-02-15"],
      [2, "2020-03-15"],
      [3, "2099-04-15"],
    ]);
    post.mockImplementation(async (path: string) =>
      path === "/api/plans/preview" ? ok(moved) : ok({ ...PLAN, id: "p2" }, 201),
    );
    await userEvent.clear(within(dialog).getByLabelText(/purchase date/i));
    await userEvent.type(within(dialog).getByLabelText(/purchase date/i), "2020-01-15");
    await waitFor(
      () =>
        expect(
          within(dialog).getByRole("checkbox", { name: /15 march 2020.*paid/i }),
        ).toBeChecked(),
      { timeout: 3000 },
    );
    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: "Save plan" })).toBeEnabled(),
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "Save plan" }));

    await waitFor(() => expect(createCall()).toBeDefined());
    expect(createCall()?.[1].body).toMatchObject({ paid_seqs: [1, 2] });
  });

  it("keeps the section on screen while the form is being edited", async () => {
    serve([], STARTED);
    render(<PlansScreen />, { wrapper });
    await screen.findByText("No plans yet");
    const dialog = await fillAndWait(STARTED);

    await userEvent.type(within(dialog).getByLabelText(/what are you buying/i), "s");

    expect(within(dialog).getByRole("group", { name: /already fell due/i })).toBeInTheDocument();
  });

  it("shows no such section for a plan that has not started, and sends nothing paid", async () => {
    serve([], NOT_STARTED);
    render(<PlansScreen />, { wrapper });
    await screen.findByText("No plans yet");
    const dialog = await fillAndWait(NOT_STARTED);

    expect(within(dialog).queryByRole("group", { name: /already fell due/i })).toBeNull();
    await userEvent.click(within(dialog).getByRole("button", { name: "Save plan" }));
    await waitFor(() => expect(createCall()).toBeDefined());
    expect(createCall()?.[1].body).toMatchObject({
      paid_seqs: [],
      log_payments: false,
    });
  });
});

describe("the analysis kept with a plan", () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
  });

  it("is closed at first, then shows the day it was taken, the band, the reasons and the report link", async () => {
    serve([PLAN], STARTED);
    render(<PlansScreen />, { wrapper });
    await screen.findByText("Headphones");
    expect(get.mock.calls.some((c) => c[0] === "/api/risk/checks/{check_id}")).toBe(false);

    await userEvent.click(screen.getByRole("button", { name: /analysis from 1 october 2026/i }));

    expect(await screen.findByText(/about 40% of your monthly income/i)).toBeInTheDocument();
    expect(screen.getByText(/checked on 1 october 2026, when you added it/i)).toBeInTheDocument();
    expect(screen.getByText("Spread it over 6 instalments")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open the full report/i })).toHaveAttribute(
      "href",
      "/risk/chk1",
    );
    const call = get.mock.calls.find((c) => c[0] === "/api/risk/checks/{check_id}");
    expect(call?.[1]).toEqual({ params: { path: { check_id: "chk1" } } });
  });

  it("says a check of what was left to pay is exactly that", async () => {
    serve([{ ...PLAN, risk_check_type: "current_state" }], STARTED, {
      ...REPORT,
      check_type: "current_state",
      suggestion: null,
    });
    render(<PlansScreen />, { wrapper });
    await screen.findByText("Headphones");

    await userEvent.click(screen.getByRole("button", { name: /analysis from 1 october 2026/i }));

    expect(await screen.findByText(/only what was still left to pay/i)).toBeInTheDocument();
  });

  it("says plainly when no check was taken", async () => {
    serve(
      [
        {
          ...PLAN,
          risk_check_id: null,
          risk_check_type: null,
          risk_band: null,
        },
      ],
      STARTED,
    );
    render(<PlansScreen />, { wrapper });
    await screen.findByText("Headphones");

    expect(screen.getByText(/no risk check was taken for this plan/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /analysis from/i })).toBeNull();
  });
});
