import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OnboardingGate } from "@/components/onboarding/OnboardingGate";
import { forgetForTests, markIntroSeen, markTourSeen, replayIntro, stageFor } from "@/lib/introTour";

beforeEach(() => {
  window.localStorage.clear();
  forgetForTests();
  // jsdom has no layout: give every marked target a box so the tour has somewhere to point
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.hasAttribute("data-tour")
      ? ({ top: 100, left: 10, width: 180, height: 40, right: 190, bottom: 140 } as DOMRect)
      : ({ top: 0, left: 0, width: 0, height: 0, right: 0, bottom: 0 } as DOMRect);
  });
});
afterEach(() => vi.restoreAllMocks());

function renderGate(userId = "u1") {
  return render(
    <>
      <a href="#x" data-tour="risk">
        Risk check
      </a>
      <OnboardingGate userId={userId} />
    </>,
  );
}

describe("OnboardingGate and the page behind it", () => {
  function renderWithPage() {
    return render(
      <OnboardingGate userId="u1">
        <main id="main" tabIndex={-1}>
          <button type="button">Log out</button>
          <a href="#x" data-tour="risk">
            Risk check
          </a>
        </main>
      </OnboardingGate>,
    );
  }

  it("keeps keyboard and pointer out of the app while the slides are showing", () => {
    const { container } = renderWithPage();

    expect(container.querySelector("[inert]")).toContainElement(screen.getByText("Log out"));
  });

  it("gives the app back, and focus, when the person is done", async () => {
    const user = userEvent.setup();
    const { container } = renderWithPage();

    await user.click(screen.getByRole("button", { name: "Skip" }));

    expect(container.querySelector("[inert]")).toBeNull();
    expect(screen.getByRole("main")).toHaveFocus();
  });

  it("never makes the app inert for someone who has nothing to see", () => {
    markIntroSeen("u1");
    markTourSeen("u1");
    const { container } = renderWithPage();

    expect(container.querySelector("[inert]")).toBeNull();
  });
});

describe("OnboardingGate", () => {
  it("shows the welcome slides to someone who has not seen them", () => {
    renderGate();

    expect(screen.getByRole("dialog", { name: /welcome to paysense/i })).toBeInTheDocument();
  });

  it("goes from the slides to the tour when asked", async () => {
    const user = userEvent.setup();
    renderGate();
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: /take a quick tour/i }));

    expect(screen.queryByRole("dialog", { name: /welcome/i })).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: /tour of paysense/i })).toBeInTheDocument();
    expect(stageFor("u1")).toBe("tour");
  });

  it("skipping the slides skips the tour as well, and neither comes back", async () => {
    const user = userEvent.setup();
    const { container } = renderGate();
    await user.click(screen.getByRole("button", { name: "Skip" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(stageFor("u1")).toBe("done");
    expect(container.querySelector("[role=dialog]")).toBeNull();
  });

  it("shows nothing to someone who has seen both", () => {
    markIntroSeen("u1");
    markTourSeen("u1");
    renderGate();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not show another person's welcome to someone who has seen it", () => {
    markIntroSeen("u1");
    markTourSeen("u1");
    renderGate("u2");

    expect(screen.getByRole("dialog", { name: /welcome to paysense/i })).toBeInTheDocument();
  });

  it("comes back when it is replayed from Settings", () => {
    markIntroSeen("u1");
    markTourSeen("u1");
    renderGate();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    replayIntro("u1");

    return screen.findByRole("dialog", { name: /welcome to paysense/i });
  });
});
