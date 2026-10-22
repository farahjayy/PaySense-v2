"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

import { ProfileCard } from "@/components/layout/ProfileCard";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { BrandMark } from "@/components/ui/BrandMark";
import { Button } from "@/components/ui/Button";
import { replayIntro } from "@/lib/introTour";
import { isActive } from "@/lib/nav";
import { clearSession, type Session } from "@/lib/session";
import { setViewAsUser, useViewingAsUser } from "@/lib/viewAs";

type NavItem = {
  href: string;
  label: string;
  icon: string;
  daily: boolean;
  tour?: string;
  /** Shown only to an admin (ADR D-57). Display only: the server enforces anything real. */
  adminOnly?: boolean;
};

type NavGroup = { label?: string; items: readonly NavItem[] };

// Grouped by what the student is doing (ADR D-61). `daily` marks the pages used every day: they
// fill the phone's bottom bar. The rest sit in the "More pages" row under the header on a phone.
// Categories has no entry of its own: it is a button on Transactions (ADR D-49). `icon` is an SVG
// path (24x24, stroked).
const NAV_GROUPS: readonly NavGroup[] = [
  {
    label: "Overview",
    items: [
      {
        href: "/",
        label: "Dashboard",
        icon: "M4 13h6V4H4zM14 20h6v-9h-6zM14 4h6v4h-6zM4 20h6v-3H4z",
        daily: true,
      },
      {
        href: "/notifications",
        label: "Notifications",
        icon: "M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0",
        daily: false,
      },
    ],
  },
  {
    label: "Your money",
    items: [
      {
        href: "/transactions",
        label: "Transactions",
        icon: "M4 7h16M4 12h16M4 17h10",
        daily: true,
        tour: "transactions",
      },
      {
        href: "/import",
        label: "Import",
        icon: "M12 16V4M7 9l5-5 5 5M4 20h16",
        daily: false,
      },
      {
        href: "/recurring",
        label: "Recurring",
        icon: "M17 3l3 3-3 3M4 11V9a3 3 0 0 1 3-3h13M7 21l-3-3 3-3M20 13v2a3 3 0 0 1-3 3H4",
        daily: false,
      },
    ],
  },
  {
    label: "Buy now, pay later",
    items: [
      {
        href: "/risk",
        label: "Risk check",
        icon: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
        daily: true,
        tour: "risk",
      },
      {
        href: "/plans",
        label: "Plans",
        icon: "M5 4h14v16H5zM9 9h6M9 13h6M9 17h3",
        daily: true,
        tour: "plans",
      },
    ],
  },
  {
    label: "How it works",
    items: [
      {
        href: "/model",
        label: "About the model",
        icon: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7.5v.01",
        daily: false,
        tour: "model",
      },
    ],
  },
  {
    items: [
      {
        href: "/admin",
        label: "Admin",
        icon: "M8 9l-3 3 3 3M16 9l3 3-3 3M13 7l-2 10",
        daily: false,
        adminOnly: true,
      },
    ],
  },
];

/** The groups this person may see: admin-only items and any group left empty by that are dropped. */
function visibleGroups(showAdmin: boolean): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.adminOnly || showAdmin),
  })).filter((group) => group.items.length > 0);
}

function NavIcon({ d, size = 20 }: { d: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <path d={d} />
    </svg>
  );
}

function navLinkClass(active: boolean): string {
  return active
    ? "bg-page font-bold text-accent shadow-[inset_3px_0_0_var(--color-accent)]"
    : "font-semibold text-sidebar-ink/90 hover:bg-white/10";
}

function Wordmark({ onDark = false }: { onDark?: boolean }) {
  return (
    <span className="font-display text-[23px] font-extrabold tracking-tight">
      Pay<span className={onDark ? "text-rosy" : "text-accent"}>Sense</span>
    </span>
  );
}

function Sidebar({
  pathname,
  groups,
  user,
  onLogout,
  onIntro,
}: {
  pathname: string;
  groups: readonly NavGroup[];
  user: Session["user"];
  onLogout: () => void;
  onIntro: () => void;
}) {
  return (
    <aside className="sticky top-0 hidden h-screen w-62 shrink-0 flex-col gap-5 overflow-hidden bg-sidebar px-4 pb-5 pt-7 text-sidebar-ink md:flex">
      {/* soft rings and a tile, as on the login page: decoration only */}
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -right-32 h-70 w-70 rounded-full border-[1.5px] border-sidebar-ink/15"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-52 -right-52 h-105 w-105 rounded-full border-[1.5px] border-sidebar-ink/10"
      />
      <Link href="/" className="relative flex items-center gap-3 px-1.5">
        <BrandMark />
        <Wordmark onDark />
      </Link>
      <nav
        aria-label="Main navigation"
        className="relative flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1"
      >
        {groups.map((group, index) => (
          <div
            key={group.label ?? `group-${index}`}
            role="group"
            aria-label={group.label}
            className="flex flex-col gap-1"
          >
            {group.label && (
              <p
                aria-hidden
                className="px-3.5 pb-0.5 text-[11px] font-bold uppercase tracking-wider text-sidebar-muted"
              >
                {group.label}
              </p>
            )}
            {group.items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  data-tour={item.tour}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-11 items-center gap-3 rounded-2xl px-3.5 text-[15px] transition-colors ${navLinkClass(active)}`}
                >
                  <NavIcon d={item.icon} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <ProfileCard user={user} onLogout={onLogout} onIntro={onIntro} />
    </aside>
  );
}

function MobileNav({ pathname, items }: { pathname: string; items: readonly NavItem[] }) {
  return (
    <nav
      aria-label="Quick navigation"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-surface md:hidden"
    >
      {items
        .filter((item) => item.daily)
        .map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              data-tour={item.tour}
              aria-current={active ? "page" : undefined}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-semibold ${
                active ? "text-accent" : "text-ink-muted"
              }`}
            >
              <NavIcon d={item.icon} size={22} />
              {item.label}
            </Link>
          );
        })}
    </nav>
  );
}

/** Shown to an admin who is previewing the app as an ordinary student (ADR D-61). */
function ViewingAsUserBar() {
  return (
    <div
      role="status"
      aria-label="Viewing as a user"
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-accent px-4 py-1.5 text-[13px] font-semibold text-on-accent"
    >
      <span>You are viewing PaySense as a user.</span>
      <button
        type="button"
        onClick={() => setViewAsUser(false)}
        className="rounded underline underline-offset-2 hover:no-underline"
      >
        Back to admin view
      </button>
    </div>
  );
}

type Props = { user: Session["user"]; children: ReactNode };

export function AppShell({ user, children }: Props) {
  const viewingAsUser = useViewingAsUser();
  const isAdminAccount = user.role === "admin";
  const groups = visibleGroups(isAdminAccount && !viewingAsUser);
  const items = groups.flatMap((group) => group.items);
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const main = useRef<HTMLElement>(null);
  const firstRender = useRef(true);

  // After navigating, move focus to the new page so keyboard and screen-reader users start at its
  // top instead of wherever the old page left them. Not on the first load.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    // The page's own heading, so a screen reader announces where it landed; main as a fallback.
    (main.current?.querySelector<HTMLElement>("h1") ?? main.current)?.focus();
  }, [pathname]);

  function handleLogout() {
    clearSession();
    queryClient.clear();
    router.replace("/login");
  }

  function handleIntro() {
    replayIntro(user.id);
    router.push("/"); // the tour's first stop, the forecast, is on the dashboard
  }

  return (
    <div className="flex min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-page"
      >
        Skip to content
      </a>
      <Sidebar
        pathname={pathname}
        groups={groups}
        user={user}
        onLogout={handleLogout}
        onIntro={handleIntro}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        {isAdminAccount && viewingAsUser && <ViewingAsUserBar />}
        <header className="flex h-14 items-center justify-between gap-3 border-b border-line bg-surface px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 text-ink md:hidden">
            <BrandMark size={28} />
            <Wordmark />
          </Link>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            {/* the sidebar's profile card does these jobs from a laptop up */}
            <span className="hidden max-w-[10rem] truncate text-[13px] font-medium text-ink sm:inline md:hidden">
              {user.display_name}
            </span>
            <Link
              href="/settings"
              data-tour="settings"
              aria-current={isActive(pathname, "/settings") ? "page" : undefined}
              className="inline-flex min-h-6 items-center px-1 text-[13px] font-semibold text-accent underline-offset-2 hover:underline md:hidden"
            >
              Your data
            </Link>
            <Button variant="secondary" size="sm" onClick={handleLogout} className="md:hidden">
              Log out
            </Button>
          </div>
        </header>
        <nav
          aria-label="More pages"
          className="flex flex-wrap gap-x-5 gap-y-1 border-b border-line bg-surface px-4 py-2 text-[13px] font-medium md:hidden"
        >
          {items
            .filter((item) => !item.daily)
            .map((item) => (
              <Link
                key={item.href}
                href={item.href}
                data-tour={item.tour}
                aria-current={isActive(pathname, item.href) ? "page" : undefined}
                className="py-1 text-accent underline-offset-2 hover:underline"
              >
                {item.label}
              </Link>
            ))}
          <button
            type="button"
            onClick={handleIntro}
            className="py-1 text-accent underline-offset-2 hover:underline"
          >
            Show the intro again
          </button>
        </nav>
        <main
          id="main"
          ref={main}
          tabIndex={-1}
          className="flex-1 px-4 py-6 pb-24 outline-none sm:px-6 md:pb-8"
        >
          {children}
        </main>
      </div>
      <MobileNav pathname={pathname} items={items} />
    </div>
  );
}
