import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Tour } from "@/components/onboarding/Tour";

// jsdom has no layout, so every marked target is given a box of its own.
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.hasAttribute("data-tour")
      ? ({ top: 100, left: 10, width: 180, height: 40, right: 190, bottom: 140 } as DOMRect)
      : ({ top: 0, left: 0, width: 0, height: 0, right: 0, bottom: 0 } as DOMRect);
  });
});
afterEach(() => vi.restoreAllMocks());

function Harness({ targets, onDone, show }: { targets: string[]; onDone: () => void; show: boolean }) {
  return (
    <>
      <div>
        {targets.map((t) => (
          <a key={t} href="#x" data-tour={t}>
            {t}
          </a>
        ))}
      </div>
      {show && <Tour onDone={onDone} />}
    </>
  );
}

// The tour is mounted after the page it points at, as the app does.
function setup(targets: string[]) {
  const onDone = vi.fn();
  const user = userEvent.setup();
  const view = render(<Harness targets={targets} onDone={onDone} show={false} />);
  view.rerender(<Harness targets={targets} onDone={onDone} show />);
  return { onDone, user, view };
}

const ALL = ["forecast", "transactions", "risk", "plans", "model", "settings"];

describe("Tour", () => {
  it("starts on the first stop with its heading, its words and where it is in the tour", () => {
    setup(ALL);

    const tour = screen.getByRole("dialog", { name: /tour of paysense/i });
    expect(tour).toHaveTextContent("1 of 6");
    expect(screen.getByRole("heading", { name: /where your money is heading/i })).toBeInTheDocument();
  });

  it("leaves out a stop whose target is not on screen", () => {
    setup(["transactions", "risk", "settings"]);

    expect(screen.getByRole("dialog", { name: /tour of paysense/i })).toHaveTextContent("1 of 3");
    expect(screen.getByRole("heading", { name: /everything you.ve spent/i })).toBeInTheDocument();
  });

  it("ends at once when nothing it points at is on screen", () => {
    const { onDone } = setup([]);

    expect(onDone).toHaveBeenCalledOnce();
  });

  it("goes forward and back, and finishes with Done", async () => {
    const { user, onDone } = setup(["transactions", "risk"]);

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { name: /check before you split/i })).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveTextContent("2 of 2");

    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("1 of 2");

    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(onDone).toHaveBeenCalledOnce();
  });

  it("can be skipped at any stop, with the button or Escape", async () => {
    const first = setup(ALL);
    await first.user.click(screen.getByRole("button", { name: /skip tour/i }));
    expect(first.onDone).toHaveBeenCalledOnce();

    const second = setup(ALL);
    await second.user.keyboard("{Escape}");
    expect(second.onDone).toHaveBeenCalledOnce();
  });

  it("puts focus on the forward button so Enter carries on", () => {
    setup(ALL);

    expect(screen.getByRole("button", { name: "Next" })).toHaveFocus();
  });

  it("highlights the target it is pointing at", () => {
    setup(ALL);

    expect(screen.getByTestId("tour-spotlight")).toBeInTheDocument();
  });

  it("is a modal dialog", () => {
    setup(ALL);

    expect(screen.getByRole("dialog", { name: /tour of paysense/i })).toHaveAttribute("aria-modal", "true");
  });

  it("follows its target when the page moves under it, with no scroll or resize", () => {
    let notify: () => void = () => {};
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          notify = callback;
        }
        observe() {}
        disconnect() {}
      },
    );
    setup(ALL);
    const before = screen.getByTestId("tour-spotlight").style.top;

    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.hasAttribute("data-tour")
        ? ({ top: 340, left: 10, width: 180, height: 40, right: 190, bottom: 380 } as DOMRect)
        : ({ top: 0, left: 0, width: 0, height: 0, right: 0, bottom: 0 } as DOMRect);
    });
    act(() => notify());

    expect(screen.getByTestId("tour-spotlight").style.top).not.toBe(before);
    vi.unstubAllGlobals();
  });

  it("has no accessibility violations", async () => {
    const { view } = setup(ALL);

    const { violations } = await axe.run(view.container);
    expect(violations).toEqual([]);
  });
});
