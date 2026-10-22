"use client";

import { useSyncExternalStore } from "react";

/**
 * "View as a user" (ADR D-61): an admin can hide the admin-only parts in this browser tab to see
 * what an ordinary student sees. It changes what is shown, never what the server allows, so it is a
 * preview and not a permissions test. It lasts for the tab, and still works for the visit when the
 * browser will not store it.
 */
const KEY = "paysense.viewAsUser";
const subscribers = new Set<() => void>();
let inMemory = false;

function snapshot(): boolean {
  if (inMemory) return true;
  try {
    return window.sessionStorage.getItem(KEY) === "1";
  } catch {
    return false; // blocked storage: only the in-memory choice counts
  }
}

function subscribe(notify: () => void): () => void {
  subscribers.add(notify);
  window.addEventListener("storage", notify);
  return () => {
    subscribers.delete(notify);
    window.removeEventListener("storage", notify);
  };
}

export function setViewAsUser(on: boolean): void {
  inMemory = on;
  try {
    if (on) window.sessionStorage.setItem(KEY, "1");
    else window.sessionStorage.removeItem(KEY);
  } catch {
    // not kept: the in-memory choice covers this visit
  }
  subscribers.forEach((notify) => notify());
}

export function useViewingAsUser(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
