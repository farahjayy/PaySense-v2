"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

/**
 * Which notices a person has closed (ADR D-62), kept in this browser and per person, as testers
 * may share a device. Nothing here leaves the browser. A browser that will not store anything is
 * still honoured within the visit, by an in-memory copy.
 */
const KEY_BASE = "paysense.notices.dismissed";

const subscribers = new Set<() => void>();
const memory = new Map<string, Set<string>>();

const storageKey = (userId: string) => `${KEY_BASE}.${userId}`;

function stored(userId: string): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(storageKey(userId)) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === "string") : [];
  } catch {
    return []; // blocked storage or damaged data: nothing is closed
  }
}

/** Every closed key as one string, so a store snapshot is a stable primitive. */
function snapshot(userId: string): string {
  return [...new Set([...stored(userId), ...(memory.get(userId) ?? [])])].sort().join("\n");
}

function write(userId: string, keys: Set<string>): void {
  memory.set(userId, keys);
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify([...keys]));
  } catch {
    // not kept: the in-memory copy covers this visit
  }
  subscribers.forEach((notify) => notify());
}

function subscribe(notify: () => void): () => void {
  subscribers.add(notify);
  window.addEventListener("storage", notify);
  return () => {
    subscribers.delete(notify);
    window.removeEventListener("storage", notify);
  };
}

function current(userId: string): Set<string> {
  const raw = snapshot(userId);
  return new Set(raw === "" ? [] : raw.split("\n"));
}

export function useDismissedNotices(userId: string) {
  const raw = useSyncExternalStore(
    subscribe,
    () => snapshot(userId),
    () => "",
  );
  const keys = useMemo(() => new Set(raw === "" ? [] : raw.split("\n")), [raw]);
  const dismiss = useCallback(
    (key: string) => write(userId, new Set(current(userId)).add(key)),
    [userId],
  );
  const restore = useCallback(
    (key: string) => {
      const next = new Set(current(userId));
      next.delete(key);
      write(userId, next);
    },
    [userId],
  );
  return { keys, isDismissed: (key: string) => keys.has(key), dismiss, restore };
}

/** Drops the in-memory copy, as a page reload does. For tests. */
export function forgetNoticesForTests(): void {
  memory.clear();
  subscribers.forEach((notify) => notify());
}
