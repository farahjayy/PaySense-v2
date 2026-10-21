"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Fragment, useEffect, useRef, type ReactNode } from "react";

import { BrandMark } from "@/components/ui/BrandMark";
import { Button } from "@/components/ui/Button";
import { Face } from "@/components/ui/Face";
import { isActive } from "@/lib/nav";
import { clearSession, type Session } from "@/lib/session";

type NavItem = { href: string; label: string; icon: string; daily: boolean };

// `daily` marks the pages used every day: they fill the phone's bottom bar and sit above the
// divider in the sidebar. The rest sit below the divider and, on a phone, in the "More pages" row
// under the header. Import and Categories have no entry of their own: they are one-off jobs, so
// they are buttons on Transactions (ADR D-49). `icon` is an SVG path (24x24, stroked).
const NAV_ITEMS: readonly NavItem[] = [
  {
    href: "/",
    label: "Dashboard",
    icon: "M4 13h6V4H4zM14 20h6v-9h-6zM14 4h6v4h-6zM4 20h6v-3H4z",
    daily: true,
  },
  { href: "/transactions", label: "Transactions", icon: "M4 7h16M4 12h16M4 17h10", daily: true },
  { href: "/plans", label: "Plans", icon: "M5 4h14v16H5zM9 9h6M9 13h6M9 17h3", daily: true },
  {
    href: "/risk",
    label: "Risk check",
    icon: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
    daily: true,
  },
  {
    href: "/recurring",
    label: "Recurring",
    icon: "M17 3l3 3-3 3M4 11V9a3 3 0 0 1 3-3h13M7 21l-3-3 3-3M20 13v2a3 3 0 0 1-3 3H4",
    daily: false,
  },
  {
    href: "/model",
    label: "About the model",
    icon: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7.5v.01",
    daily: false,
  },
];

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
    ? "bg-page font-bold text-accent"
    : "font-semibold text-sidebar-ink/90 hover:bg-white/10";
}

function Wordmark({ onDark = false }: { onDark?: boolean }) {
  return (
    <span className="font-display text-[23px] font-extrabold tracking-tight">
      Pay<span className={onDark ? "text-rosy" : "text-accent"}>Sense</span>
    </span>
  );
}

function Sidebar({ pathname, name }: { pathname: string; name: string }) {
  return (
    <aside className="sticky top-0 hidden h-screen w-62 shrink-0 flex-col gap-8 overflow-hidden bg-sidebar px-4 pb-6 pt-7 text-sidebar-ink md:flex">
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
      <nav aria-label="Main navigation" className="relative flex flex-col gap-1">
        {NAV_ITEMS.map((item, index) => {
          const active = isActive(pathname, item.href);
          const startsSecondGroup = !item.daily && NAV_ITEMS[index - 1]?.daily;
          return (
            <Fragment key={item.href}>
              {startsSecondGroup && (
                <div aria-hidden className="mx-3.5 my-2 border-t border-sidebar-ink/20" />
              )}
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-11.5 items-center gap-3 rounded-2xl px-3.5 text-[15px] transition-colors ${navLinkClass(active)}`}
              >
                <NavIcon d={item.icon} />
                {item.label}
              </Link>
            </Fragment>
          );
        })}
      </nav>
      <div className="relative mt-auto flex flex-col gap-3.5">
        <Link
          href="/settings"
          aria-current={isActive(pathname, "/settings") ? "page" : undefined}
          className="flex items-center gap-3 rounded-2xl px-1.5 py-1 hover:bg-white/10"
        >
          <Face band="Hello" size={40} />
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-[15px] font-bold">{name}</span>
            <span className="text-[13px] text-sidebar-muted">Settings</span>
          </span>
        </Link>
        <p className="px-1.5 text-[12px] leading-relaxed text-sidebar-muted">
          Financial health forecasting and BNPL risk classification for students.
        </p>
      </div>
    </aside>
  );
}

function MobileNav({ pathname }: { pathname: string }) {
  return (
    <nav
      aria-label="Quick navigation"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-surface md:hidden"
    >
      {NAV_ITEMS.filter((item) => item.daily).map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
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

type Props = { user: Session["user"]; children: ReactNode };

export function AppShell({ user, children }: Props) {
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

  return (
    <div className="flex min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to content
      </a>
      <Sidebar pathname={pathname} name={user.display_name} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-3 border-b border-line bg-surface px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 text-ink md:hidden">
            <BrandMark size={28} />
            <Wordmark />
          </Link>
          <div className="ml-auto flex items-center gap-3">
            <span className="max-w-[10rem] truncate text-[13px] font-medium text-ink">
              {user.display_name}
            </span>
            <Link
              href="/settings"
              aria-current={isActive(pathname, "/settings") ? "page" : undefined}
              className="inline-flex min-h-6 items-center px-1 text-[13px] font-semibold text-accent underline-offset-2 hover:underline md:hidden"
            >
              Settings
            </Link>
            <Button variant="secondary" size="sm" onClick={handleLogout}>
              Log out
            </Button>
          </div>
        </header>
        <nav
          aria-label="More pages"
          className="flex gap-5 border-b border-line bg-surface px-4 py-2 text-[13px] font-medium md:hidden"
        >
          {NAV_ITEMS.filter((item) => !item.daily).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(pathname, item.href) ? "page" : undefined}
              className="py-1 text-accent underline-offset-2 hover:underline"
            >
              {item.label}
            </Link>
          ))}
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
      <MobileNav pathname={pathname} />
    </div>
  );
}
