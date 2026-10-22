"use client";

import Link from "next/link";

import { NoticeBody, useNoticeOwner } from "@/components/forecast/Notices";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { useAlerts, useForecast, type Alerts } from "@/lib/api/queries";
import { notices, type Notice } from "@/lib/forecast";
import { useDismissedNotices } from "@/lib/noticeStore";

type Alert = Alerts["items"][number];

function AlertBanner({ alert }: { alert: Alert }) {
  return (
    <Banner tone={alert.severity === "high" ? "danger" : "warning"} title={alert.title}>
      {alert.detail}
      <Link
        href={alert.href}
        className="ml-2 font-semibold text-accent underline-offset-2 hover:underline"
      >
        See plans
      </Link>
    </Banner>
  );
}

function ClosedRow({ notice, onRestore }: { notice: Notice; onRestore: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-card border border-line bg-surface-2 px-4 py-3">
      <div className="min-w-0 text-[13px] leading-relaxed">
        <p className="font-semibold text-ink">{notice.title}</p>
        <p className="text-ink-secondary">{notice.body}</p>
      </div>
      <Button
        variant="secondary"
        size="sm"
        onClick={onRestore}
        aria-label={`Restore: ${notice.title}`}
      >
        Restore
      </Button>
    </div>
  );
}

/**
 * Every notice and alert in one place (ADR D-62): what needs attention now, and the notices the
 * person closed, which they can bring back. Nothing is computed here; the notices are the ones the
 * dashboard already shows, and the alerts are the server's.
 */
export function NotificationsScreen() {
  const forecast = useForecast();
  const alerts = useAlerts();
  const { isDismissed, dismiss, restore } = useDismissedNotices(useNoticeOwner());

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Notifications"
        intro="Everything PaySense has flagged about your records and your plans, including notices you closed."
      />
      {forecast.isPending || alerts.isPending ? (
        <Skeleton lines={4} label="Loading notifications" />
      ) : forecast.isError || alerts.isError ? (
        <ErrorState
          message={(forecast.error ?? alerts.error)?.message ?? "Try again in a moment."}
          onRetry={() => {
            void forecast.refetch();
            void alerts.refetch();
          }}
        />
      ) : (
        <Lists
          all={notices(forecast.data)}
          alerts={alerts.data.items}
          isDismissed={isDismissed}
          dismiss={dismiss}
          restore={restore}
        />
      )}
    </div>
  );
}

function Lists({
  all,
  alerts,
  isDismissed,
  dismiss,
  restore,
}: {
  all: readonly Notice[];
  alerts: readonly Alert[];
  isDismissed: (key: string) => boolean;
  dismiss: (key: string) => void;
  restore: (key: string) => void;
}) {
  const closed = all.filter((n) => n.dismissKey && isDismissed(n.dismissKey));
  const open = all.filter((n) => !closed.includes(n));
  return (
    <>
      <section aria-labelledby="open-heading">
        <h2 id="open-heading" className="mb-3 text-[15px] font-semibold text-ink">
          Needs your attention
        </h2>
        {open.length + alerts.length === 0 ? (
          <EmptyState title="Nothing needs your attention">
            When something does, such as an overdue instalment or a month that looks incomplete, it
            appears here.
          </EmptyState>
        ) : (
          <ul className="space-y-2">
            {alerts.map((alert) => (
              <li key={`${alert.rule}-${alert.title}`}>
                <AlertBanner alert={alert} />
              </li>
            ))}
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
      </section>
      {closed.length > 0 && (
        <section aria-labelledby="closed-heading">
          <h2 id="closed-heading" className="mb-1 text-[15px] font-semibold text-ink">
            Closed
          </h2>
          <p className="mb-3 text-[13px] text-ink-secondary">
            You closed these. Closing a notice does not change your forecast: a month that looks
            incomplete is still used as it is logged.
          </p>
          <ul className="space-y-2">
            {closed.map((n) => (
              <li key={n.id}>
                <ClosedRow notice={n} onRestore={() => restore(n.dismissKey as string)} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
