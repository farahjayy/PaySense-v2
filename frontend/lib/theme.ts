/**
 * Light or dark (ADR D-58). The choice is an attribute on <html> (`data-theme`), which the colour
 * tokens in globals.css key off, kept in this browser, and followed from the device's own setting
 * until the person chooses. A small external store so the toggle and anything else that cares stay
 * in step.
 *
 * `themeInitScript` is the same decision as `resolveTheme`, written as a string for the <head> so
 * the page is the right colour before it first paints (no flash). It is built from the same key.
 */
export type Theme = "light" | "dark";

export const THEME_KEY = "paysense.theme";

const subscribers = new Set<() => void>();

function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
}

/** A stored choice wins; otherwise the device's setting; a value this code does not know is ignored. */
export function resolveTheme(stored: string | null, systemDark: boolean): Theme {
  if (isTheme(stored)) return stored;
  return systemDark ? "dark" : "light";
}

/** The theme the page is showing now (light when the attribute is missing or unknown). */
export function currentTheme(): Theme {
  const attribute = document.documentElement.getAttribute("data-theme");
  return isTheme(attribute) ? attribute : "light";
}

/** Show this theme now and keep the choice in this browser (the page changes even if it cannot). */
export function setTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // blocked storage: the choice holds for this visit only
  }
  subscribers.forEach((notify) => notify());
}

export function toggleTheme(): void {
  setTheme(currentTheme() === "dark" ? "light" : "dark");
}

export function subscribeToTheme(notify: () => void): () => void {
  subscribers.add(notify);
  return () => {
    subscribers.delete(notify);
  };
}

/**
 * The script for <head>: the same decision as `resolveTheme`, run before first paint. It never
 * throws (storage can be blocked, `matchMedia` can be missing) and always lands on a theme.
 */
export function themeInitScript(): string {
  return (
    "(function(){try{" +
    `var s=null;try{s=localStorage.getItem(${JSON.stringify(THEME_KEY)});}catch(e){}` +
    'var d=false;try{d=!!(window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches);}catch(e){}' +
    'var t=(s==="light"||s==="dark")?s:(d?"dark":"light");' +
    'document.documentElement.setAttribute("data-theme",t);' +
    "}catch(e){}})();"
  );
}
