import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { describe, expect, it, vi } from "vitest";

import { Intro } from "@/components/onboarding/Intro";

function setup() {
  const onTour = vi.fn();
  const onSkip = vi.fn();
  const user = userEvent.setup();
  const { container } = render(<Intro onTour={onTour} onSkip={onSkip} />);
  return { onTour, onSkip, user, container };
}

describe("Intro", () => {
  it("opens as a dialog on the first of three slides, with focus inside it", () => {
    setup();

    const dialog = screen.getByRole("dialog", { name: /welcome to paysense/i });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText(/step 1 of 3/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /see where your money is heading/i })).toBeInTheDocument();
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
  });

  it("says what the forecast is without telling the student it is a guess", () => {
    setup();

    expect(screen.getByText(/played forward from your own spending, income and bills\./i)).toBeInTheDocument();
    expect(screen.queryByText(/rather than one guess/i)).not.toBeInTheDocument();
  });

  it("names buy now, pay later on the second slide and gives the answer, its reasons and the smallest change in one sentence", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(
      screen.getByText(
        /get safe, caution or at risk, the reasons from your own figures, and the smallest change that would make it safe/i,
      ),
    ).toBeInTheDocument();
  });

  it("keeps the last slide to what the student controls, with no disclaimer on it", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByText(/nothing is saved until you add it/i)).toBeInTheDocument();
    expect(screen.getByText(/from your data, any time/i)).toBeInTheDocument();
    expect(screen.queryByText(/not financial advice/i)).not.toBeInTheDocument();
  });

  it("goes forward and back one slide at a time", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText(/step 2 of 3/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /check a buy-now-pay-later plan before you commit/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByText(/step 1 of 3/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();
  });

  it("offers the tour or a way out on the last slide", async () => {
    const { user, onTour, onSkip } = setup();
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByRole("heading", { name: /you stay in control/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /take a quick tour/i }));
    expect(onTour).toHaveBeenCalledOnce();
    expect(onSkip).not.toHaveBeenCalled();
  });

  it("can be skipped from any slide, by button or Escape", async () => {
    const first = setup();
    await first.user.click(screen.getByRole("button", { name: "Skip" }));
    expect(first.onSkip).toHaveBeenCalledOnce();

    const second = setup();
    await second.user.keyboard("{Escape}");
    expect(second.onSkip).toHaveBeenCalledOnce();
  });

  it("skips the tour too from the last slide", async () => {
    const { user, onSkip } = setup();
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Next" }));

    await user.click(screen.getByRole("button", { name: /skip the tour/i }));

    expect(onSkip).toHaveBeenCalledOnce();
  });

  it("has no accessibility violations on any slide", async () => {
    const { user, container } = setup();
    for (let slide = 0; slide < 3; slide++) {
      const { violations } = await axe.run(container);
      expect(violations).toEqual([]);
      if (slide < 2) await user.click(screen.getByRole("button", { name: "Next" }));
    }
  });
});
