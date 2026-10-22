"use client";

import { useSyncExternalStore } from "react";
import { z } from "zod";

/**
 * The login session (ADR D-03): a bearer credential plus the user, kept in sessionStorage so it
 * dies with the tab. Reads never throw — storage can be blocked — and never have side effects, so
 * they are safe inside useSyncExternalStore snapshots.
 */
const SessionSchema = z.object({
  token: z.string().min(1),
  expiresAt: z.number(),
  user: z.object({
    id: z.string(),
    username: z.string(),
    display_name: z.string(),
    // A plain string: the allowed values belong to the backend, and a value this build does not
    // know about must not silently invalidate a valid login.
    persona: z.string().nullable(),
    // What the person may do (ADR D-56), as the server last said. Optional, so a session saved
    // before roles existed still signs in (as an ordinary user), and a plain string, so a role
    // this build does not know about neither logs anyone out nor gives them any power.
    role: z.string().optional(),
  }),
});

export type Session = z.infer<typeof SessionSchema>;

/**
 * Whether this session belongs to an admin. This decides only what to SHOW: the browser's copy of
 * the role protects nothing. The server reads the role from the database on every request and
 * `require_admin` is what enforces (ADR D-56).
 */
export function isAdmin(session: Session | null): boolean {
  return session?.user.role === "admin";
}

const STORAGE_KEY = "paysense.session";
const listeners = new Set<() => void>();
let cache: { raw: string | null; value: Session | null } = { raw: null, value: null };
// Set only when sessionStorage refused the write (private mode, quota): the session then lives in
// memory so login still works for this tab instead of bouncing back to /login.
let memoryOnly: Session | null = null;

function readRaw(): string | null {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function parse(raw: string | null): Session | null {
  if (raw === null) return null;
  try {
    const result = SessionSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

function notify(): void {
  listeners.forEach((listener) => listener());
}

/** The stored session, or null if absent, malformed or expired. Stable between unchanged reads. */
export function getSession(now: number = Date.now()): Session | null {
  const raw = readRaw();
  if (raw !== cache.raw) cache = { raw, value: parse(raw) };
  const value = cache.value ?? (raw === null ? memoryOnly : null);
  return value !== null && value.expiresAt > now ? value : null;
}

/** Stores the session. Returns false if it could not be persisted (it still works until reload). */
export function saveSession(session: Session): boolean {
  let persisted = true;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    memoryOnly = null;
  } catch {
    persisted = false;
    memoryOnly = session;
  }
  notify();
  return persisted;
}

export function clearSession(): void {
  memoryOnly = null;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing to clear */
  }
  notify();
}

export function subscribeSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export type AuthState =
  | { status: "loading"; session: null }
  | { status: "anonymous"; session: null }
  | { status: "authenticated"; session: Session };

const subscribeNothing = () => () => {};

/**
 * Where the visitor stands. "loading" covers the server render and the hydration pass, when
 * sessionStorage cannot be known yet — callers must not redirect while loading.
 */
export function useAuth(): AuthState {
  const hydrated = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const session = useSyncExternalStore(subscribeSession, () => getSession(), () => null);
  if (!hydrated) return { status: "loading", session: null };
  return session ? { status: "authenticated", session } : { status: "anonymous", session: null };
}
