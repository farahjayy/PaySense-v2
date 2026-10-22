import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { PageHeader } from "@/components/ui/PageHeader";

describe("PageHeader", () => {
  it("sets the title in the heavier 32px face", () => {
    render(<PageHeader title="Recurring items" />);

    const title = screen.getByRole("heading", { level: 1, name: "Recurring items" });
    expect(title.className).toContain("text-[32px]");
    expect(title.className).toContain("font-bold");
  });

  it("keeps the background text behind a Why? toggle that starts closed", async () => {
    render(<PageHeader title="Recurring" intro="One line." more="The longer reason." />);

    const toggle = screen.getByText("Why?");
    const details = toggle.closest("details") as HTMLDetailsElement;
    expect(details.open).toBe(false);
    expect(screen.getByText("One line.")).toBeVisible();

    await userEvent.click(toggle);

    expect(details.open).toBe(true);
    expect(screen.getByText("The longer reason.")).toBeVisible();
  });

  it("shows no toggle when there is nothing more to say", () => {
    render(<PageHeader title="Plans" intro="One line." />);

    expect(screen.queryByText("Why?")).not.toBeInTheDocument();
  });
});
