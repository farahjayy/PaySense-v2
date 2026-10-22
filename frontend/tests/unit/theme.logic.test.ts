import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  currentTheme,
  resolveTheme,
  setTheme,
  subscribeToTheme,
  THEME_KEY,
  themeInitScript,
  toggleTheme,
} from "@/lib/theme";

function systemPrefers(dark: boolean | null) {
  if (dark === null) {
    vi.stubGlobal("matchMedia", undefined);
    return;
  }
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("dark") ? dark : !dark,
    media: query,
  }));
}

function runInitScript() {
  new Function(themeInitScript())();
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  systemPrefers(false);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("resolveTheme", () => {
  it("lets a stored choice win over the device setting", () => {
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("light", true)).toBe("light");
  });

  it("follows the device when nothing is stored", () => {
    expect(resolveTheme(null, true)).toBe("dark");
    expect(resolveTheme(null, false)).toBe("light");
  });

  it("ignores a stored value it does not know", () => {
    expect(resolveTheme("sepia", true)).toBe("dark");
    expect(resolveTheme("", false)).toBe("light");
    expect(resolveTheme("Dark", false)).toBe("light");
  });
});

describe("setTheme and toggleTheme", () => {
  it("sets the attribute on the page, keeps the choice, and says so", () => {
    const heard = vi.fn();
    const stop = subscribeToTheme(heard);

    setTheme("dark");

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(window.localStorage.getItem(THEME_KEY)).toBe("dark");
    expect(currentTheme()).toBe("dark");
    expect(heard).toHaveBeenCalledOnce();
    stop();
  });

  it("flips between the two", () => {
    setTheme("light");

    toggleTheme();
    expect(currentTheme()).toBe("dark");
    toggleTheme();
    expect(currentTheme()).toBe("light");
  });

  it("still changes the page when the browser will not store the choice", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(() => setTheme("dark")).not.toThrow();
    expect(currentTheme()).toBe("dark");
  });

  it("stops telling a listener that has unsubscribed", () => {
    const heard = vi.fn();
    subscribeToTheme(heard)();

    setTheme("dark");

    expect(heard).not.toHaveBeenCalled();
  });
});

describe("currentTheme", () => {
  it("is what the page says, and light when it says nothing", () => {
    expect(currentTheme()).toBe("light");
    document.documentElement.setAttribute("data-theme", "dark");
    expect(currentTheme()).toBe("dark");
    document.documentElement.setAttribute("data-theme", "purple");
    expect(currentTheme()).toBe("light");
  });
});

describe("the script that runs before first paint", () => {
  it("applies a stored dark choice", () => {
    window.localStorage.setItem(THEME_KEY, "dark");

    runInitScript();

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("follows a dark device when nothing is stored, and a light one", () => {
    systemPrefers(true);
    runInitScript();
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");

    systemPrefers(false);
    runInitScript();
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("prefers the stored choice to the device", () => {
    systemPrefers(true);
    window.localStorage.setItem(THEME_KEY, "light");

    runInitScript();

    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("ignores a junk stored value", () => {
    systemPrefers(true);
    window.localStorage.setItem(THEME_KEY, "sepia");

    runInitScript();

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("does not throw, and lands on the device setting, when storage is blocked", () => {
    systemPrefers(true);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(() => runInitScript()).not.toThrow();
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("is light when the browser cannot say what the device prefers", () => {
    systemPrefers(null);

    runInitScript();

    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("reads the same key the app writes, so the two cannot drift", () => {
    expect(themeInitScript()).toContain(THEME_KEY);
  });
});
