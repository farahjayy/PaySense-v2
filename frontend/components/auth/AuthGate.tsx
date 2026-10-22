"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/session";

type Props = { children: ReactNode };

/**
 * Renders its children only for a signed-in visitor. A stored session is also confirmed with the
 * server once; if the server rejects it, the API client clears it and the visitor lands on /login.
 * Whenever the session ends, cached query data is dropped so the next user never sees it. A
 * signed-out visitor at the root is sent to the welcome page, and anywhere else to the login.
 */
export function AuthGate({ children }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const wasSignedIn = useRef(false);
  const queryClient = useQueryClient();
  const auth = useAuth();

  useQuery({
    queryKey: ["me", auth.session?.token],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/auth/me");
      if (error) throw error;
      return data ?? null;
    },
    enabled: auth.status === "authenticated",
    retry: false,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (auth.status === "authenticated") wasSignedIn.current = true;
    if (auth.status === "anonymous") {
      queryClient.clear();
      // The front door explains the product (ADR D-55), but only to someone who arrives signed
      // out. A person whose session just ended (logging out, an expired token) goes to the login,
      // as does a deep link, so that nobody following one to a plan is made to start over.
      const arrivedSignedOut = !wasSignedIn.current && pathname === "/";
      router.replace(arrivedSignedOut ? "/welcome" : "/login");
    }
  }, [auth.status, pathname, queryClient, router]);

  if (auth.status !== "authenticated") {
    return (
      <div role="status" className="flex min-h-dvh items-center justify-center text-sm text-ink-secondary">
        Loading…
      </div>
    );
  }
  return <>{children}</>;
}
