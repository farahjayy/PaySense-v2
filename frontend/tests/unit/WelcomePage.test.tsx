import { render, screen, within } from "@testing-library/react";
import axe from "axe-core";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import WelcomePage from "@/app/welcome/page";

describe("WelcomePage (ADR D-55)", () => {
  it("says what PaySense is in one heading and one sentence", () => {
    render(<WelcomePage />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Think before you split.");
    expect(screen.getByText(/know whether a buy-now-pay-later plan fits/i)).toBeInTheDocument();
  });

  it("has its sections in a sensible order", () => {
    render(<WelcomePage />);

    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Small instalments add up",
      "How it works",
      "One of three answers",
      "Knows the plans students use",
      "You stay in control",
      "Ready when you are",
    ]);
  });

  it("explains how it works in three steps and gives the three answers", () => {
    render(<WelcomePage />);

    const how = screen.getByRole("region", { name: "How it works" });
    expect(within(how).getAllByRole("listitem")).toHaveLength(3);
    const answers = screen.getByRole("region", { name: "One of three answers" });
    expect(within(answers).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      expect.stringMatching(/^Safe/),
      expect.stringMatching(/^Caution/),
      expect.stringMatching(/^At Risk/),
    ]);
  });

  it("names the providers it really knows", () => {
    render(<WelcomePage />);

    const section = screen.getByRole("region", { name: "Knows the plans students use" });
    for (const name of ["SPayLater", "TikTok PayLater", "Atome"]) {
      expect(section).toHaveTextContent(name);
    }
  });

  it("only ever leads to the login or back to itself, because there is no sign-up", () => {
    render(<WelcomePage />);

    const hrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(hrefs.length).toBeGreaterThanOrEqual(3);
    for (const href of hrefs) expect(["/login", "/welcome", "#how"]).toContain(href);
    expect(screen.getByRole("link", { name: /see how it works/i })).toHaveAttribute("href", "#how");
    expect(screen.getByRole("region", { name: "How it works" })).toHaveAttribute("id", "how");
  });

  it("promises nothing the app does not do: no account to create, no email, no assistant", () => {
    const { container } = render(<WelcomePage />);

    expect(container.textContent).not.toMatch(/create (a free |your )?account|sign up|email|assistant/i);
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<WelcomePage />);

    const { violations } = await axe.run(container);
    expect(violations).toEqual([]);
  });

  it("shows finished content to anyone who has asked for reduced motion", () => {
    const css = readFileSync(path.join(__dirname, "../../app/welcome/welcome.css"), "utf8");

    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
  });
});
