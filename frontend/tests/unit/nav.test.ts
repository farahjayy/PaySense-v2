import { describe, expect, it } from "vitest";

import { isActive } from "@/lib/nav";

describe("isActive", () => {
  it("matches the home link only on the exact root", () => {
    expect(isActive("/", "/")).toBe(true);
    expect(isActive("/plans", "/")).toBe(false);
  });

  it("matches a section and anything beneath it", () => {
    expect(isActive("/plans", "/plans")).toBe(true);
    expect(isActive("/plans/abc", "/plans")).toBe(true);
    expect(isActive("/plans/", "/plans")).toBe(true);
  });

  it("keeps Transactions lit on Categories, which has no sidebar entry of its own, but not on Import, which has (ADR D-61)", () => {
    expect(isActive("/categories", "/transactions")).toBe(true);
    expect(isActive("/categories/abc", "/transactions")).toBe(true);
    expect(isActive("/import", "/transactions")).toBe(false);
    expect(isActive("/import", "/import")).toBe(true);
    expect(isActive("/plans", "/transactions")).toBe(false);
  });

  it("does not match a different route that merely shares a prefix", () => {
    expect(isActive("/plans-old", "/plans")).toBe(false);
    expect(isActive("/planning", "/plan")).toBe(false);
  });
});
