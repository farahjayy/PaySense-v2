import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { forgetNoticesForTests, useDismissedNotices } from "@/lib/noticeStore";

describe("useDismissedNotices", () => {
  beforeEach(() => {
    window.localStorage.clear();
    forgetNoticesForTests();
  });
  afterEach(() => vi.restoreAllMocks());

  it("starts with nothing closed", () => {
    const { result } = renderHook(() => useDismissedNotices("u1"));

    expect(result.current.isDismissed("2026-08:no_income")).toBe(false);
  });

  it("closes a notice and brings it back", () => {
    const { result } = renderHook(() => useDismissedNotices("u1"));

    act(() => result.current.dismiss("2026-08:no_income"));
    expect(result.current.isDismissed("2026-08:no_income")).toBe(true);
    expect(result.current.isDismissed("2026-09:no_income")).toBe(false);

    act(() => result.current.restore("2026-08:no_income"));
    expect(result.current.isDismissed("2026-08:no_income")).toBe(false);
  });

  it("remembers across a remount, as a reload would", () => {
    const first = renderHook(() => useDismissedNotices("u1"));
    act(() => first.result.current.dismiss("2026-08:no_income"));
    first.unmount();
    forgetNoticesForTests(); // drop the in-memory copy: only storage is left

    const second = renderHook(() => useDismissedNotices("u1"));

    expect(second.result.current.isDismissed("2026-08:no_income")).toBe(true);
  });

  it("keeps each person's choices apart, as testers may share a device", () => {
    const a = renderHook(() => useDismissedNotices("u1"));
    const b = renderHook(() => useDismissedNotices("u2"));

    act(() => a.result.current.dismiss("2026-08:no_income"));

    expect(a.result.current.isDismissed("2026-08:no_income")).toBe(true);
    expect(b.result.current.isDismissed("2026-08:no_income")).toBe(false);
  });

  it("brings a closed month back when a new reason appears, because the key carries the reasons", () => {
    const { result } = renderHook(() => useDismissedNotices("u1"));

    act(() => result.current.dismiss("2026-08:no_income"));

    expect(result.current.isDismissed("2026-08:low_spend+no_income")).toBe(false);
  });

  it("still closes for this visit when the browser will not store the choice", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const { result } = renderHook(() => useDismissedNotices("u1"));

    act(() => result.current.dismiss("2026-08:no_income"));

    expect(result.current.isDismissed("2026-08:no_income")).toBe(true);
  });

  it("treats damaged stored data as nothing closed rather than failing", () => {
    window.localStorage.setItem("paysense.notices.dismissed.u1", "{not json");

    const { result } = renderHook(() => useDismissedNotices("u1"));

    expect(result.current.isDismissed("2026-08:no_income")).toBe(false);
  });
});
