"use client";

import Link from "next/link";

import { useAlerts, useForecast } from "@/lib/api/queries";
import { notices } from "@/lib/forecast";
import { isActive } from "@/lib/nav";
import { useDismissedNotices } from "@/lib/noticeStore";

const BELL = "M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0";
const MAX_SHOWN = 9;

/**
 * How many things need attention: the server's alerts plus the notices the person has not closed,
 * the same two lists the Notifications page opens with. Nothing while either is still loading or
 * failed, so the badge never shows a guess.
 */
function useAttentionCount(userId: string): number | null {
  const forecast = useForecast();
  const alerts = useAlerts();
  const { isDismissed } = useDismissedNotices(userId);
  if (!forecast.data || !alerts.data) return null;
  const open = notices(forecast.data).filter((n) => !n.dismissKey || !isDismissed(n.dismissKey));
  return open.length + alerts.data.items.length;
}

/** The bell in the top bar: a link to Notifications with a count when something needs attention. */
export function NotificationBell({ userId, pathname }: { userId: string; pathname: string }) {
  const count = useAttentionCount(userId);
  const shown = count !== null && count > 0 ? count : 0;
  const label = shown > 0 ? `Notifications, ${shown} need attention` : "Notifications";
  return (
    <Link
      href="/notifications"
      aria-label={label}
      aria-current={isActive(pathname, "/notifications") ? "page" : undefined}
      className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink-secondary hover:bg-surface-2 hover:text-ink"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={BELL} />
      </svg>
      {shown > 0 && (
        <span
          data-testid="bell-badge"
          aria-hidden="true"
          className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[11px] font-bold leading-none text-on-accent"
        >
          {shown > MAX_SHOWN ? `${MAX_SHOWN}+` : shown}
        </span>
      )}
    </Link>
  );
}
