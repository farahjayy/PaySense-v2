import Link from "next/link";

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

const TEXT_LINK =
  "rounded-lg px-1 text-[13px] font-semibold text-sidebar-ink underline-offset-2 hover:underline focus-visible:underline";

/**
 * Who is signed in and the way out, at the foot of the sidebar (ADR D-61). It shows the display
 * name only: with username-only login the username is the whole credential and must not sit on a
 * screen that gets screenshotted.
 */
export function ProfileCard({
  user,
  onLogout,
  onIntro,
}: {
  user: Session["user"];
  onLogout: () => void;
  onIntro: () => void;
}) {
  return (
    <section aria-label="Your profile" className="relative rounded-2xl bg-white/10 p-3">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sidebar-ink font-display text-[15px] font-bold text-sidebar"
        >
          {initials(user.display_name)}
        </span>
        <p className="min-w-0 truncate text-[15px] font-bold text-sidebar-ink">
          {user.display_name}
        </p>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <Link href="/settings" data-tour="settings" className={TEXT_LINK}>
          Your data
        </Link>
        <button type="button" onClick={onLogout} className={`${TEXT_LINK} px-2 py-1`}>
          Log out
        </button>
      </div>
      <button
        type="button"
        onClick={onIntro}
        className="mt-1 rounded-lg px-1 text-[12px] text-sidebar-muted underline-offset-2 hover:underline focus-visible:underline"
      >
        Show the intro again
      </button>
    </section>
  );
}
