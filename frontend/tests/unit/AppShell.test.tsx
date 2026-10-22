import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "@/components/layout/AppShell";
import { AuthGate } from "@/components/auth/AuthGate";
import { forgetForTests, markIntroSeen, markTourSeen, stageFor } from "@/lib/introTour";
import { clearSession, getSession, saveSession } from "@/lib/session";
import { setViewAsUser } from "@/lib/viewAs";

const replace = vi.fn();
const push = vi.fn();
const where = { path: "/" }; // the page the test pretends to be on
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push }),
  usePathname: () => where.path,
}));

const get = vi.fn();
vi.mock("@/lib/api/client", () => ({
  api: { GET: (...args: unknown[]) => get(...args) },
}));

const USER = {
  id: "u1",
  username: "amir",
  display_name: "Amir",
  persona: null,
} as const;

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function signIn() {
  saveSession({ token: "t", expiresAt: Date.now() + 60_000, user: USER });
}

describe("AuthGate", () => {
  beforeEach(() => {
    replace.mockReset();
    get.mockReset();
    get.mockResolvedValue({ data: USER, error: undefined });
    where.path = "/";
  });

  it("sends a signed-out visitor at the root to the welcome page and shows nothing private", async () => {
    render(<AuthGate>secret content</AuthGate>, { wrapper });

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/welcome"));
    expect(replace).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("secret content")).not.toBeInTheDocument();
  });

  it("sends a signed-out visitor to any other page to the login, so a deep link keeps its meaning", async () => {
    where.path = "/plans";
    render(<AuthGate>secret content</AuthGate>, { wrapper });

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    expect(replace).not.toHaveBeenCalledWith("/welcome");
  });

  it("renders its children for a signed-in user and does not redirect", async () => {
    signIn();
    render(<AuthGate>private content</AuthGate>, { wrapper });

    expect(await screen.findByText("private content")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("sends someone who signs out at the root to the login, not the welcome page", async () => {
    signIn();
    render(<AuthGate>private content</AuthGate>, { wrapper });
    await screen.findByText("private content");

    act(() => clearSession());

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    expect(replace).not.toHaveBeenCalledWith("/welcome");
  });

  it("checks the session with the server and bounces the user if it was revoked", async () => {
    where.path = "/transactions";
    signIn();
    get.mockImplementation(async () => {
      clearSession(); // what the API client does on a 401
      return {
        data: undefined,
        error: { detail: { code: "invalid_token", message: "expired" } },
      };
    });
    render(<AuthGate>private content</AuthGate>, { wrapper });

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    expect(get).toHaveBeenCalledWith("/api/auth/me");
  });
});

describe("AppShell", () => {
  beforeEach(() => {
    replace.mockReset();
    push.mockReset();
    setViewAsUser(false);
    where.path = "/";
    signIn();
  });

  it("greets the signed-in user and marks the current page", () => {
    render(
      <AppShell user={USER}>
        <p>page body</p>
      </AppShell>,
      { wrapper },
    );

    expect(screen.getAllByText("Amir").length).toBeGreaterThan(0);
    expect(screen.getByText("page body")).toBeInTheDocument();
    const dashboardLinks = screen.getAllByRole("link", { name: /dashboard/i });
    expect(dashboardLinks.some((l) => l.getAttribute("aria-current") === "page")).toBe(true);
  });

  it("groups the sidebar under four labels, with Import under Your money (ADR D-61)", () => {
    render(
      <AppShell user={USER}>
        <p>page body</p>
      </AppShell>,
      { wrapper },
    );

    const nav = screen.getByRole("navigation", { name: "Main navigation" });
    const groups = within(nav).getAllByRole("group");
    expect(groups.map((g) => g.getAttribute("aria-label"))).toEqual([
      "Overview",
      "Your money",
      "Buy now, pay later",
      "How it works",
    ]);
    const names = (g: HTMLElement) =>
      within(g)
        .getAllByRole("link")
        .map((l) => l.textContent);
    expect(names(groups[0])).toEqual(["Dashboard", "Notifications"]);
    expect(names(groups[1])).toEqual(["Transactions", "Import", "Recurring"]);
    expect(names(groups[2])).toEqual(["Risk check", "Plans"]);
    expect(names(groups[3])).toEqual(["About the model"]);
    expect(within(nav).getByRole("link", { name: "Import" })).toHaveAttribute("href", "/import");
    expect(within(nav).queryByRole("link", { name: "Categories" })).toBeNull();
  });

  it("keeps the phone's bottom bar to the four everyday pages and puts Import in More pages", () => {
    render(
      <AppShell user={USER}>
        <p>page body</p>
      </AppShell>,
      { wrapper },
    );

    const phoneBar = screen.getAllByRole("navigation").find((n) => n.className.includes("fixed"));
    expect(phoneBar && phoneBar.querySelectorAll("a").length).toBe(4);
    const more = screen.getByRole("navigation", { name: "More pages" });
    expect(within(more).getByRole("link", { name: "Import" })).toHaveAttribute("href", "/import");
  });

  it("lets a short window scroll the sections instead of clipping them", () => {
    render(
      <AppShell user={USER}>
        <p>page body</p>
      </AppShell>,
      { wrapper },
    );

    expect(screen.getByRole("navigation", { name: "Main navigation" })).toHaveClass(
      "overflow-y-auto",
    );
    expect(
      screen.queryByText(/financial health forecasting and bnpl risk classification/i),
    ).toBeNull();
  });

  it("shows the name on a profile card and never the username, which is the whole credential", () => {
    render(
      <AppShell user={{ ...USER, username: "amir-secret-handle" }}>
        <p>page body</p>
      </AppShell>,
      { wrapper },
    );

    const card = screen.getByRole("region", { name: "Your profile" });
    expect(within(card).getByText("Amir")).toBeInTheDocument();
    expect(within(card).getByText("A")).toBeInTheDocument(); // the initials
    expect(document.body).not.toHaveTextContent("amir-secret-handle");
  });

  it("puts Your data and Log out on the card as text links, Your data going to Settings", () => {
    render(
      <AppShell user={USER}>
        <p>page body</p>
      </AppShell>,
      { wrapper },
    );

    const card = screen.getByRole("region", { name: "Your profile" });
    expect(within(card).getByRole("link", { name: "Your data" })).toHaveAttribute(
      "href",
      "/settings",
    );
    expect(within(card).getByRole("button", { name: "Log out" })).toBeInTheDocument();
  });

  it("lets anyone, not only an admin, play the intro again from the card", async () => {
    forgetForTests();
    markIntroSeen("u1");
    markTourSeen("u1");
    expect(stageFor("u1")).toBe("done");
    render(
      <AppShell user={USER}>
        <p>page body</p>
      </AppShell>,
      { wrapper },
    );

    const card = screen.getByRole("region", { name: "Your profile" });
    await userEvent.click(within(card).getByRole("button", { name: "Show the intro again" }));

    expect(stageFor("u1")).toBe("intro");
    expect(push).toHaveBeenCalledWith("/");
    forgetForTests();
  });

  it("links Your data from the phone's top bar too, as the sidebar is not there", () => {
    render(
      <AppShell user={USER}>
        <p>page body</p>
      </AppShell>,
      { wrapper },
    );

    const links = screen.getAllByRole("link", { name: "Your data" });
    expect(links.length).toBe(2);
    for (const link of links) expect(link).toHaveAttribute("href", "/settings");
    const mainNav = screen.getByRole("navigation", { name: "Main navigation" });
    expect(within(mainNav).queryByRole("link", { name: /your data/i })).toBeNull();
  });

  it("marks the controls the tour points at, on both the sidebar and the phone's bars", () => {
    const { container } = render(
      <AppShell user={USER}>
        <p>page body</p>
      </AppShell>,
      { wrapper },
    );

    for (const target of ["transactions", "risk", "plans", "model", "settings"]) {
      const marked = container.querySelectorAll(`[data-tour="${target}"]`);
      expect(marked.length, target).toBeGreaterThanOrEqual(2);
    }
    expect(container.querySelector('[data-tour="plans"]')).toHaveAttribute("href", "/plans");
  });

  it("marks the current page with a bar on its edge, not just a lighter chip", () => {
    render(
      <AppShell user={USER}>
        <p>page body</p>
      </AppShell>,
      { wrapper },
    );

    const current = screen
      .getAllByRole("link", { name: /dashboard/i })
      .filter((link) => link.getAttribute("aria-current") === "page");
    expect(current.length).toBeGreaterThan(0);
    expect(current[0]).toHaveClass("shadow-[inset_3px_0_0_var(--color-accent)]");
    const other = screen.getAllByRole("link", { name: /transactions/i })[0];
    expect(other).not.toHaveClass("shadow-[inset_3px_0_0_var(--color-accent)]");
  });

  it("has the dark mode toggle in the top bar for everyone", () => {
    render(
      <AppShell user={USER}>
        <p>page body</p>
      </AppShell>,
      { wrapper },
    );

    expect(screen.getByRole("banner")).toContainElement(
      screen.getByRole("button", { name: "Dark mode" }),
    );
  });

  it("adds an Admin page to the navigation for an admin and to nobody else (ADR D-57)", () => {
    const ordinary = render(
      <AppShell user={USER}>
        <p>page body</p>
      </AppShell>,
      { wrapper },
    );
    expect(ordinary.queryByRole("link", { name: "Admin" })).toBeNull();
    ordinary.unmount();

    render(
      <AppShell user={{ ...USER, role: "admin" }}>
        <p>page body</p>
      </AppShell>,
      { wrapper },
    );

    const links = screen.getAllByRole("link", { name: "Admin" });
    expect(links.length).toBe(2); // the sidebar, and the "More pages" row on a phone
    for (const link of links) expect(link).toHaveAttribute("href", "/admin");
    const phoneBar = screen.getAllByRole("navigation").find((n) => n.className.includes("fixed"));
    expect(phoneBar?.querySelectorAll("a").length).toBe(4); // the daily four, unchanged
  });

  it("keeps Recurring and About the model reachable on a phone in a 'More pages' row", () => {
    render(
      <AppShell user={USER}>
        <p>page body</p>
      </AppShell>,
      { wrapper },
    );

    const more = screen.getByRole("navigation", { name: "More pages" });
    expect(within(more).getByRole("link", { name: "Recurring" })).toHaveAttribute(
      "href",
      "/recurring",
    );
    expect(within(more).getByRole("link", { name: "About the model" })).toHaveAttribute(
      "href",
      "/model",
    );
  });

  it("hides the Admin page from an admin who chose to view as a user, and says so", async () => {
    setViewAsUser(true);
    render(
      <AppShell user={{ ...USER, role: "admin" }}>
        <p>page body</p>
      </AppShell>,
      { wrapper },
    );

    expect(screen.queryByRole("link", { name: "Admin" })).toBeNull();
    const bar = screen.getByRole("status", { name: /viewing as a user/i });
    await userEvent.click(within(bar).getByRole("button", { name: /back to admin view/i }));

    expect(screen.getAllByRole("link", { name: "Admin" }).length).toBe(2);
    expect(screen.queryByRole("status", { name: /viewing as a user/i })).toBeNull();
  });

  it("never shows the user-view bar to someone who is not an admin, even if the flag is set", () => {
    setViewAsUser(true);
    render(
      <AppShell user={USER}>
        <p>page body</p>
      </AppShell>,
      { wrapper },
    );

    expect(screen.queryByRole("status", { name: /viewing as a user/i })).toBeNull();
  });

  it("offers a skip link that targets the focusable main region", () => {
    render(
      <AppShell user={USER}>
        <p>page body</p>
      </AppShell>,
      { wrapper },
    );

    const skip = screen.getByRole("link", { name: /skip to content/i });
    expect(skip).toHaveAttribute("href", "#main");
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "main");
    expect(main).toHaveAttribute("tabindex", "-1");
  });

  it("logs out: forgets the session and returns to the login page", async () => {
    render(
      <AppShell user={USER}>
        <p>page body</p>
      </AppShell>,
      { wrapper },
    );

    await userEvent.click(screen.getAllByRole("button", { name: /log out/i })[0]);

    expect(getSession()).toBeNull();
    expect(replace).toHaveBeenCalledWith("/login");
  });
});
