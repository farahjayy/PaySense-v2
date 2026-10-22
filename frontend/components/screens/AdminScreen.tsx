"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { Card, CardCaption, CardTitle } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { replayIntro } from "@/lib/introTour";
import { isAdmin, useAuth } from "@/lib/session";

/**
 * Author-only tools (ADR D-57), reached from the sidebar for an admin. Whether to show them is
 * decided from the role the browser last received, which is display only: this page holds no
 * data, and the tour only clears two flags in this browser. Any tool that does hold data must be
 * guarded on the server with `require_admin` (ADR D-56).
 */
export function AdminScreen() {
  const router = useRouter();
  const auth = useAuth();
  const admin = auth.status === "authenticated" && isAdmin(auth.session);
  const userId = auth.status === "authenticated" ? auth.session.user.id : null;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title="Admin"
        intro="Tools for testing and demos. Only admins can see this page."
      />
      {admin && userId ? (
        <Card>
          <CardTitle>Quick tour</CardTitle>
          <CardCaption>
            Plays the welcome slides and the tour from the start, as on a first sign-in, so you can
            see or demonstrate the onboarding on this account.
          </CardCaption>
          <div className="mt-3">
            <Button
              variant="accent"
              onClick={() => {
                replayIntro(userId);
                router.push("/");
              }}
            >
              Launch the quick tour
            </Button>
          </div>
        </Card>
      ) : (
        <Card>
          <CardTitle>This page is for admins</CardTitle>
          <CardCaption>Your account does not have access to these tools.</CardCaption>
          <p className="mt-3 text-[14px]">
            <Link href="/" className="font-semibold text-accent underline-offset-2 hover:underline">
              Back to the dashboard
            </Link>
          </p>
        </Card>
      )}
    </div>
  );
}
