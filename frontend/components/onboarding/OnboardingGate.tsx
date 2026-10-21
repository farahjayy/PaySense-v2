"use client";

import { useSyncExternalStore } from "react";

import { Intro } from "@/components/onboarding/Intro";
import { Tour } from "@/components/onboarding/Tour";
import { markIntroSeen, markTourSeen, stageFor, subscribeToIntro } from "@/lib/introTour";

/**
 * Shows the welcome slides, then the tour, to a person who has not seen them (ADR D-53), and
 * nothing to one who has. What each person has seen is kept per person in this browser. The server
 * snapshot is "done", so nothing is drawn before the page has hydrated.
 */
export function OnboardingGate({ userId }: { userId: string }) {
  const stage = useSyncExternalStore(
    subscribeToIntro,
    () => stageFor(userId),
    () => "done" as const,
  );
  if (stage === "intro") {
    return (
      <Intro
        onTour={() => markIntroSeen(userId)}
        onSkip={() => {
          markIntroSeen(userId);
          markTourSeen(userId);
        }}
      />
    );
  }
  if (stage === "tour") return <Tour onDone={() => markTourSeen(userId)} />;
  return null;
}
