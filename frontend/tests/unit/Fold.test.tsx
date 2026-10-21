import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { Fold } from "@/components/ui/Fold";

function Harness({ startOpen = false }: { startOpen?: boolean }) {
  const [open, setOpen] = useState(startOpen);
  return (
    <Fold
      id="month"
      title="Month by month"
      summary="Most owed: RM 316.33 in November 2026"
      open={open}
      onToggle={() => setOpen((v) => !v)}
    >
      <p>The working</p>
    </Fold>
  );
}

describe("Fold", () => {
  it("is closed to begin with and still shows its title and the figure that summarises it", () => {
    render(<Harness />);

    const button = screen.getByRole("button", { name: /month by month/i });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveTextContent("Most owed: RM 316.33 in November 2026");
    expect(screen.queryByText("The working")).not.toBeInTheDocument();
  });

  it("opens and closes with the keyboard, and aria-expanded follows", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const button = screen.getByRole("button", { name: /month by month/i });

    button.focus();
    await user.keyboard("{Enter}");
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("The working")).toBeVisible();

    await user.keyboard(" ");
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("The working")).not.toBeVisible();
  });

  it("keeps what it opened mounted, hidden, so closing and reopening loses nothing", async () => {
    const user = userEvent.setup();
    render(<Harness startOpen />);
    expect(screen.getByText("The working")).toBeVisible();

    await user.click(screen.getByRole("button", { name: /month by month/i }));

    expect(screen.getByText("The working")).toBeInTheDocument();
    expect(screen.getByText("The working")).not.toBeVisible();
  });

  it("points the button at the region it controls, and the region at its title", () => {
    render(<Harness startOpen />);

    const button = screen.getByRole("button", { name: /month by month/i });
    const region = screen.getByRole("region", { name: /month by month/i });
    expect(button).toHaveAttribute("aria-controls", region.id);
  });
});
