/**
 * Whether a person has seen the welcome slides and the tour of the app (ADR D-53), kept in this
 * browser and per person (testers may share a device). A small external store so the gate, the
 * tour and the Settings replay row stay in step.
 *
 * A browser that will not store anything is still honoured within the visit: what was marked is
 * remembered in memory too, so the slides never show twice in one visit. Nothing here leaves the
 * browser.
 */
export type Stage = "intro" | "tour" | "done";

const INTRO_KEY = "paysense.intro.seen";
const TOUR_KEY = "paysense.tour.seen";

const subscribers = new Set<() => void>();
const memory = new Set<string>();

const keyFor = (base: string, userId: string) => `${base}.${userId}`;

function seen(base: string, userId: string): boolean {
  const key = keyFor(base, userId);
  if (memory.has(key)) return true;
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false; // blocked storage counts as unseen
  }
}

function mark(base: string, userId: string): void {
  const key = keyFor(base, userId);
  memory.add(key);
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    // not kept: the in-memory mark covers this visit
  }
  subscribers.forEach((notify) => notify());
}

export function stageFor(userId: string): Stage {
  if (!seen(INTRO_KEY, userId)) return "intro";
  return seen(TOUR_KEY, userId) ? "done" : "tour";
}

export const markIntroSeen = (userId: string) => mark(INTRO_KEY, userId);
export const markTourSeen = (userId: string) => mark(TOUR_KEY, userId);

/** Start again from the first slide ("Show the intro again" in Settings). */
export function replayIntro(userId: string): void {
  for (const base of [INTRO_KEY, TOUR_KEY]) {
    const key = keyFor(base, userId);
    memory.delete(key);
    try {
      window.localStorage.removeItem(key);
    } catch {
      // nothing stored, nothing to clear
    }
  }
  subscribers.forEach((notify) => notify());
}

export function subscribeToIntro(notify: () => void): () => void {
  subscribers.add(notify);
  window.addEventListener("storage", notify);
  return () => {
    subscribers.delete(notify);
    window.removeEventListener("storage", notify);
  };
}

/** Drops the in-memory copy, as a page reload does. For tests. */
export function forgetForTests(): void {
  memory.clear();
}
