/**
 * Whether the person hid the Getting started checklist, kept in this browser only. A small
 * external store so the dashboard, the "show it again" line and Settings all stay in step.
 */
const HIDDEN_KEY = "paysense.gettingStarted.hidden";
const subscribers = new Set<() => void>();

function notifyAll(): void {
  subscribers.forEach((notify) => notify());
}

export function subscribeToChecklist(notify: () => void): () => void {
  subscribers.add(notify);
  window.addEventListener("storage", notify);
  return () => {
    subscribers.delete(notify);
    window.removeEventListener("storage", notify);
  };
}

export function checklistHidden(): boolean {
  try {
    return window.localStorage.getItem(HIDDEN_KEY) === "1";
  } catch {
    return false; // storage can be blocked (private window): the checklist simply stays
  }
}

/** Hide the checklist for good in this browser; false if the browser would not keep the choice. */
export function hideGettingStarted(): boolean {
  try {
    window.localStorage.setItem(HIDDEN_KEY, "1");
  } catch {
    return false;
  }
  notifyAll();
  return true;
}

/** Bring the checklist back (it was hidden with "Hide this"), in this browser. */
export function restoreGettingStarted(): void {
  try {
    window.localStorage.removeItem(HIDDEN_KEY);
  } catch {
    // nothing stored, nothing to clear
  }
  notifyAll();
}
