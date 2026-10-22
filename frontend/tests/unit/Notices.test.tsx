import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { Notices } from "@/components/forecast/Notices";
import type { Notice } from "@/lib/forecast";
import { forgetNoticesForTests } from "@/lib/noticeStore";
import { saveSession } from "@/lib/session";

const AUGUST: Notice = {
  id: "suspect-2026-08",
  tone: "warning",
  title: "August 2026 looks incomplete",
  body: "Spending is far below your usual. No income is logged this month.",
  action: { label: "Import", href: "/import" },
  dismissKey: "2026-08:low_spend+no_income",
};
const STALE: Notice = {
  id: "stale",
  tone: "warning",
  title: "Your ledger is out of date",
  body: "Your last logged day is 19 September 2026.",
};

beforeEach(() => {
  window.localStorage.clear();
  forgetNoticesForTests();
  saveSession({
    token: "t",
    expiresAt: Date.now() + 60_000,
    user: { id: "u1", username: "amir", display_name: "Amir", persona: null },
  });
});

describe("Notices", () => {
  it("shows nothing when there is nothing to say", () => {
    const { container } = render(<Notices items={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("gives an incomplete month an Import link and a close button, and the stale note neither close", () => {
    render(<Notices items={[AUGUST, STALE]} />);

    const august = screen.getByText("August 2026 looks incomplete").closest("li") as HTMLElement;
    expect(within(august).getByRole("link", { name: "Import" })).toHaveAttribute("href", "/import");
    expect(
      within(august).getByRole("button", { name: "Close: August 2026 looks incomplete" }),
    ).toBeInTheDocument();
    const stale = screen.getByText("Your ledger is out of date").closest("li") as HTMLElement;
    expect(within(stale).queryByRole("button")).toBeNull();
    expect(within(stale).queryByRole("link")).toBeNull();
  });

  it("removes a closed notice and says how many are closed, with a way to the full list", async () => {
    render(<Notices items={[AUGUST, STALE]} />);

    await userEvent.click(screen.getByRole("button", { name: /close: august 2026/i }));

    expect(screen.queryByText("August 2026 looks incomplete")).not.toBeInTheDocument();
    expect(screen.getByText("Your ledger is out of date")).toBeInTheDocument();
    expect(screen.getByText(/1 notice closed/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /all notifications/i })).toHaveAttribute(
      "href",
      "/notifications",
    );
  });

  it("keeps a closed notice closed on the next visit", async () => {
    const first = render(<Notices items={[AUGUST]} />);
    await userEvent.click(screen.getByRole("button", { name: /close: august 2026/i }));
    first.unmount();
    forgetNoticesForTests();

    render(<Notices items={[AUGUST]} />);

    expect(screen.queryByText("August 2026 looks incomplete")).not.toBeInTheDocument();
    expect(screen.getByText(/1 notice closed/i)).toBeInTheDocument();
  });

  it("shows the month again when a new reason appears for it", async () => {
    const first = render(<Notices items={[AUGUST]} />);
    await userEvent.click(screen.getByRole("button", { name: /close: august 2026/i }));
    first.unmount();

    render(<Notices items={[{ ...AUGUST, dismissKey: "2026-08:no_data+no_income" }]} />);

    expect(screen.getByText("August 2026 looks incomplete")).toBeInTheDocument();
  });
});
