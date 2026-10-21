import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SettingsScreen } from "@/components/screens/SettingsScreen";
import { forgetForTests, markIntroSeen, markTourSeen, stageFor } from "@/lib/introTour";
import { saveSession } from "@/lib/session";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const get = vi.fn();
const post = vi.fn();
vi.mock("@/lib/api/client", () => ({
  api: { GET: (...a: unknown[]) => get(...a), POST: (...a: unknown[]) => post(...a) },
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const COUNTS = { transactions: 808, plans: 3, recurring: 2, limits: 1, categories: 4 };
const ALL = ["transactions", "plans", "recurring", "limits", "categories"];

function ok(data: unknown, status = 200) {
  return { data, error: undefined, response: { ok: true, status } };
}

function serve(counts = COUNTS) {
  get.mockImplementation(async (path: string) => {
    if (path === "/api/account/summary") return ok(counts);
    if (path === "/api/account/export") return ok(new Blob(["x"]));
    return ok([]);
  });
  post.mockResolvedValue(
    ok({
      removed: counts,
      factory_reset: false,
    }),
  );
}

async function open() {
  render(<SettingsScreen />, { wrapper });
  await screen.findByRole("checkbox", { name: /transactions/i });
}

function resetCall() {
  return post.mock.calls.find((c) => c[0] === "/api/account/reset");
}

describe("SettingsScreen", () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
    window.localStorage.clear();
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
    serve();
  });

  it("shows how many of each kind there are beside its tick box, all unticked to begin with", async () => {
    await open();

    for (const [name, count] of [
      [/transactions/i, "808"],
      [/bnpl plans/i, "3"],
      [/recurring items/i, "2"],
      [/bnpl limits/i, "1"],
      [/my own categories/i, "4"],
    ] as const) {
      const box = screen.getByRole("checkbox", { name });
      expect(box).not.toBeChecked();
      await waitFor(() => expect(box.closest("label")).toHaveTextContent(count));
    }
    expect(screen.getByRole("button", { name: /clear selected data/i })).toBeDisabled();
  });

  it("lets a person download a copy of their data before anything is deleted", async () => {
    await open();

    await userEvent.click(screen.getByRole("button", { name: /download transactions/i }));
    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledTimes(1));
    expect(get.mock.calls.find((c) => c[0] === "/api/account/export")?.[1].params.query).toEqual({
      format: "csv",
    });

    await userEvent.click(screen.getByRole("button", { name: /download everything/i }));
    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledTimes(2));
    expect(get.mock.calls.filter((c) => c[0] === "/api/account/export")[1][1].params.query).toEqual(
      { format: "json" },
    );
  });

  it("names only what was ticked, with how much, and says nothing is deleted until RESET is typed", async () => {
    await open();
    await userEvent.click(screen.getByRole("checkbox", { name: /transactions/i }));
    await userEvent.click(screen.getByRole("checkbox", { name: /bnpl limits/i }));

    await userEvent.click(screen.getByRole("button", { name: /clear selected data/i }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/808 transactions/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/1 bnpl limit/i)).toBeInTheDocument();
    expect(within(dialog).queryByText(/recurring item/i)).toBeNull();
    expect(within(dialog).getByText(/cannot be undone/i)).toBeInTheDocument();
    const confirm = within(dialog).getByRole("button", { name: /clear data/i });
    expect(confirm).toBeDisabled();

    for (const wrong of ["reset", "RESE", "RESET "]) {
      const field = within(dialog).getByLabelText(/type reset/i);
      await userEvent.clear(field);
      await userEvent.type(field, wrong);
      expect(confirm).toBeDisabled();
    }
    expect(resetCall()).toBeUndefined();
  });

  it("sends exactly the ticked kinds once RESET is typed, then reports what was cleared", async () => {
    post.mockResolvedValue(
      ok({
        removed: { transactions: 808, plans: 0, recurring: 0, limits: 1, categories: 0 },
        factory_reset: false,
      }),
    );
    await open();
    await userEvent.click(screen.getByRole("checkbox", { name: /transactions/i }));
    await userEvent.click(screen.getByRole("checkbox", { name: /bnpl limits/i }));
    await userEvent.click(screen.getByRole("button", { name: /clear selected data/i }));
    const dialog = await screen.findByRole("dialog");

    await userEvent.type(within(dialog).getByLabelText(/type reset/i), "RESET");
    await userEvent.click(within(dialog).getByRole("button", { name: /clear data/i }));

    await waitFor(() => expect(resetCall()).toBeDefined());
    expect(resetCall()?.[1].body).toEqual({
      scopes: ["transactions", "limits"],
      confirm: "RESET",
    });
    expect(await screen.findByText(/cleared 808 transactions/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("tells a person that a plan's logged payments stay unless transactions are cleared too", async () => {
    await open();
    await userEvent.click(screen.getByRole("checkbox", { name: /bnpl plans/i }));
    await userEvent.click(screen.getByRole("button", { name: /clear selected data/i }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/payments.*stay/i)).toBeInTheDocument();
  });

  it("offers a factory reset that clears all five kinds and brings the checklist back", async () => {
    window.localStorage.setItem("paysense.gettingStarted.hidden", "1");
    post.mockResolvedValue(ok({ removed: COUNTS, factory_reset: true }));
    await open();

    await userEvent.click(screen.getByRole("button", { name: /reset everything/i }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/factory reset/i)).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText(/type reset/i), "RESET");
    await userEvent.click(within(dialog).getByRole("button", { name: /reset everything/i }));

    await waitFor(() => expect(resetCall()).toBeDefined());
    expect(resetCall()?.[1].body).toEqual({ scopes: ALL, confirm: "RESET" });
    await waitFor(() =>
      expect(window.localStorage.getItem("paysense.gettingStarted.hidden")).toBeNull(),
    );
  });

  it("keeps the dialog open and says why when the server refuses", async () => {
    post.mockResolvedValue({
      data: undefined,
      error: { detail: { code: "reset_in_progress", message: "A reset is already running." } },
      response: { ok: false, status: 409 },
    });
    await open();
    await userEvent.click(screen.getByRole("checkbox", { name: /transactions/i }));
    await userEvent.click(screen.getByRole("button", { name: /clear selected data/i }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText(/type reset/i), "RESET");

    await userEvent.click(within(dialog).getByRole("button", { name: /clear data/i }));

    expect(await within(dialog).findByText(/already running/i)).toBeInTheDocument();
  });

  it("can play the intro and the tour again, from the first slide, on the dashboard", async () => {
    saveSession({
      token: "t",
      expiresAt: Date.now() + 60_000,
      user: { id: "u1", username: "amir", display_name: "Amir", persona: null },
    });
    forgetForTests();
    markIntroSeen("u1");
    markTourSeen("u1");
    await open();

    await userEvent.click(screen.getByRole("button", { name: /show the intro again/i }));

    expect(stageFor("u1")).toBe("intro");
    expect(push).toHaveBeenCalledWith("/");
  });

  it("can bring the getting started checklist back", async () => {
    window.localStorage.setItem("paysense.gettingStarted.hidden", "1");
    await open();

    await userEvent.click(
      screen.getByRole("button", { name: /show the getting started checklist/i }),
    );

    expect(window.localStorage.getItem("paysense.gettingStarted.hidden")).toBeNull();
  });

  it("links to Categories and the import template, where they now live", async () => {
    await open();

    expect(screen.getByRole("link", { name: /categories/i })).toHaveAttribute(
      "href",
      "/categories",
    );
    expect(screen.getByRole("link", { name: /import template/i })).toHaveAttribute(
      "href",
      expect.stringContaining("paysense-import-template"),
    );
  });

  it("has no accessibility violations, with or without the confirmation open", async () => {
    const check = (node: HTMLElement) =>
      axe.run(node, {
        rules: { "color-contrast": { enabled: false }, region: { enabled: false } },
      });
    const { container } = render(<SettingsScreen />, { wrapper });
    await screen.findByRole("checkbox", { name: /transactions/i });
    expect((await check(container)).violations).toEqual([]);

    await userEvent.click(screen.getByRole("checkbox", { name: /transactions/i }));
    await userEvent.click(screen.getByRole("button", { name: /clear selected data/i }));
    const dialog = await screen.findByRole("dialog");
    expect((await check(dialog)).violations).toEqual([]);
  });

  it("does nothing when Enter is pressed with the wrong word, and starts empty each time", async () => {
    await open();
    await userEvent.click(screen.getByRole("checkbox", { name: /transactions/i }));
    await userEvent.click(screen.getByRole("button", { name: /clear selected data/i }));
    let dialog = await screen.findByRole("dialog");

    await userEvent.type(within(dialog).getByLabelText(/type reset/i), "nope{Enter}");
    expect(resetCall()).toBeUndefined();

    await userEvent.click(within(dialog).getByRole("button", { name: /cancel/i }));
    await userEvent.click(screen.getByRole("button", { name: /clear selected data/i }));
    dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText(/type reset/i)).toHaveValue("");
  });

  it("says inside the dialog when the copy could not be made, so nobody types RESET believing they have one", async () => {
    get.mockImplementation(async (path: string) =>
      path === "/api/account/summary"
        ? ok(COUNTS)
        : {
            data: undefined,
            error: { detail: { code: "x", message: "The server did not answer." } },
            response: { ok: false, status: 500 },
          },
    );
    await open();
    await userEvent.click(screen.getByRole("checkbox", { name: /transactions/i }));
    await userEvent.click(screen.getByRole("button", { name: /clear selected data/i }));
    const dialog = await screen.findByRole("dialog");

    await userEvent.click(within(dialog).getByRole("button", { name: /download transactions/i }));

    expect(await within(dialog).findByText(/did not answer/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/copy could not be made/i)).toBeInTheDocument();
  });

  it("moves focus to the result after a clear, and drops the old message when another dialog opens", async () => {
    post.mockResolvedValue(
      ok({
        removed: { transactions: 808, plans: 0, recurring: 0, limits: 0, categories: 0 },
        factory_reset: false,
      }),
    );
    await open();
    await userEvent.click(screen.getByRole("checkbox", { name: /transactions/i }));
    await userEvent.click(screen.getByRole("button", { name: /clear selected data/i }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText(/type reset/i), "RESET");
    await userEvent.click(within(dialog).getByRole("button", { name: /clear data/i }));

    const message = await screen.findByText(/cleared 808 transactions/i);
    await waitFor(() => expect(message.closest("[tabindex]")).toHaveFocus());

    await userEvent.click(screen.getByRole("button", { name: /reset everything/i }));
    expect(screen.queryByText(/cleared 808 transactions/i)).toBeNull();
  });
});
