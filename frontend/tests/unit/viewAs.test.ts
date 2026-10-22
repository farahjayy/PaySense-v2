import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { setViewAsUser, useViewingAsUser } from "@/lib/viewAs";

describe("viewAs", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    setViewAsUser(false);
  });

  it("is off to begin with and follows the switch", () => {
    const { result } = renderHook(() => useViewingAsUser());
    expect(result.current).toBe(false);

    act(() => setViewAsUser(true));
    expect(result.current).toBe(true);

    act(() => setViewAsUser(false));
    expect(result.current).toBe(false);
  });

  it("still works for the visit when the browser will not store it", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const { result } = renderHook(() => useViewingAsUser());

    act(() => setViewAsUser(true));

    expect(result.current).toBe(true);
  });
});
