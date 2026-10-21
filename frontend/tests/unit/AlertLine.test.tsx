import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AlertLine } from "@/components/dashboard/AlertLine";

const get = vi.fn();
vi.mock("@/lib/api/client", () => ({ api: { GET: (...args: unknown[]) => get(...args) } }));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const OVERDUE = {
  rule: "overdue",
  severity: "high",
  title: "2 instalments are overdue",
  detail: "RM 140.50 is owed, the oldest due 5 September.",
  href: "/plans",
};
const COLLISION = {
  rule: "collision",
  severity: "medium",
  title: "2 payments fall within a week",
  detail: "RM 470.00 is due from 28 October.",
  href: "/plans",
};

function reply(items: unknown[]) {
  get.mockResolvedValue({ data: { items }, error: undefined, response: { ok: true, status: 200 } });
}

describe("AlertLine", () => {
  beforeEach(() => get.mockReset());

  it("shows nothing at all when there is nothing to flag", async () => {
    reply([]);
    const { container } = render(<AlertLine />, { wrapper });

    await vi.waitFor(() => expect(get).toHaveBeenCalledWith("/api/alerts"));
    expect(container).toBeEmptyDOMElement();
  });

  it("shows nothing while loading and when the call fails, never a wrong warning", async () => {
    get.mockResolvedValue({
      data: undefined,
      error: { detail: { code: "x", message: "no" } },
      response: { ok: false, status: 500 },
    });
    const { container } = render(<AlertLine />, { wrapper });

    expect(container).toBeEmptyDOMElement();
    await vi.waitFor(() => expect(get).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("is one line with its detail and a link when there is a single alert", async () => {
    reply([OVERDUE]);
    render(<AlertLine />, { wrapper });

    expect(await screen.findByText("2 instalments are overdue")).toBeInTheDocument();
    expect(screen.getByText(/RM 140\.50 is owed/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /see plans/i })).toHaveAttribute("href", "/plans");
  });

  it("folds several alerts into one count that opens the list", async () => {
    reply([OVERDUE, COLLISION]);
    const user = userEvent.setup();
    render(<AlertLine />, { wrapper });

    const toggle = await screen.findByRole("button", { name: /2 things need your attention/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("2 payments fall within a week")).not.toBeInTheDocument();

    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("2 instalments are overdue")).toBeInTheDocument();
    expect(screen.getByText("2 payments fall within a week")).toBeInTheDocument();
  });

  it("marks a serious alert with a glyph and words, not colour alone, without shouting on every visit", async () => {
    reply([OVERDUE]);
    render(<AlertLine />, { wrapper });

    const line = await screen.findByRole("status");
    expect(line).toHaveTextContent("▲");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
