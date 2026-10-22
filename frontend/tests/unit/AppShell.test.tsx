import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "@/components/layout/AppShell";
import { AuthGate } from "@/components/auth/AuthGate";
import { clearSession, getSession, saveSession } from "@/lib/session";

const replace = vi.fn();
const where = { path: "/" }; // the page the test pretends to be on
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => where.path,
}));

const get = vi.fn();
vi.mock("@/lib/api/client", () => ({ api: { GET: (...args: unknown[]) => get(...args) } }));

const USER = { id: "u1", username: "amir", display_name: "Amir", persona: null } as const;

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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
      return { data: undefined, error: { detail: { code: "invalid_token", message: "expired" } } };
    });
    render(<AuthGate>private content</AuthGate>, { wrapper });

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    expect(get).toHaveBeenCalledWith("/api/auth/me");
  });
});

describe("AppShell", () => {
  beforeEach(() => {
    replace.mockReset();
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

  it("lists only the pages used every day in the sidebar; Import and Categories are reached from Transactions", () => {
    render(
      <AppShell user={USER}>
        <p>page body</p>
      </AppShell>,
      { wrapper },
    );

    for (const name of [
      "Dashboard",
      "Transactions",
      "Recurring",
      "Plans",
      "Risk check",
      "About the model",
    ]) {
      expect(screen.getAllByRole("link", { name: new RegExp(name, "i") }).length).toBeGreaterThan(
        0,
      );
    }
    for (const name of ["Categories", "Import"]) {
      expect(screen.queryByRole("link", { name })).toBeNull();
    }
    const phoneBar = screen.getAllByRole("navigation").find((n) => n.className.includes("fixed"));
    expect(phoneBar && phoneBar.querySelectorAll("a").length).toBe(4);
  });

  it("links Settings from beside the name, on the sidebar and the phone's top bar, not as a menu item", () => {
    render(
      <AppShell user={USER}>
        <p>page body</p>
      </AppShell>,
      { wrapper },
    );

    const links = screen.getAllByRole("link", { name: /settings/i });
    expect(links.length).toBe(2);
    for (const link of links) expect(link).toHaveAttribute("href", "/settings");
    const mainNav = screen.getByRole("navigation", { name: "Main navigation" });
    expect(within(mainNav).queryByRole("link", { name: /settings/i })).toBeNull();
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

    await userEvent.click(screen.getByRole("button", { name: /log out/i }));

    expect(getSession()).toBeNull();
    expect(replace).toHaveBeenCalledWith("/login");
  });
});
