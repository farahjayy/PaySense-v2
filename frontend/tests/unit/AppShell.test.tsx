import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "@/components/layout/AppShell";
import { AuthGate } from "@/components/auth/AuthGate";
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
    expect(names(groups[0])).toEqual(["Dashboard"]);
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

  it("puts a settings gear beside the name that goes to Settings, and Log out below, with no 'Your data' text", () => {
    render(
      <AppShell user={USER}>
        <p>page body</p>
      </AppShell>,
      { wrapper },
    );

    const card = screen.getByRole("region", { name: "Your profile" });
    const gear = within(card).getByRole("link", { name: "Your data" }); // its accessible name
    expect(gear).toHaveAttribute("href", "/settings");
    expect(gear).toHaveAttribute("title", "Your data and settings");
    expect(gear).toHaveTextContent(""); // an icon, not words
    expect(card).not.toHaveTextContent("Your data");
    expect(within(card).getByRole("button", { name: "Log out" })).toBeInTheDocument();
  });

  it("marks Log out as the way out with a small icon and a salmon hover, never a red button", () => {
    render(
      <AppShell user={USER}>
        <p>page body</p>
      </AppShell>,
      { wrapper },
    );

    const card = screen.getByRole("region", { name: "Your profile" });
    const logout = within(card).getByRole("button", { name: "Log out" });
    expect(logout.querySelector("svg[aria-hidden='true']")).not.toBeNull();
    expect(logout).toHaveClass("hover:text-pop-fill", "focus-visible:text-pop-fill");
    expect(logout.className).not.toMatch(/danger|red/);
  });

  it("gives the gear and the name a soft light hover, none of it red or salmon, no underline", () => {
    render(
      <AppShell user={USER}>
        <p>page body</p>
      </AppShell>,
      { wrapper },
    );

    const card = screen.getByRole("region", { name: "Your profile" });
    const gear = within(card).getByRole("link", { name: "Your data" });
    expect(gear.querySelector("svg[aria-hidden='true']")).not.toBeNull();
    const name = within(card).getByRole("link", { name: "Amir" });
    for (const link of [gear, name]) {
      expect(link).toHaveClass("hover:bg-white/15", "focus-visible:bg-white/15");
      expect(link.className).not.toMatch(/danger|red|pop|underline/);
    }
  });

  it("makes the name on the card a link to Settings, where the intro can be played again (ADR D-66)", () => {
    render(
      <AppShell user={USER}>
        <p>page body</p>
      </AppShell>,
      { wrapper },
    );

    const card = screen.getByRole("region", { name: "Your profile" });
    expect(within(card).getByRole("link", { name: "Amir" })).toHaveAttribute("href", "/settings");
  });

  it("no longer carries a Show the intro again button in the shell: it lives in Settings", () => {
    render(
      <AppShell user={USER}>
        <p>page body</p>
      </AppShell>,
      { wrapper },
    );

    expect(screen.queryByRole("button", { name: "Show the intro again" })).toBeNull();
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

  describe("the notification bell (ADR D-65)", () => {
    const FORECAST = {
      status: "locked",
      is_stale: false,
      stale_days: 0,
      data_through: null,
      suspect_months: [],
      unmatched_items: [],
      simulation: null,
    };
    const ALERT = {
      rule: "overdue",
      title: "Overdue",
      detail: "x",
      severity: "high",
      href: "/plans",
    };

    function answer(forecast: object, alerts: object[]) {
      get.mockImplementation(async (path: string) => ({
        data: path === "/api/forecast" ? forecast : { items: alerts },
        error: undefined,
        response: { ok: true, status: 200 },
      }));
    }

    function renderShell() {
      return render(
        <AppShell user={USER}>
          <p>page body</p>
        </AppShell>,
        { wrapper },
      );
    }

    beforeEach(() => {
      get.mockReset();
      window.localStorage.clear();
    });

    it("sits in the top bar beside the theme switch, and no longer in the sidebar or the phone's More pages", () => {
      renderShell();

      const bell = screen.getByRole("link", { name: /^notifications/i });
      expect(bell).toHaveAttribute("href", "/notifications");
      const header = screen.getByRole("banner");
      expect(header).toContainElement(bell);
      expect(header).toContainElement(screen.getByRole("button", { name: "Dark mode" }));
      expect(screen.getAllByRole("link", { name: /notifications/i })).toHaveLength(1);
    });

    it("shows no count while nothing needs attention", async () => {
      answer(FORECAST, []);
      renderShell();

      await waitFor(() => expect(get).toHaveBeenCalledWith("/api/alerts"));
      expect(screen.queryByTestId("bell-badge")).toBeNull();
      expect(screen.getByRole("link", { name: "Notifications" })).toBeInTheDocument();
    });

    it("counts the server's alerts and the notices not yet closed, and says so in its name", async () => {
      answer({ ...FORECAST, is_stale: true, stale_days: 30, data_through: "2026-09-09" }, [
        ALERT,
        ALERT,
      ]);
      renderShell();

      const badge = await screen.findByTestId("bell-badge");
      expect(badge).toHaveTextContent("3");
      expect(
        screen.getByRole("link", { name: "Notifications, 3 need attention" }),
      ).toBeInTheDocument();
    });

    it("caps a long count at 9+", async () => {
      answer(
        FORECAST,
        Array.from({ length: 12 }, () => ALERT),
      );
      renderShell();

      expect(await screen.findByTestId("bell-badge")).toHaveTextContent("9+");
    });

    it("marks the bell as the current page on the Notifications page", () => {
      where.path = "/notifications";
      renderShell();

      expect(screen.getByRole("link", { name: /^notifications/i })).toHaveAttribute(
        "aria-current",
        "page",
      );
    });
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

  it("lists Admin under 'How it works' beside About the model, not in a group of its own", () => {
    render(
      <AppShell user={{ ...USER, role: "admin" }}>
        <p>page body</p>
      </AppShell>,
      { wrapper },
    );

    const nav = screen.getByRole("navigation", { name: "Main navigation" });
    const groups = within(nav).getAllByRole("group");
    expect(groups).toHaveLength(4);
    const last = groups[groups.length - 1];
    expect(last).toHaveAttribute("aria-label", "How it works");
    expect(
      within(last)
        .getAllByRole("link")
        .map((l) => l.textContent),
    ).toEqual(["About the model", "Admin"]);
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
