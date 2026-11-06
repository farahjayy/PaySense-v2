import Link from "next/link";
import type { ReactNode } from "react";

import type { Session } from "@/lib/session";

/** Up to two initials from the words of a name that start with a letter; "?" if there are none. */
export function initials(name: string): string {
  const words = name.split(/\s+/).filter((word) => /^\p{L}/u.test(word));
  return (
    words
      .slice(0, 2)
      .map((word) => word[0].toUpperCase())
      .join("") || "?"
  );
}

// A soft light lift on hover and keyboard focus, no underline. Not salmon and not red: those
// are kept for Log out, so each action on the card looks like what it does.
const HOVER = "hover:bg-white/15 focus-visible:bg-white/15";
const TEXT_LINK = `inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[13px] font-semibold text-sidebar-ink transition-colors ${HOVER}`;
const NAME_LINK = `flex items-center gap-3 rounded-lg p-1 -m-1 transition-colors ${HOVER}`;

// Quiet until it is about to be used: the brand salmon on hover and focus, never red (leaving is
// not dangerous; you just sign back in). Salmon on the sidebar is audited in themeDark.test.ts.
const LOGOUT =
  "inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[13px] font-semibold text-sidebar-ink transition-colors hover:bg-pop-fill/15 hover:text-pop-fill focus-visible:bg-pop-fill/15 focus-visible:text-pop-fill";

/** Decorative: the word beside an icon carries the meaning. */
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="15"
      height="15"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

/** A door with an arrow leaving it. */
function LogoutIcon() {
  return (
    <Icon>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </Icon>
  );
}

/** Three sliders: settings and your own data. */
function DataIcon() {
  return (
    <Icon>
      <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
    </Icon>
  );
}

/**
 * Who is signed in and the way out, at the foot of the sidebar (ADR D-61). It shows the display
 * name only: with username-only login the username is the whole credential and must not sit on a
 * screen that gets screenshotted.
 */
export function ProfileCard({ user, onLogout }: { user: Session["user"]; onLogout: () => void }) {
  return (
    <section aria-label="Your profile" className="relative rounded-2xl bg-white/10 p-3">
      <Link href="/settings" className={NAME_LINK}>
        <span
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sidebar-ink font-display text-[15px] font-bold text-sidebar"
        >
          {initials(user.display_name)}
        </span>
        <span className="min-w-0 truncate text-[15px] font-bold text-sidebar-ink">
          {user.display_name}
        </span>
      </Link>
      <div className="mt-3 flex items-center justify-between gap-2">
        <Link href="/settings" data-tour="settings" className={TEXT_LINK}>
          <DataIcon />
          Your data
        </Link>
        <button type="button" onClick={onLogout} className={LOGOUT}>
          <LogoutIcon />
          Log out
        </button>
      </div>
    </section>
  );
}
