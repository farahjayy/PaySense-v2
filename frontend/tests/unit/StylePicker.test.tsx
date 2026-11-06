import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import { StylePicker } from "@/components/categories/StylePicker";
import { COLOUR_HEX, ICON_GLYPH } from "@/lib/categoryStyle";

function show(over: Partial<ComponentProps<typeof StylePicker>> = {}) {
  const onChange = vi.fn();
  render(<StylePicker name="Gym" icon={null} colour={null} onChange={onChange} {...over} />);
  return onChange;
}

describe("StylePicker", () => {
  it("offers every colour and every icon by name", () => {
    show();

    const colours = within(screen.getByRole("group", { name: "Colour" })).getAllByRole("button");
    const icons = within(screen.getByRole("group", { name: "Icon" })).getAllByRole("button");
    expect(colours).toHaveLength(Object.keys(COLOUR_HEX).length);
    expect(icons).toHaveLength(Object.keys(ICON_GLYPH).length);
    expect(screen.getByRole("button", { name: "Plum" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tag" })).toBeInTheDocument();
  });

  it("reports the colour picked and keeps the icon already chosen", async () => {
    const onChange = show({ icon: "drink" });

    await userEvent.click(screen.getByRole("button", { name: "Plum" }));

    expect(onChange).toHaveBeenCalledWith({ icon: "drink", colour: "plum" });
  });

  it("reports the icon picked and keeps the colour already chosen", async () => {
    const onChange = show({ colour: "sky" });

    await userEvent.click(screen.getByRole("button", { name: "Tag" }));

    expect(onChange).toHaveBeenCalledWith({ icon: "tag", colour: "sky" });
  });

  it("marks what is chosen, so it is not told by colour alone", () => {
    show({ icon: "drink", colour: "plum" });

    expect(screen.getByRole("button", { name: "Plum" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Drink" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Sky" })).toHaveAttribute("aria-pressed", "false");
  });

  it("shows a preview of the tile with the chosen colour", () => {
    show({ icon: "drink", colour: "plum" });

    expect(screen.getByTestId("category-tile")).toHaveStyle({ background: COLOUR_HEX.plum });
  });
});
