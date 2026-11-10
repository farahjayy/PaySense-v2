import { describe, expect, it, vi } from "vitest";

describe("zod under the production Content-Security-Policy", () => {
  it("is told not to probe for eval, which the policy forbids and the browser reports", async () => {
    vi.resetModules();
    const { z } = await import("zod");
    await import("@/lib/session");

    expect(z.core.globalConfig.jitless).toBe(true);
  });
});
