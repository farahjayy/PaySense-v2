"use client";

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";

import { Intro } from "@/components/onboarding/Intro";
import { Tour } from "@/components/onboarding/Tour";
import { markIntroSeen, markTourSeen, stageFor, subscribeToIntro } from "@/lib/introTour";

type Props = { userId: string; children?: ReactNode };

/**
 * Shows the welcome slides, then the tour, to a person who has not seen them (ADR D-53), and
 * nothing to one who has. What each person has seen is kept per person in this browser. While
 * either is showing, the app behind is inert (no focus, no clicks), and when they end focus goes
 * back to the page. The server snapshot is "done", so nothing is drawn before hydration.
 */
export function OnboardingGate({ userId, children }: Props) {
  const stage = useSyncExternalStore(
    subscribeToIntro,
    () => stageFor(userId),
    () => "done" as const,
  );
  const active = stage !== "done";
  const wasActive = useRef(active);

  useEffect(() => {
    if (wasActive.current && !active) document.getElementById("main")?.focus();
    wasActive.current = active;
  }, [active]);

  return (
    <>
      {children !== undefined && <div inert={active}>{children}</div>}
      {stage === "intro" && (
        <Intro
          onTour={() => markIntroSeen(userId)}
          onSkip={() => {
            markIntroSeen(userId);
            markTourSeen(userId);
          }}
        />
      )}
      {stage === "tour" && <Tour onDone={() => markTourSeen(userId)} />}
    </>
  );
}
