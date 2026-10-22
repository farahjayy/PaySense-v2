import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { THEME_KEY } from "@/lib/theme";

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});
afterEach(() => document.documentElement.removeAttribute("data-theme"));

describe("ThemeToggle (ADR D-58)", () => {
  it("is a button called Dark mode that says whether it is on", () => {
    render(<ThemeToggle />);

    expect(screen.getByRole("button", { name: "Dark mode" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("turns dark mode on and off, shows it on the page, and keeps the choice", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    const button = screen.getByRole("button", { name: "Dark mode" });

    await user.click(button);
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(window.localStorage.getItem(THEME_KEY)).toBe("dark");

    await user.click(button);
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(window.localStorage.getItem(THEME_KEY)).toBe("light");
  });

  it("starts pressed when the page already came up dark", () => {
    document.documentElement.setAttribute("data-theme", "dark");

    render(<ThemeToggle />);

    expect(screen.getByRole("button", { name: "Dark mode" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("has no accessibility violations in either state", async () => {
    const user = userEvent.setup();
    const { container } = render(<ThemeToggle />);
    expect((await axe.run(container)).violations).toEqual([]);

    await user.click(screen.getByRole("button", { name: "Dark mode" }));

    expect((await axe.run(container)).violations).toEqual([]);
  });
});
