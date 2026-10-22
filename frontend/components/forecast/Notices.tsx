"use client";

import Link from "next/link";

import { Banner } from "@/components/ui/Banner";
import type { Notice } from "@/lib/forecast";
import { useDismissedNotices } from "@/lib/noticeStore";
import { useAuth } from "@/lib/session";

/** The notice's sentence and, when there is one, the link that helps put it right. */
export function NoticeBody({ notice }: { notice: Notice }) {
  return (
    <>
      {notice.body}
      {notice.action && (
        <Link
          href={notice.action.href}
          className="ml-2 font-semibold text-accent underline-offset-2 hover:underline"
        >
          {notice.action.label}
        </Link>
      )}
    </>
  );
}

/** The signed-in person's id, or a stand-in that never matches a real one. */
export function useNoticeOwner(): string {
  return useAuth().session?.user.id ?? "signed-out";
}

/**
 * Data-quality notes, shown beside the number they qualify rather than hidden below it. A note
 * about a month that looks incomplete can be closed (ADR D-62): it then drops out of this list
 * and is counted in a line that leads to every notification, closed ones included. Notes that
 * qualify the number itself cannot be closed.
 */
export function Notices({ items }: { items: readonly Notice[] }) {
  const { isDismissed, dismiss } = useDismissedNotices(useNoticeOwner());
  if (items.length === 0) return null;
  const open = items.filter((n) => !n.dismissKey || !isDismissed(n.dismissKey));
  const closed = items.length - open.length;
  return (
    <div className="space-y-2">
      {open.length > 0 && (
        <ul className="space-y-2" aria-label="Things to know about this forecast">
          {open.map((n) => (
            <li key={n.id}>
              <Banner
                tone={n.tone}
                title={n.title}
                onClose={n.dismissKey ? () => dismiss(n.dismissKey as string) : undefined}
              >
                <NoticeBody notice={n} />
              </Banner>
            </li>
          ))}
        </ul>
      )}
      {closed > 0 && (
        <p className="text-[13px] text-ink-secondary">
          {closed} {closed === 1 ? "notice" : "notices"} closed.{" "}
          <Link
            href="/notifications"
            className="font-semibold text-accent underline-offset-2 hover:underline"
          >
            See all notifications
          </Link>
        </p>
      )}
    </div>
  );
}
